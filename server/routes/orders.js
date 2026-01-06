
import express from 'express';
import { withDb, parseJsonCol } from '../db.js';
import { queueOrderEmail } from '../services/email.js'; // CHANGED

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
             try {
                 const [sRows] = await db.query('SELECT data FROM app_settings WHERE key_name = "global"');
                 const settings = sRows.length > 0 ? parseJsonCol(sRows[0]) : {};
                 await queueOrderEmail(order, 'updated', settings); // QUEUED
             } catch(e) {
                 console.error("Failed to queue update email:", e);
             }
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

        // Email Trigger
        try {
            const [sRows] = await db.query('SELECT data FROM app_settings WHERE key_name = "global"');
            const settings = sRows.length > 0 ? parseJsonCol(sRows[0]) : {};
            console.log(`📧 Queueing CREATED email for order #${order.id}`);
            await queueOrderEmail(order, 'created', settings); // QUEUED
        } catch (e) {
            console.error("❌ Critical: Failed to queue order created email:", e);
        }
    }
    res.json({ success: true });
}));

router.put('/status', withDb(async (req, res, db) => {
    const { ids, status, notifyCustomer, deliveryCompanyDetailsSnapshot } = req.body;
    
    // 1. Batch update status column in DB
    await db.query('UPDATE orders SET status = ? WHERE id IN (?)', [status, ids]);
    
    const nowIso = new Date().toISOString();

    // 2. If status is DELIVERED, set final_invoice_date column if not set
    if (status === 'delivered') {
        const nowDb = nowIso.slice(0, 19).replace('T', ' '); // Format for MySQL: YYYY-MM-DD HH:MM:SS
        await db.query('UPDATE orders SET final_invoice_date = ? WHERE id IN (?) AND final_invoice_date IS NULL', [nowDb, ids]);
    }

    // 3. Update full_json blob for ALL affected orders to reflect the new status
    const [orders] = await db.query('SELECT id, full_json, final_invoice_date FROM orders WHERE id IN (?)', [ids]);
    
    for(const o of orders) {
        let json = parseJsonCol(o, 'full_json');
        
        // Always update status in JSON
        json.status = status;
        if (!json.statusHistory) json.statusHistory = [];
        json.statusHistory.push({ status, date: nowIso });

        // Additional logic for DELIVERED status
        if (status === 'delivered') {
            // Only update snapshot if not already present
            if (!json.deliveryCompanyDetailsSnapshot && deliveryCompanyDetailsSnapshot) {
                json.deliveryCompanyDetailsSnapshot = deliveryCompanyDetailsSnapshot;
            }
            // Ensure finalInvoiceDate is in JSON too
            if (!json.finalInvoiceDate) {
                // Use existing from DB (if present) or now
                json.finalInvoiceDate = o.final_invoice_date 
                    ? new Date(o.final_invoice_date).toISOString() 
                    : nowIso;
            }
        }

        await db.query('UPDATE orders SET full_json = ? WHERE id = ?', [JSON.stringify(json), o.id]);
    }

    // 4. Notifications
    if (notifyCustomer) {
        const [sRows] = await db.query('SELECT data FROM app_settings WHERE key_name = "global"');
        const settings = sRows.length > 0 ? parseJsonCol(sRows[0]) : {};
        
        // Re-iterate (or use cached data) to send emails
        for (const r of orders) {
            const o = parseJsonCol(r, 'full_json');
            // Patch current status for email template if we used cached object
            o.status = status;
            if (r.final_invoice_date) o.finalInvoiceDate = r.final_invoice_date;
            
            if (status === 'delivered' && !o.deliveryCompanyDetailsSnapshot && deliveryCompanyDetailsSnapshot) {
                o.deliveryCompanyDetailsSnapshot = deliveryCompanyDetailsSnapshot;
            }
            try {
                await queueOrderEmail(o, 'status', settings, status); // QUEUED
            } catch (e) {
                console.error(`Failed to queue status update email for order ${o.id}:`, e);
            }
        }
    }
    
    res.json({ success: true });
}));

export default router;
