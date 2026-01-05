
import express from 'express';
import { withDb } from '../db.js';

const router = express.Router();

router.get('/load', withDb(async (req, res, db) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Missing date" });
    
    const summaryQuery = `
        SELECT 
            COALESCE(p.category, JSON_UNQUOTE(JSON_EXTRACT(p.full_json, '$.category')), oi.category, 'unknown') as category,
            SUM(oi.quantity * COALESCE(p.workload, oi.workload, 0)) as total_workload, 
            SUM(DISTINCT COALESCE(p.workload_overhead, oi.workload_overhead, 0)) as total_overhead,
            COUNT(DISTINCT order_id) as order_count
        FROM order_items oi 
        JOIN orders o ON o.id = oi.order_id 
        LEFT JOIN products p ON oi.product_id = p.id 
        WHERE o.delivery_date = ? AND o.status != 'cancelled'
        GROUP BY category
    `;

    const detailQuery = `
        SELECT 
            COALESCE(p.category, JSON_UNQUOTE(JSON_EXTRACT(p.full_json, '$.category')), oi.category, 'unknown') as category, 
            oi.product_id, 
            COALESCE(p.name, oi.name) as name, 
            COALESCE(p.unit, JSON_UNQUOTE(JSON_EXTRACT(p.full_json, '$.unit')), oi.unit) as unit, 
            SUM(oi.quantity) as total_quantity, 
            SUM(oi.quantity * COALESCE(p.workload, oi.workload, 0)) as product_workload,
            MAX(COALESCE(p.workload_overhead, oi.workload_overhead, 0)) as unit_overhead
        FROM order_items oi 
        JOIN orders o ON o.id = oi.order_id 
        LEFT JOIN products p ON oi.product_id = p.id 
        WHERE o.delivery_date = ? AND o.status != 'cancelled'
        GROUP BY category, oi.product_id, name, unit
    `;

    const [summary] = await db.query(summaryQuery, [date]);
    const [details] = await db.query(detailQuery, [date]);
    res.json({ success: true, summary, details });
}));

export default router;
