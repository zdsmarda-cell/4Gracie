
import express from 'express';
import { withDb, parseJsonCol } from '../db.js';
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
    const { id } = req.params;

    // 1. Get the discount code string first
    const [discounts] = await db.query('SELECT code FROM discounts WHERE id = ?', [id]);
    
    if (discounts.length > 0) {
        const code = discounts[0].code;
        
        // 2. Check if used in any EXISTING (non-deleted) order
        // We search in full_json.appliedDiscounts. The code is stored there.
        // Using LIKE is simpler than JSON functions for compatibility, assuming "code":"CODE" structure.
        // We exclude CANCELLED orders from blocking? Usually yes, but the prompt says "jakekoliv objednavce".
        // Let's match ANY order present in DB to be safe for accounting consistency.
        
        const searchPattern = `%"code":"${code}"%`;
        const [used] = await db.query('SELECT id FROM orders WHERE full_json LIKE ? LIMIT 1', [searchPattern]);
        
        if (used.length > 0) {
            return res.status(400).json({ error: `Nelze smazat: Kód "${code}" byl použit v objednávce #${used[0].id}.` });
        }
    }

    await db.query('DELETE FROM discounts WHERE id=?', [id]); 
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
