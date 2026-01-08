
import express from 'express';
import { withDb, parseJsonCol } from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendEventNotification } from '../services/email.js';
import { requireAdmin } from '../middleware/auth.js'; // Import middleware

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', 'uploads');
const UPLOAD_IMAGES_DIR = path.join(UPLOAD_ROOT, 'images');

if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
if (!fs.existsSync(UPLOAD_IMAGES_DIR)) fs.mkdirSync(UPLOAD_IMAGES_DIR, { recursive: true });

// UPLOAD - Protected
router.post('/upload', requireAdmin, async (req, res) => {
    const { image, name } = req.body;
    if (!image) return res.status(400).json({ error: 'No image' });
    const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid format' });
    let ext = matches[1]; if(ext==='jpeg')ext='jpg'; if(ext==='svg+xml')ext='svg';
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `${Date.now()}_${(name||'img').replace(/[^a-z0-9]/gi,'_')}.${ext}`;
    const fullPath = path.join(UPLOAD_IMAGES_DIR, fileName);
    
    try { 
        fs.writeFileSync(fullPath, buffer);
        console.log(`✅ Image saved: ${fullPath}`);
        res.json({ success: true, url: `/api/uploads/images/${fileName}` }); 
    } catch (err) { 
        console.error("❌ Save failed:", err);
        res.status(500).json({ error: 'Save failed' }); 
    }
});

// IMPORT - Protected
router.post('/import', requireAdmin, withDb(async (req, res, db) => {
    const { data } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        if (data.products) {
            await conn.query('DELETE FROM products');
            for(const p of data.products) await conn.query('INSERT INTO products (id, name, full_json) VALUES (?,?,?)', [p.id, p.name, JSON.stringify(p)]);
        }
        await conn.commit();
        res.json({ success: true });
    } catch(e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally {
        conn.release();
    }
}));

// NOTIFY EVENT - Protected
router.post('/notify-event', requireAdmin, withDb(async (req, res, db) => {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'Date required' });

    try {
        const [users] = await db.query('SELECT email FROM users WHERE marketing_consent = 1 AND is_blocked = 0');
        const recipients = users.map(u => u.email).filter(e => e && e.includes('@'));

        if (recipients.length === 0) {
            return res.json({ success: true, message: 'No recipients found' });
        }

        const [pRows] = await db.query('SELECT full_json FROM products WHERE is_deleted = 0');
        const eventProducts = pRows
            .map(r => parseJsonCol(r, 'full_json'))
            .filter(p => p.isEventProduct && p.visibility?.online);

        if (eventProducts.length === 0) {
            return res.json({ success: true, message: 'No active event products found' });
        }

        await sendEventNotification(date, eventProducts, recipients);

        res.json({ success: true, count: recipients.length });
    } catch (e) {
        console.error("Notify Event Error:", e);
        res.status(500).json({ error: e.message });
    }
}));

// EMAIL MANAGEMENT ROUTES - Protected
router.get('/emails', requireAdmin, withDb(async (req, res, db) => {
    const { status, recipient, subject, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    let query = "SELECT * FROM email_queue WHERE 1=1";
    let countQuery = "SELECT COUNT(*) as t FROM email_queue WHERE 1=1";
    
    const params = [];

    if (status) {
        const cond = " AND status = ?";
        query += cond;
        countQuery += cond;
        params.push(status);
    }
    
    if (recipient) {
        const cond = " AND recipient_email LIKE ?";
        query += cond;
        countQuery += cond;
        params.push(`%${recipient}%`);
    }

    if (subject) {
        const cond = " AND subject LIKE ?";
        query += cond;
        countQuery += cond;
        params.push(`%${subject}%`);
    }

    if (dateFrom) {
        const cond = " AND created_at >= ?";
        query += cond;
        countQuery += cond;
        params.push(`${dateFrom} 00:00:00`);
    }

    if (dateTo) {
        const cond = " AND created_at <= ?";
        query += cond;
        countQuery += cond;
        params.push(`${dateTo} 23:59:59`);
    }

    const [cnt] = await db.query(countQuery, params);
    const total = cnt[0].t;

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));
    
    const [rows] = await db.query(query, params);
    
    res.json({ 
        success: true, 
        emails: rows,
        total: total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit))
    });
}));

router.post('/emails/retry', requireAdmin, withDb(async (req, res, db) => {
    const { ids } = req.body; 
    if (!ids || ids.length === 0) return res.status(400).json({ error: "No IDs provided" });
    
    await db.query("UPDATE email_queue SET status = 'pending', error_message = NULL WHERE id IN (?)", [ids]);
    res.json({ success: true, count: ids.length });
}));

export default router;
