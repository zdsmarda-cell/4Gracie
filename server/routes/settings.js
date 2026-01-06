
import express from 'express';
import { withDb } from '../db.js';

const router = express.Router();

// Global Settings
router.post('/settings', withDb(async (req, res, db) => { 
    await db.query('INSERT INTO app_settings (key_name, data) VALUES ("global", ?) ON DUPLICATE KEY UPDATE data=?', [JSON.stringify(req.body), JSON.stringify(req.body)]); 
    res.json({ success: true }); 
}));

// Discounts
router.post('/discounts', withDb(async (req, res, db) => { 
    const d = req.body; 
    await db.query('INSERT INTO discounts (id, code, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data=?', [d.id, d.code, JSON.stringify(d), JSON.stringify(d)]); 
    res.json({ success: true }); 
}));

router.delete('/discounts/:id', withDb(async (req, res, db) => { 
    await db.query('DELETE FROM discounts WHERE id=?', [req.params.id]); 
    res.json({ success: true }); 
}));

// Calendar Exceptions
router.post('/calendar', withDb(async (req, res, db) => { 
    const c = req.body; 
    await db.query('INSERT INTO calendar_exceptions (date, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data=?', [c.date, JSON.stringify(c), JSON.stringify(c)]); 
    res.json({ success: true }); 
}));

router.delete('/calendar/:date', withDb(async (req, res, db) => { 
    await db.query('DELETE FROM calendar_exceptions WHERE date=?', [req.params.date]); 
    res.json({ success: true }); 
}));

// App Version (Cache Busting)
router.post('/version', withDb(async (req, res, db) => {
    const { version } = req.body;
    await db.query('INSERT INTO app_settings (key_name, data) VALUES ("app_version", ?) ON DUPLICATE KEY UPDATE data=?', [JSON.stringify(version), JSON.stringify(version)]);
    res.json({ success: true });
}));

export default router;
