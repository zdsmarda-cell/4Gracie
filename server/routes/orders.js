
import express from 'express';
import { withDb, parseJsonCol } from '../db.js';
import { queueOrderEmail } from '../services/email.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import webpush from 'web-push';

const router = express.Router();

const STATUS_TRANSLATIONS = {
    cs: { created: 'Zadaná', confirmed: 'Potvrzená', preparing: 'Připravuje se', ready: 'Připravena', on_way: 'Na cestě', delivered: 'Doručena', not_picked_up: 'Nedoručena/Nevyzvednuta', cancelled: 'Stornována' },
    en: { created: 'Created', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready', on_way: 'On the way', delivered: 'Delivered', not_picked_up: 'Not picked up', cancelled: 'Cancelled' },
    de: { created: 'Erstellt', confirmed: 'Bestätigt', preparing: 'In Vorbereitung', ready: 'Bereit', on_way: 'Unterwegs', delivered: 'Geliefert', not_picked_up: 'Nicht abgeholt', cancelled: 'Storniert' }
};

// Get Orders - Protected (Any logged in user can try, ideally filter by ID for non-admins, but simplistic auth for now)
router.get('/', authenticateToken, withDb(async (req, res, db) => {
    const { id, dateFrom, dateTo, userId, status, customer, isEvent, isPaid, page = 1, limit = 50 } = req.query;
    
    // Security: If user is not admin, FORCE userId filter to their own ID
    let safeUserId = userId;
    if (req.user.role !== 'admin') {
        safeUserId = req.user.id;
    }

    const offset = (Number(page) - 1) * Number(limit);
    let query = 'SELECT full_json, final_invoice_date FROM orders WHERE 1=1';
    const params = [];
    if (id) { query += ' AND id LIKE ?'; params.push(`%${id}%`); }
    if (safeUserId) { query += ' AND user_id = ?'; params.push(safeUserId); }
    if (dateFrom) { query += ' AND delivery_date >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND delivery_date <= ?'; params.push(dateTo); }
    
    if (status) { 
        const statuses = status.split(',').filter(s => s.trim() !== '');
        if (statuses.length > 0) {
            query += ' AND status IN (?)'; 
            params.push(statuses); 
        }
    }
    
    if (isPaid === 'yes') { query += ' AND is_paid = 1'; }
    if (isPaid === 'no') { query += ' AND is_paid = 0'; }
    
    if (customer) { query += ' AND user_name LIKE ?'; params.push(`%${customer}%`); }
    
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

// Create/Update Order - Protected
router.post('/', authenticateToken, withDb(async (req, res, db) => {
    const order = req.body;
    
    // Security check: User can only edit own orders unless admin
    if (req.user.role !== 'admin' && order.userId !== req.user.id) {
        return res.status(403).json({ error: 'Nemáte oprávnění upravovat cizí objednávky.' });
    }

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
        
        if (req.body.sendNotify) {
             try {
                 const [sRows] = await db.query('SELECT data FROM app_settings WHERE key_name = "global"');
                 const settings = sRows.length > 0 ? parseJsonCol(sRows[0]) : {};
                 await queueOrderEmail(order, 'updated', settings);
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
        
        if (order.items && order.items.length > 0) {
            const itemValues = order.items.map(i => [
                null, order.id, i.id, i.name, i.quantity, i.price, i.category || 'unknown', i.unit, i.workload || 0, i.workloadOverhead || 0
            ]);
            await db.query('INSERT INTO order_items (id, order_id, product_id, name, quantity, price, category, unit, workload, workload_overhead) VALUES ?', [itemValues]);
        }

        try {
            const [sRows] = await db.query('SELECT data FROM app_settings WHERE key_name = "global"');
            const settings = sRows.length > 0 ? parseJsonCol(sRows[0]) : {};
            await queueOrderEmail(order, 'created', settings);
        } catch (e) {
            console.error("❌ Critical: Failed to queue order created email:", e);
        }
    }
    res.json({ success: true });
}));

// Status Updates - Admin/Driver Only
router.put('/status', authenticateToken, withDb(async (req, res, db) => {
    // Drivers can typically mark delivered, Admins everything. For simplicity, allow authenticated users with roles.
    if (req.user.role === 'customer') {
        return res.status(403).json({ error: 'Zákazníci nemohou měnit stav objednávky.' });
    }

    const { ids, status, notifyCustomer, sendPush, deliveryCompanyDetailsSnapshot } = req.body;
    
    await db.query('UPDATE orders SET status = ? WHERE id IN (?)', [status, ids]);
    
    const nowIso = new Date().toISOString();

    if (status === 'delivered') {
        const nowDb = nowIso.slice(0, 19).replace('T', ' '); 
        await db.query('UPDATE orders SET final_invoice_date = ? WHERE id IN (?) AND final_invoice_date IS NULL', [nowDb, ids]);
    }

    const [orders] = await db.query('SELECT id, user_id, full_json, final_invoice_date FROM orders WHERE id IN (?)', [ids]);
    
    // Check if webpush is configured
    const canPush = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY;
    if (canPush) {
        try {
            webpush.setVapidDetails(
                `mailto:${process.env.EMAIL_FROM || 'info@4gracie.cz'}`,
                process.env.VAPID_PUBLIC_KEY,
                process.env.VAPID_PRIVATE_KEY
            );
        } catch (confErr) {
            console.error("❌ WebPush Config Error:", confErr.message);
        }
    }

    for(const o of orders) {
        let json = parseJsonCol(o, 'full_json');
        
        json.status = status;
        if (!json.statusHistory) json.statusHistory = [];
        json.statusHistory.push({ status, date: nowIso });

        if (status === 'delivered') {
            if (!json.deliveryCompanyDetailsSnapshot && deliveryCompanyDetailsSnapshot) {
                json.deliveryCompanyDetailsSnapshot = deliveryCompanyDetailsSnapshot;
            }
            if (!json.finalInvoiceDate) {
                json.finalInvoiceDate = o.final_invoice_date 
                    ? new Date(o.final_invoice_date).toISOString() 
                    : nowIso;
            }
        }

        await db.query('UPDATE orders SET full_json = ? WHERE id = ?', [JSON.stringify(json), o.id]);

        // --- PUSH NOTIFICATION LOGIC ---
        if (sendPush && canPush && o.user_id) {
            const [subs] = await db.query('SELECT * FROM push_subscriptions WHERE user_id = ?', [o.user_id]);
            if (subs.length > 0) {
                // Determine language and translate status
                const lang = json.language || 'cs';
                const translatedStatus = STATUS_TRANSLATIONS[lang]?.[status] || status;
                
                const pushTitle = `Změna stavu objednávky #${o.id}`;
                const pushBody = `Vaše objednávka je nyní ve stavu: ${translatedStatus}`;

                const payload = JSON.stringify({
                    title: pushTitle,
                    body: pushBody,
                    url: '/profile'
                });

                for (const sub of subs) {
                    try {
                        await webpush.sendNotification({
                            endpoint: sub.endpoint,
                            keys: { p256dh: sub.p256dh, auth: sub.auth }
                        }, payload);

                        // LOG SUCCESS TO DB
                        await db.query(
                            'INSERT INTO push_logs (user_id, title, body, status) VALUES (?, ?, ?, ?)',
                            [o.user_id, pushTitle, pushBody, 'sent']
                        );

                    } catch (err) {
                        const errMsg = err.body ? `${err.statusCode}: ${err.body}` : (err.message || 'Unknown error');
                        console.error(`Push failed for ${o.id}:`, errMsg);

                        // LOG ERROR TO DB
                        await db.query(
                            'INSERT INTO push_logs (user_id, title, body, status, error_message) VALUES (?, ?, ?, ?, ?)',
                            [o.user_id, pushTitle, pushBody, 'error', errMsg]
                        );

                        if (err.statusCode === 410 || err.statusCode === 404) {
                            db.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
                        }
                    }
                }
            }
        }
    }

    if (notifyCustomer) {
        const [sRows] = await db.query('SELECT data FROM app_settings WHERE key_name = "global"');
        const settings = sRows.length > 0 ? parseJsonCol(sRows[0]) : {};
        
        for (const r of orders) {
            const o = parseJsonCol(r, 'full_json');
            o.status = status;
            if (r.final_invoice_date) o.finalInvoiceDate = r.final_invoice_date;
            
            if (status === 'delivered' && !o.deliveryCompanyDetailsSnapshot && deliveryCompanyDetailsSnapshot) {
                o.deliveryCompanyDetailsSnapshot = deliveryCompanyDetailsSnapshot;
            }
            try {
                await queueOrderEmail(o, 'status', settings, status);
            } catch (e) {
                console.error(`Failed to queue status update email for order ${o.id}:`, e);
            }
        }
    }
    
    res.json({ success: true });
}));

export default router;
