
import express from 'express';
import { withDb } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All settings routes strictly admin only

// Global Settings
router.post('/settings', requireAdmin, withDb(async (req, res, db) => { 
    await db.query('INSERT INTO app_settings (key_name, data) VALUES ("global", ?) ON DUPLICATE KEY UPDATE data=?', [JSON.stringify(req.body), JSON.stringify(req.body)]); 
    res.json({ success: true }); 
}));

// Discounts
router.post('/discounts', requireAdmin, withDb(async (req, res, db) => { 
    const d = req.body; 
    await db.query('INSERT INTO discounts (id, code, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data=?', [d.id, d.code, JSON.stringify(d), JSON.stringify(d)]); 
    res.json({ success: true }); 
}));

router.delete('/discounts/:id', requireAdmin, withDb(async (req, res, db) => { 
    await db.query('DELETE FROM discounts WHERE id=?', [req.params.id]); 
    res.json({ success: true }); 
}));

// Calendar Exceptions
router.post('/calendar', requireAdmin, withDb(async (req, res, db) => { 
    const c = req.body; 
    await db.query('INSERT INTO calendar_exceptions (date, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data=?', [c.date, JSON.stringify(c), JSON.stringify(c)]); 
    res.json({ success: true }); 
}));

router.delete('/calendar/:date', requireAdmin, withDb(async (req, res, db) => { 
    await db.query('DELETE FROM calendar_exceptions WHERE date=?', [req.params.date]); 
    res.json({ success: true }); 
}));

export default router;
