
import express from 'express';
import { withDb, parseJsonCol } from '../db.js';

const router = express.Router();

router.get('/', withDb(async (req, res, db) => {
    // 1. Users
    const [uRows] = await db.query('SELECT * FROM users');
    const users = [];
    for (const row of uRows) {
        const [addrs] = await db.query('SELECT * FROM user_addresses WHERE user_id = ?', [row.id]);
        users.push({
            id: row.id, email: row.email, name: row.name, phone: row.phone, role: row.role,
            isBlocked: Boolean(row.is_blocked), marketingConsent: Boolean(row.marketing_consent),
            passwordHash: row.password_hash,
            deliveryAddresses: addrs.filter(a => a.type === 'delivery'),
            billingAddresses: addrs.filter(a => a.type === 'billing')
        });
    }

    // 2. Products
    const [pRows] = await db.query('SELECT full_json FROM products WHERE is_deleted = FALSE');
    const products = pRows.map(r => parseJsonCol(r, 'full_json'));

    // 3. Orders (Limit history to keep bootstrap light if needed, currently loading all active for logic)
    const [oRows] = await db.query('SELECT full_json, final_invoice_date FROM orders ORDER BY delivery_date DESC LIMIT 500');
    const orders = oRows.map(r => {
        const o = parseJsonCol(r, 'full_json');
        if (r.final_invoice_date) o.finalInvoiceDate = r.final_invoice_date;
        return o;
    });

    // 4. Settings
    const [sRows] = await db.query('SELECT data FROM app_settings WHERE key_name = "global"');
    const settings = sRows.length > 0 ? parseJsonCol(sRows[0]) : null;

    // 5. Discounts
    const [dRows] = await db.query('SELECT data FROM discounts');
    const discountCodes = dRows.map(r => parseJsonCol(r));

    // 6. Calendar
    const [cRows] = await db.query('SELECT data FROM calendar_exceptions');
    const dayConfigs = cRows.map(r => parseJsonCol(r));

    res.json({
        success: true,
        users,
        products,
        orders,
        settings,
        discountCodes,
        dayConfigs
    });
}));

export default router;
