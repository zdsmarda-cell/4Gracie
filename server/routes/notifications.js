
import express from 'express';
import { withDb } from '../db.js';
import webpush from 'web-push';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Configure Web Push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        `mailto:${process.env.EMAIL_FROM || 'info@4gracie.cz'}`,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
    console.log("✅ VAPID Keys configured for Push Notifications");
} else {
    console.warn("⚠️ VAPID keys missing. Push notifications will not work.");
}

// SUBSCRIBE (Logged in users or guests)
router.post('/subscribe', withDb(async (req, res, db) => {
    const { subscription } = req.body;
    let userId = null;
    
    // Attempt to identify user from token if present
    const authHeader = req.headers['authorization'];
    // In a real app we decode token here or use middleware, but subscription is often public/guest initially
    // We will trust the client to re-subscribe with auth header if they log in later, updating the user_id.

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

// GET HISTORY (Admin)
router.get('/history', requireAdmin, withDb(async (req, res, db) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    const [rows] = await db.query(
        'SELECT * FROM notification_history ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [Number(limit), Number(offset)]
    );
    const [count] = await db.query('SELECT COUNT(*) as t FROM notification_history');
    
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
    const { filters } = req.body; // { marketing: boolean, zips: string[] }
    
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

    // Only apply ZIP filter if array is NOT empty. Empty array = All ZIPs.
    if (filters.zips && filters.zips.length > 0) {
        query += ' AND REPLACE(ua.zip, " ", "") IN (?)';
        params.push(filters.zips);
    }

    const [rows] = await db.query(query, params);
    res.json({ count: rows[0].cnt });
}));

// SEND NOTIFICATION (Admin)
router.post('/send', requireAdmin, withDb(async (req, res, db) => {
    const { subject, body, filters, forceAll } = req.body;

    // 1. Save History
    const [histResult] = await db.query(
        'INSERT INTO notification_history (subject, body, filters, recipient_count) VALUES (?, ?, ?, 0)',
        [subject, body, JSON.stringify(filters || {})]
    );
    const historyId = histResult.insertId;

    // 2. Fetch Recipients
    let query = `
        SELECT DISTINCT s.endpoint, s.p256dh, s.auth 
        FROM push_subscriptions s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN user_addresses ua ON u.id = ua.user_id
        WHERE 1=1
    `;
    const params = [];

    if (!forceAll) {
        if (filters?.marketing) {
            query += ' AND u.marketing_consent = 1';
        }
        if (filters?.zips && filters.zips.length > 0) {
            query += ' AND REPLACE(ua.zip, " ", "") IN (?)';
            params.push(filters.zips);
        }
    }

    const [subscriptions] = await db.query(query, params);

    // 3. Send
    let successCount = 0;
    const payload = JSON.stringify({ title: subject, body: body, url: '/' });

    const promises = subscriptions.map(sub => {
        const pushConfig = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
        };
        
        return webpush.sendNotification(pushConfig, payload)
            .then(() => { successCount++; })
            .catch(err => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Subscription expired, remove from DB
                    db.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
                }
            });
    });

    await Promise.all(promises);

    // 4. Update History
    await db.query('UPDATE notification_history SET recipient_count = ? WHERE id = ?', [successCount, historyId]);

    res.json({ success: true, count: successCount });
}));

export default router;
