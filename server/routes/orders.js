
import express from 'express';
import { withDb, parseJsonCol } from '../db.js';
import { sendOrderEmail } from '../services/email.js';

const router = express.Router();

router.post('/', withDb(async (req, res, db) => {
    const o = req.body;
    const deliveryDate = o.deliveryDate; 
    const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const isUserEdit = o.isUserEdit; // Check flag from frontend
    
    // 1. Save Order
    await db.query(`INSERT INTO orders (id, user_id, user_name, delivery_date, status, total_price, delivery_fee, packaging_fee, payment_method, is_paid, delivery_type, delivery_name, delivery_street, delivery_city, delivery_zip, delivery_phone, billing_name, billing_street, billing_city, billing_zip, billing_ic, billing_dic, note, pickup_location_id, language, created_at, full_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=?, total_price=?, delivery_date=?, full_json=?`, 
    [o.id, o.userId, o.userName, deliveryDate, o.status, o.totalPrice, o.deliveryFee, o.packagingFee, o.paymentMethod, o.isPaid, o.deliveryType, o.deliveryName, o.deliveryStreet, o.deliveryCity, o.deliveryZip, o.deliveryPhone, o.billingName, o.billingStreet, o.billingCity, o.billingZip, o.billingIc, o.billingDic, o.note, o.pickupLocationId, o.language, createdAt, JSON.stringify(o), o.status, o.totalPrice, deliveryDate, JSON.stringify(o)]);
    
    await db.query('DELETE FROM order_items WHERE order_id = ?', [o.id]);
    if (o.items && o.items.length > 0) {
        const values = o.items.map(i => [o.id, i.id, i.name, i.quantity, i.price, i.category, i.unit, i.workload||0, i.workloadOverhead||0]);
        await db.query('INSERT INTO order_items (order_id, product_id, name, quantity, price, category, unit, workload, workload_overhead) VALUES ?', [values]);
    }

    // 2. Trigger Email
    // Fetch global settings for Invoice generation
    const [sRows] = await db.query('SELECT data FROM app_settings WHERE key_name = "global"');
    const settings = sRows.length ? parseJsonCol(sRows[0]) : {};

    if (o.status === 'created') {
        if (isUserEdit) {
            await sendOrderEmail(o, 'updated', settings);
        } else {
            await sendOrderEmail(o, 'created', settings);
        }
    }

    res.json({ success: true });
}));

router.get('/', withDb(async (req, res, db) => {
    const { id, dateFrom, dateTo, userId, status, customer, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let query = 'SELECT full_json, final_invoice_date FROM orders WHERE 1=1';
    const params = [];
    if (id) { query += ' AND id LIKE ?'; params.push(`%${id}%`); }
    if (userId) { query += ' AND user_id = ?'; params.push(userId); }
    if (dateFrom) { query += ' AND delivery_date >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND delivery_date <= ?'; params.push(dateTo); }
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (customer) { query += ' AND user_name LIKE ?'; params.push(`%${customer}%`); }
    
    const [cnt] = await db.query(query.replace('SELECT full_json, final_invoice_date', 'SELECT COUNT(*) as t'), params);
    query += ' ORDER BY delivery_date DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    
    const [rows] = await db.query(query, params);
    res.json({ success: true, orders: rows.map(r => { const j = parseJsonCol(r, 'full_json'); if(r.final_invoice_date) j.finalInvoiceDate = r.final_invoice_date; return j; }), total: cnt[0].t, page: Number(page), pages: Math.ceil(cnt[0].t / Number(limit)) });
}));

router.put('/status', withDb(async (req, res, db) => {
    const { ids, status, notifyCustomer } = req.body;
    let sql = `UPDATE orders SET status=?, full_json=JSON_SET(full_json, '$.status', ?)`;
    if (status === 'delivered') sql += `, final_invoice_date = IF(final_invoice_date IS NULL, NOW(), final_invoice_date), full_json = JSON_SET(full_json, '$.finalInvoiceDate', DATE_FORMAT(IF(final_invoice_date IS NULL, NOW(), final_invoice_date), '%Y-%m-%dT%H:%i:%s.000Z'))`;
    sql += ` WHERE id IN (${ids.map(()=>'?').join(',')})`;
    await db.query(sql, [status, status, ...ids]);
    
    if (notifyCustomer) {
        // Fetch full order data for emails
        const [rows] = await db.query(`SELECT full_json FROM orders WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
        const [sRows] = await db.query('SELECT data FROM app_settings WHERE key_name = "global"');
        const settings = sRows.length ? parseJsonCol(sRows[0]) : {};

        for(const r of rows) {
            const o = parseJsonCol(r, 'full_json');
            // If delivered, we need the finalInvoiceDate which might have been just set
            if (status === 'delivered' && !o.finalInvoiceDate) {
                o.finalInvoiceDate = new Date().toISOString(); 
            }
            await sendOrderEmail(o, 'status', settings, status);
        }
    }
    res.json({ success: true });
}));

export default router;
