
import express from 'express';
import { withDb, parseJsonCol } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', withDb(async (req, res, db) => {
    const { 
        page = 1, limit = 50, sort, order = 'asc',
        search, minPrice, maxPrice, categories, visibility 
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    
    // Build Query
    let query = 'SELECT * FROM products WHERE is_deleted = 0';
    let countQuery = 'SELECT COUNT(*) as t FROM products WHERE is_deleted = 0';
    const params = [];

    // Search (Name)
    if (search) {
        const cond = ' AND name LIKE ?';
        query += cond;
        countQuery += cond;
        params.push(`%${search}%`);
    }

    // Price
    if (minPrice) {
        const cond = ' AND price >= ?';
        query += cond;
        countQuery += cond;
        params.push(minPrice);
    }
    if (maxPrice) {
        const cond = ' AND price <= ?';
        query += cond;
        countQuery += cond;
        params.push(maxPrice);
    }

    // Categories
    if (categories) {
        // Can be array or single string
        const catArray = Array.isArray(categories) ? categories : [categories];
        if (catArray.length > 0) {
            const cond = ' AND category IN (?)';
            query += cond;
            countQuery += cond;
            params.push(catArray);
        }
    }

    // Visibility (JSON query)
    // Structure: full_json -> visibility -> { online: bool, store: bool, stand: bool }
    if (visibility) {
        const visArray = Array.isArray(visibility) ? visibility : [visibility];
        if (visArray.length > 0) {
            // Logic: OR condition for selected visibilities. If product has ANY of selected true, include it.
            const conditions = [];
            if (visArray.includes('online')) conditions.push("JSON_EXTRACT(full_json, '$.visibility.online') = true");
            if (visArray.includes('store')) conditions.push("JSON_EXTRACT(full_json, '$.visibility.store') = true");
            if (visArray.includes('stand')) conditions.push("JSON_EXTRACT(full_json, '$.visibility.stand') = true");
            
            if (conditions.length > 0) {
                const cond = ` AND (${conditions.join(' OR ')})`;
                query += cond;
                countQuery += cond;
            }
        }
    }

    // Count
    const [cnt] = await db.query(countQuery, params);
    const total = cnt[0].t;

    // Sort
    if (sort) {
        const validCols = ['name', 'price', 'category'];
        if (validCols.includes(sort)) {
            query += ` ORDER BY ${sort} ${order === 'desc' ? 'DESC' : 'ASC'}`;
        } else {
            query += ' ORDER BY name ASC';
        }
    } else {
        query += ' ORDER BY name ASC';
    }

    // Pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [rows] = await db.query(query, params);
    
    // Parse JSON
    const products = rows.map(r => parseJsonCol(r, 'full_json'));

    res.json({
        success: true,
        products,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit))
    });
}));

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
