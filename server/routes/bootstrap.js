
import express from 'express';
import { withDb, parseJsonCol } from '../db.js';
import jwt from '../services/jwt.js';

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';

// Helper to fetch user details with addresses
const fetchUsersWithAddresses = async (db, condition = '1=1', params = []) => {
    const [uRows] = await db.query(`SELECT * FROM users WHERE ${condition}`, params);
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
    return users;
};

router.get('/', withDb(async (req, res, db) => {
    // 1. Soft Authentication (Verify token if present)
    let user = null;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            await new Promise((resolve) => {
                jwt.verify(token, SECRET_KEY, (err, decoded) => {
                    if (!err) user = decoded;
                    resolve();
                });
            });
        } catch (e) { 
            // Token invalid or expired - treat as Guest
        }
    }

    const isAdmin = user?.role === 'admin';
    const isCustomer = user?.role === 'customer' || user?.role === 'driver';

    const response = {
        users: [],
        orders: [],
        products: [],
        settings: null,
        discountCodes: [],
        dayConfigs: []
    };

    // --- PUBLIC DATA (Available to Everyone) ---

    // 1. Products (Needed for Menu)
    const [pRows] = await db.query('SELECT full_json FROM products WHERE is_deleted = FALSE');
    response.products = pRows.map(r => parseJsonCol(r, 'full_json'));

    // 2. Settings (Needed for basic app config like payment methods, contacts)
    const [sRows] = await db.query('SELECT data FROM app_settings WHERE key_name = "global"');
    response.settings = sRows.length > 0 ? parseJsonCol(sRows[0]) : null;

    // 3. Calendar (Needed for availability check in Cart)
    const [cRows] = await db.query('SELECT data FROM calendar_exceptions');
    response.dayConfigs = cRows.map(r => parseJsonCol(r));


    // --- SENSITIVE DATA (Role Based) ---

    if (isAdmin) {
        // ADMIN: Load Everything
        
        // Users
        response.users = await fetchUsersWithAddresses(db);

        // Orders (Recent history)
        const [oRows] = await db.query('SELECT full_json, final_invoice_date FROM orders ORDER BY delivery_date DESC LIMIT 500');
        response.orders = oRows.map(r => {
            const o = parseJsonCol(r, 'full_json');
            if (r.final_invoice_date) o.finalInvoiceDate = r.final_invoice_date;
            return o;
        });

        // Discount Codes
        const [dRows] = await db.query('SELECT data FROM discounts');
        response.discountCodes = dRows.map(r => parseJsonCol(r));

    } else if (isCustomer) {
        // CUSTOMER: Load only own data
        
        // Own User Profile
        response.users = await fetchUsersWithAddresses(db, 'id = ?', [user.id]);

        // Own Orders
        const [oRows] = await db.query('SELECT full_json, final_invoice_date FROM orders WHERE user_id = ? ORDER BY delivery_date DESC LIMIT 100', [user.id]);
        response.orders = oRows.map(r => {
            const o = parseJsonCol(r, 'full_json');
            if (r.final_invoice_date) o.finalInvoiceDate = r.final_invoice_date;
            return o;
        });

        // Discounts: Do NOT send full list. Validation happens on backend.
        response.discountCodes = []; 
    }
    
    // GUESTS: Receive empty users, orders, discountCodes.

    res.json({
        success: true,
        ...response
    });
}));

export default router;
