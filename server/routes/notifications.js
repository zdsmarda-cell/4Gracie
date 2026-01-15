
import express from 'express';
import { withDb } from '../db.js';
import webpush from 'web-push';
import jwt from 'jsonwebtoken'; // Import JWT for decoding
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';

let isWebPushConfigured = false;

// Configure Web Push Function
const configureWebPush = () => {
    if (isWebPushConfigured) return true;
    
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        try {
            webpush.setVapidDetails(
                `mailto:${process.env.EMAIL_FROM || 'info@4gracie.cz'}`,
                process.env.VAPID_PUBLIC_KEY,
                process.env.VAPID_PRIVATE_KEY
            );
            console.log("✅ VAPID Keys configured for Push Notifications");
            isWebPushConfigured = true;
            return true;
        } catch (e) {
            console.error("❌ Failed to configure VAPID:", e.message);
            return false;
        }
    } else {
        console.warn("⚠️ VAPID keys missing in env. Push notifications will not work.");
        return false;
    }
};

// Try configure immediately
configureWebPush();

// SUBSCRIBE (Logged in users or guests)
router.post('/subscribe', withDb(async (req, res, db) => {
    const { subscription } = req.body;
    let userId = null;
    
    // Extract User ID from Token
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, SECRET_KEY);
                userId = decoded.id;
            } catch (err) {
                // Token invalid or expired, proceed as anonymous or log warning
                // console.warn("Push Subscribe: Invalid Token", err.message);
            }
        }
    }

    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription' });
    }

    try {
        await db.query(
            `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) 
             VALUES (?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), updated_at = NOW()`,
            [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
        );
        res.json({ success: true });
    } catch (e) {
        console.error("Subscription Error:", e);
        res.status(500).json({ error: e.message });
    }
}));

// UNSUBSCRIBE
router.post('/unsubscribe', withDb(async (req, res, db) => {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });

    try {
        await db.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
        res.json({ success: true });
    } catch (e) {
        console.error("Unsubscribe Error:", e);
        res.status(500).json({ error: e.message });
    }
}));

// GET HISTORY (Admin) - GRANULAR LOGS
router.get('/history', requireAdmin, withDb(async (req, res, db) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    // Fetch granular logs joined with user info
    const [rows] = await db.query(`
        SELECT pl.*, u.name as user_name, u.email as user_email
        FROM push_logs pl
        LEFT JOIN users u ON pl.user_id = u.id
        ORDER BY pl.created_at DESC 
        LIMIT ? OFFSET ?`,
        [Number(limit), Number(offset)]
    );
    
    const [count] = await db.query('SELECT COUNT(*) as t FROM push_logs');
    
    res.json({ 
        success: true, 
        notifications: rows, 
        total: count[0].t,
        page: Number(page),
        pages: Math.ceil(count[0].t / Number(limit))
    });
}));

// GET TARGET USERS COUNT (Admin Preview)
router.post('/preview-count', requireAdmin, withDb(async (req, res, db) => {
    const { filters } = req.body; 
    
    let query = `
        SELECT COUNT(DISTINCT s.endpoint) as cnt 
        FROM push_subscriptions s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN user_addresses ua ON u.id = ua.user_id
        WHERE 1=1
    `;
    const params = [];

    if (filters.marketing) {
        query += ' AND u.marketing_consent = 1';
    }

    if (filters.zips && filters.zips.length > 0) {
        const validZips = filters.zips.filter(z => z && z.trim().length > 0);
        if (validZips.length > 0) {
            query += ' AND REPLACE(ua.zip, " ", "") IN (?)';
            params.push(validZips);
        }
    }

    try {
        const [rows] = await db.query(query, params);
        res.json({ count: rows[0].cnt });
    } catch (e) {
        console.error("Preview Error:", e);
        res.status(500).json({ error: e.message });
    }
}));

// SEND NOTIFICATION (Admin) - MODIFIED TO LOG TO PUSH_LOGS
router.post('/send', requireAdmin, withDb(async (req, res, db) => {
    if (!configureWebPush()) {
        return res.status(500).json({ error: 'Server VAPID keys not configured' });
    }

    const { subject, body, filters, forceAll, targetUserIds } = req.body;

    // 1. Fetch Recipients
    let query = `
        SELECT DISTINCT s.endpoint, s.p256dh, s.auth, s.user_id
        FROM push_subscriptions s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN user_addresses ua ON u.id = ua.user_id
        WHERE 1=1
    `;
    const params = [];

    if (targetUserIds && targetUserIds.length > 0) {
        query += ' AND s.user_id IN (?)';
        params.push(targetUserIds);
    } else if (!forceAll) {
        if (filters?.marketing) {
            query += ' AND u.marketing_consent = 1';
        }
        if (filters?.zips && filters.zips.length > 0) {
            const validZips = filters.zips.filter(z => z && z.trim().length > 0);
            if (validZips.length > 0) {
                query += ' AND REPLACE(ua.zip, " ", "") IN (?)';
                params.push(validZips);
            }
        }
    }

    const [subscriptions] = await db.query(query, params);

    if (subscriptions.length === 0) {
        return res.json({ success: true, count: 0, message: 'No recipients found' });
    }

    // 2. Send and Log individually
    let successCount = 0;
    const payload = JSON.stringify({ title: subject, body: body, url: '/' });

    const promises = subscriptions.map(async (sub) => {
        const pushConfig = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
        };
        
        try {
            await webpush.sendNotification(pushConfig, payload);
            successCount++;
            // LOG SUCCESS
            await db.query(
                'INSERT INTO push_logs (user_id, title, body, status) VALUES (?, ?, ?, ?)',
                [sub.user_id, subject, body, 'sent']
            );
        } catch (err) {
            // LOG ERROR
            await db.query(
                'INSERT INTO push_logs (user_id, title, body, status, error_message) VALUES (?, ?, ?, ?, ?)',
                [sub.user_id, subject, body, 'error', err.message || 'Send failed']
            );

            if (err.statusCode === 410 || err.statusCode === 404) {
                await db.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
            }
        }
    });

    await Promise.all(promises);

    // Optional: Keep aggregate history for quick stats if desired, but granular logs are primary now.
    await db.query(
        'INSERT INTO notification_history (subject, body, filters, recipient_count) VALUES (?, ?, ?, ?)',
        [subject, body, JSON.stringify(filters || { targetIds: targetUserIds ? targetUserIds.length : 0 }), successCount]
    );

    res.json({ success: true, count: successCount });
}));

export default router;
