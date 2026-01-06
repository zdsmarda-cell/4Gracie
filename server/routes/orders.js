
import express from 'express';
import { withDb, parseJsonCol } from '../db.js';
import { sendOrderEmail } from '../services/email.js';

const router = express.Router();

router.get('/', withDb(async (req, res, db) => {
    const { id, dateFrom, dateTo, userId, status, customer, isEvent, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let query = 'SELECT full_json, final_invoice_date FROM orders WHERE 1=1';
    const params = [];
    if (id) { query += ' AND id LIKE ?'; params.push(`%${id}%`); }
    if (userId) { query += ' AND user_id = ?'; params.push(userId); }
    if (dateFrom) { query += ' AND delivery_date >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND delivery_date <= ?'; params.push(dateTo); }
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (customer) { query += ' AND user_name LIKE ?'; params.push(`%${customer}%`); }
    
    // Heuristic JSON search for Event Product flag
    if (isEvent === 'yes') { 
        query += ` AND full_json LIKE '%"isEventProduct":true%'`; 
    } else if (isEvent === 'no') {
        query += ` AND full_json NOT LIKE '%"isEventProduct":true%'`; 
    }
    
    const [cnt] = await db.query(query.replace('SELECT full_json, final_invoice_date', 'SELECT COUNT(*) as t'), params);
    query += ' ORDER BY delivery_date DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    
    const [rows] = await db.query(query, params);
    res.json({ success: true, orders: rows.map(r => { const j = parseJsonCol(r, 'full_json'); if(r.final_invoice_date) j.finalInvoiceDate = r.final_invoice_date; return j; }), total: cnt[0].t, page: Number(page), pages: Math.ceil(cnt[0].t / Number(limit)) });
}));

router.post('/', withDb(async (req, res, db) => {
    const order = req.body;
    const isUpdate = await db.query('SELECT id FROM orders WHERE id = ?', [order.id]).then(([rows]) => rows.length > 0);
    const jsonStr = JSON.stringify(order);
    
    if (isUpdate) {
        await db.query(
            `UPDATE orders SET 
            delivery_date=?, status=?, total_price=?, delivery_fee=?, packaging_fee=?, 
            payment_method=?, is_paid=?, delivery_type=?, delivery_name=?, delivery_street=?, 
            delivery_city=?, delivery_zip=?, delivery_phone=?, billing_name=?, billing_street=?, 
            billing_city=?, billing_zip=?, billing_ic=?, billing_dic=?, note=?, pickup_location_id=?, 
            language=?, full_json=? WHERE id=?`,
            [
                order.deliveryDate, order.status, order.totalPrice, order.deliveryFee, order.packagingFee,
                order.paymentMethod, order.isPaid, order.deliveryType, order.deliveryName, order.deliveryStreet,
                order.deliveryCity, order.deliveryZip, order.deliveryPhone, order.billingName, order.billingStreet,
                order.billingCity, order.billingZip, order.billingIc, order.billingDic, order.note, order.pickupLocationId,
                order.language, jsonStr, order.id
            ]
        );
        
        // Handle User Edit Notification or general update
        if (req.body.sendNotify) {
             const [sRows] = await db.query('SELECT data FROM app_settings WHERE key_name = "global"');
             const settings = sRows.length > 0 ? parseJsonCol(sRows[0]) : {};
             sendOrderEmail(order, 'updated', settings);
        }

    } else {
        await db.query(
            `INSERT INTO orders (
            id, user_id, user_name, delivery_date, status, total_price, delivery_fee, packaging_fee,
            payment_method, is_paid, delivery_type, delivery_name, delivery_street, delivery_city,
            delivery_zip, delivery_phone, billing_name, billing_street, billing_city, billing_zip,
            billing_ic, billing_dic, note, pickup_location_id, language, full_json
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                order.id, order.userId, order.userName, order.deliveryDate, order.status, order.totalPrice, order.deliveryFee, order.packagingFee,
                order.paymentMethod, order.isPaid, order.deliveryType, order.deliveryName, order.deliveryStreet, order.deliveryCity,
                order.deliveryZip, order.deliveryPhone, order.billingName, order.billingStreet, order.billingCity, order.billingZip,
                order.billingIc, order.billingDic, order.note, order.pickupLocationId, order.language, jsonStr
            ]
        );
        
        // Insert items
        if (order.items && order.items.length > 0) {
            const itemValues = order.items.map(i => [
                null, order.id, i.id, i.name, i.quantity, i.price, i.category || 'unknown', i.unit, i.workload || 0, i.workloadOverhead || 0
            ]);
            await db.query('INSERT INTO order_items (id, order_id, product_id, name, quantity, price, category, unit, workload, workload_overhead) VALUES ?', [itemValues]);
        }

        const [sRows] = await db.query('SELECT data FROM app_settings WHERE key_name = "global"');
        const settings = sRows.length > 0 ? parseJsonCol(sRows[0]) : {};
        sendOrderEmail(order, 'created', settings);
    }
    res.json({ success: true });
}));

router.put('/status', withDb(async (req, res, db) => {
    const { ids, status, notifyCustomer, deliveryCompanyDetailsSnapshot } = req.body;
    
    // Batch update status
    await db.query('UPDATE orders SET status = ? WHERE id IN (?)', [status, ids]);
    
    // If status is DELIVERED, verify if finalInvoiceDate needs setting and update JSON snapshot
    if (status === 'delivered') {
        const nowIso = new Date().toISOString();
        const nowDb = nowIso.slice(0, 19).replace('T', ' '); // Format for MySQL: YYYY-MM-DD HH:MM:SS
        
        // 1. Set final_invoice_date only if NULL
        await db.query('UPDATE orders SET final_invoice_date = ? WHERE id IN (?) AND final_invoice_date IS NULL', [nowDb, ids]);
        
        // 2. Fetch current full_json for affected orders to patch the snapshot
        const [orders] = await db.query('SELECT id, full_json, final_invoice_date FROM orders WHERE id IN (?)', [ids]);
        
        for(const o of orders) {
            let json = parseJsonCol(o, 'full_json');
            
            // Only update snapshot if not already present
            if (!json.deliveryCompanyDetailsSnapshot && deliveryCompanyDetailsSnapshot) {
                json.deliveryCompanyDetailsSnapshot = deliveryCompanyDetailsSnapshot;
            }
            // Ensure finalInvoiceDate is in JSON too
            if (!json.finalInvoiceDate && o.final_invoice_date) {
                json.finalInvoiceDate = o.final_invoice_date;
            } else if (!json.finalInvoiceDate) {
                json.finalInvoiceDate = nowIso;
            }

            await db.query('UPDATE orders SET full_json = ? WHERE id = ?', [JSON.stringify(json), o.id]);
        }
    } else {
        // Just update status history in JSON for other statuses
        const [orders] = await db.query('SELECT id, full_json FROM orders WHERE id IN (?)', [ids]);
        for(const o of orders) {
            let json = parseJsonCol(o, 'full_json');
            json.status = status;
            if (!json.statusHistory) json.statusHistory = [];
            json.statusHistory.push({ status, date: new Date().toISOString() });
            await db.query('UPDATE orders SET full_json = ? WHERE id = ?', [JSON.stringify(json), o.id]);
        }
    }

    if (notifyCustomer) {
        const [sRows] = await db.query('SELECT data FROM app_settings WHERE key_name = "global"');
        const settings = sRows.length > 0 ? parseJsonCol(sRows[0]) : {};
        const [orders] = await db.query('SELECT full_json, final_invoice_date FROM orders WHERE id IN (?)', [ids]);
        
        for (const r of orders) {
            const o = parseJsonCol(r, 'full_json');
            if(r.final_invoice_date) o.finalInvoiceDate = r.final_invoice_date;
            // If snapshot was just added in loop above, it might be in DB but not in this select unless transaction is strict, 
            // but for email we pass the explicit snapshot if we have it from request body or rely on updated object.
            if (status === 'delivered' && !o.deliveryCompanyDetailsSnapshot && deliveryCompanyDetailsSnapshot) {
                o.deliveryCompanyDetailsSnapshot = deliveryCompanyDetailsSnapshot;
            }
            sendOrderEmail(o, 'status', settings, status);
        }
    }
    
    res.json({ success: true });
}));

export default router;
