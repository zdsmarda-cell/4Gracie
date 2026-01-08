
import express from 'express';
import { withDb } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireAdmin, withDb(async (req, res, db) => {
    const p = req.body;
    const jsonStr = JSON.stringify(p);
    
    // Check if exists
    const [exists] = await db.query('SELECT id FROM products WHERE id = ?', [p.id]);
    
    if (exists.length > 0) {
        // UPDATE
        await db.query(`UPDATE products SET name=?, description=?, price=?, unit=?, category=?, workload=?, workload_overhead=?, vat_rate_inner=?, vat_rate_takeaway=?, image_url=?, full_json=?, is_deleted=? WHERE id=?`, 
        [p.name, p.description, p.price, p.unit, p.category, p.workload, p.workloadOverhead, p.vatRateInner, p.vatRateTakeaway, p.images?.[0]||null, jsonStr, false, p.id]);
    } else {
        // INSERT
        await db.query(`INSERT INTO products (id, name, description, price, unit, category, workload, workload_overhead, vat_rate_inner, vat_rate_takeaway, image_url, full_json, is_deleted) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
        [p.id, p.name, p.description, p.price, p.unit, p.category, p.workload, p.workloadOverhead, p.vatRateInner, p.vatRateTakeaway, p.images?.[0]||null, jsonStr, false]);
    }
    res.json({ success: true });
}));

router.delete('/:id', requireAdmin, withDb(async (req, res, db) => {
    await db.query('UPDATE products SET is_deleted = TRUE WHERE id = ?', [req.params.id]);
    res.json({ success: true });
}));

export default router;
