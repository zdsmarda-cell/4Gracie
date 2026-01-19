
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
    // Always re-check in case env vars changed or first run failed
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        try {
            webpush.setVapidDetails(
                `mailto:${process.env.EMAIL_FROM || 'info@4gracie.cz'}`,
                process.env.VAPID_PUBLIC_KEY,
                process.env.VAPID_PRIVATE_KEY
            );
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
        // FIX: Check for existence explicitly using the full endpoint string to avoid Prefix Index collisions (endpoint(255))
        // Some push services have very long endpoints where the uniqueness is at the end.
        const [existing] = await db.query('SELECT id, user_id FROM push_subscriptions WHERE endpoint = ?', [subscription.endpoint]);
        
        if (existing.length > 0) {
            // Update Existing
            // If we have a userId now, update it. If we don't (logout/guest), keep the old user_id (don't overwrite with null unless intentional logic requires it, here we prefer keeping it linked if possible or strictly following session)
            // Logic update: If authenticated, claim the subscription.
            if (userId) {
                await db.query(
                    `UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ?, updated_at = NOW() WHERE endpoint = ?`,
                    [userId, subscription.keys.p256dh, subscription.keys.auth, subscription.endpoint]
                );
            } else {
                // Just update keys/time, keep user_id as is (or should we null it? Usually keeping it is safer for "forgot to login" scenarios, but for strict privacy, maybe null. Let's update keys only.)
                await db.query(
                    `UPDATE push_subscriptions SET p256dh = ?, auth = ?, updated_at = NOW() WHERE endpoint = ?`,
                    [subscription.keys.p256dh, subscription.keys.auth, subscription.endpoint]
                );
            }
        } else {
            // Insert New
            await db.query(
                `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)`,
                [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
            );
        }
        
        res.json({ success: true });
    } catch (e) {
        console.error("Subscription Error:", e);
        res.status(500).json({ error: e.message });
    }
}));

// UNSUBSCRIBE
router.post('/unsubscribe', withDb(async (req, res, db) => {
    const { endpoint } = req.body;
    let userId = null;

    // 1. Authenticate to get User ID (Same logic as subscribe)
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, SECRET_KEY);
                userId = decoded.id;
            } catch (err) {
                // Invalid token, proceed as anonymous
            }
        }
    }

    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });

    try {
        if (userId) {
            // CASE A: Logged in user - Only delete THEIR record for this endpoint.
            // This prevents deleting records of other users if endpoints collide or if the DB has duplicates.
            await db.query('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [userId, endpoint]);
        } else {
            // CASE B: Guest/Anonymous - Fallback to endpoint match only
            await db.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
        }
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

// RETRY SENDING (Admin)
router.post('/retry', requireAdmin, withDb(async (req, res, db) => {
    if (!configureWebPush()) {
        return res.status(500).json({ error: 'Server VAPID keys not configured' });
    }

    const { logId } = req.body;
    if (!logId) return res.status(400).json({ error: 'Missing logId' });

    // 1. Get original log to fetch message content and target user
    const [logs] = await db.query('SELECT * FROM push_logs WHERE id = ?', [logId]);
    if (logs.length === 0) return res.status(404).json({ error: 'Log entry not found' });
    const originalLog = logs[0];

    // 2. Find ACTIVE subscriptions for this user
    // We cannot reuse the old endpoint from the log because logs don't store endpoints, and even if they did, the sub might be dead.
    // We must send to current active devices.
    const [subs] = await db.query('SELECT * FROM push_subscriptions WHERE user_id = ?', [originalLog.user_id]);

    if (subs.length === 0) {
        return res.status(404).json({ error: 'User has no active push subscriptions.' });
    }

    const payload = JSON.stringify({
        title: originalLog.title,
        body: originalLog.body,
        url: '/' // Default or try to extract from body if structured, but simple for now
    });

    let successCount = 0;
    let lastError = null;

    // 3. Send
    for (const sub of subs) {
        try {
            await webpush.sendNotification({
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
            }, payload);
            successCount++;
        } catch (err) {
            console.error(`Retry failed for sub ${sub.id}:`, err);
            lastError = err.message || 'Unknown error';
            if (err.statusCode === 410 || err.statusCode === 404) {
                await db.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
            }
        }
    }

    // 4. Update Log Status
    // If at least one succeeded, mark as sent. If all failed, mark as error.
    if (successCount > 0) {
        await db.query("UPDATE push_logs SET status = 'sent', error_message = NULL, created_at = NOW() WHERE id = ?", [logId]);
        res.json({ success: true, message: `Odesláno na ${successCount} zařízení.` });
    } else {
        const errorMsg = lastError || 'All subscriptions failed';
        await db.query("UPDATE push_logs SET status = 'error', error_message = ?, created_at = NOW() WHERE id = ?", [errorMsg, logId]);
        res.status(500).json({ error: errorMsg });
    }
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

    res.json({ success: true, count: successCount });
}));

export default router;
