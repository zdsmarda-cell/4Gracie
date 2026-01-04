
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIG LOADING ---
const pathsToCheck = [
  path.resolve(__dirname, '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '..', '.env')
];

let envLoaded = false;
for (const p of pathsToCheck) {
  if (fs.existsSync(p)) {
    console.log(`✅ FOUND config file at: ${p}`);
    dotenv.config({ path: p });
    envLoaded = true;
    break;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(cors());

// Increase payload limit for Base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Debug middleware to log request sizes (optional)
app.use((req, res, next) => {
    if (req.path === '/api/admin/upload' || req.path === '/api/products') {
        // console.log(`[${req.method}] ${req.path} - Payload size: ${req.headers['content-length']} bytes`);
    }
    next();
});

// --- STATIC FILES & UPLOAD CONFIG ---
const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const UPLOAD_IMAGES_DIR = path.join(UPLOAD_ROOT, 'images');

console.log(`📂 Upload Root configured at: ${UPLOAD_ROOT}`);

// Ensure directories exist
if (!fs.existsSync(UPLOAD_IMAGES_DIR)) {
    try {
        fs.mkdirSync(UPLOAD_IMAGES_DIR, { recursive: true, mode: 0o777 });
        console.log(`✅ Created upload directories.`);
    } catch (e) {
        console.error(`❌ Failed to create upload directory: ${e.message}`);
    }
}

// Serve static files from the project root 'uploads' folder
app.use('/uploads', express.static(UPLOAD_ROOT));

// --- EMAIL ---
let transporter = null;
if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 465,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: false }
    });
    console.log('📧 SMTP Configured.');
} else {
    console.warn('⚠️ SMTP Config Missing - Emails will not be sent.');
}

// --- DATABASE CONNECTION ---
let pool = null;
let sqlDebugMode = false; // GLOBAL DEBUG FLAG

const getDb = async () => {
  if (pool) return pool;
  try {
    if (!process.env.DB_HOST) throw new Error("DB_HOST missing");
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || '4gracie_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true 
    });

    // MONKEY PATCH POOL.QUERY for Debugging
    const originalQuery = pool.query;
    pool.query = function (sql, params) {
        if (sqlDebugMode) {
            const sqlString = typeof sql === 'string' ? sql : sql.sql;
            console.log(`\x1b[36m[SQL]\x1b[0m ${sqlString}`, params && params.length > 0 ? params : '');
        }
        return originalQuery.apply(this, arguments);
    };

    return pool;
  } catch (err) {
    console.error(`❌ DB Connection Failed: ${err.message}`);
    return null;
  }
};

// --- HELPER FUNCTIONS ---
const formatToMysqlDateTime = (isoDateString) => {
    if (!isoDateString) return new Date().toISOString().slice(0, 19).replace('T', ' ');
    try {
        if (isoDateString.length === 10) return isoDateString; 
        return new Date(isoDateString).toISOString().slice(0, 19).replace('T', ' ');
    } catch (e) {
        return new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
};

const formatToMysqlDate = (dateString) => {
    if (!dateString) return new Date().toISOString().split('T')[0];
    try {
        return new Date(dateString).toISOString().split('T')[0];
    } catch (e) {
        return dateString;
    }
};

const parseJsonCol = (row, colName = 'data') => {
    return typeof row[colName] === 'string' ? JSON.parse(row[colName]) : (row[colName] || {});
};

// --- INITIALIZATION & SEEDING ---
const initDb = async () => {
    const db = await getDb();
    if (!db) return;

    try {
        // Tables Initialization
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(50) PRIMARY KEY,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                name VARCHAR(100),
                phone VARCHAR(20),
                role VARCHAR(20) DEFAULT 'customer',
                is_blocked BOOLEAN DEFAULT FALSE,
                marketing_consent BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS user_addresses (
                id VARCHAR(50) PRIMARY KEY,
                user_id VARCHAR(50),
                type VARCHAR(20),
                name VARCHAR(100),
                street VARCHAR(255),
                city VARCHAR(100),
                zip VARCHAR(20),
                phone VARCHAR(20),
                ic VARCHAR(20),
                dic VARCHAR(20),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS products (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10,2),
                unit VARCHAR(10),
                category VARCHAR(50),
                workload INT DEFAULT 0,
                workload_overhead INT DEFAULT 0,
                vat_rate_inner DECIMAL(5,2),
                vat_rate_takeaway DECIMAL(5,2),
                is_deleted BOOLEAN DEFAULT FALSE,
                image_url TEXT,
                full_json JSON,
                INDEX idx_category (category)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id VARCHAR(50) PRIMARY KEY,
                user_id VARCHAR(50),
                user_name VARCHAR(255),
                delivery_date DATE,
                status VARCHAR(50),
                total_price DECIMAL(10,2),
                delivery_fee DECIMAL(10,2),
                packaging_fee DECIMAL(10,2),
                payment_method VARCHAR(50),
                is_paid BOOLEAN DEFAULT FALSE,
                delivery_type VARCHAR(50),
                delivery_address TEXT,
                billing_address TEXT,
                note TEXT,
                pickup_location_id VARCHAR(100),
                language VARCHAR(10),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                full_json JSON,
                INDEX idx_date (delivery_date),
                INDEX idx_status (status),
                INDEX idx_user (user_id)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(50),
                product_id VARCHAR(50),
                name VARCHAR(255),
                quantity INT,
                price DECIMAL(10,2),
                category VARCHAR(50),
                unit VARCHAR(20),
                workload INT,
                workload_overhead INT,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                INDEX idx_order (order_id),
                INDEX idx_category (category)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);

        await db.query(`CREATE TABLE IF NOT EXISTS app_settings (key_name VARCHAR(50) PRIMARY KEY, data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await db.query(`CREATE TABLE IF NOT EXISTS discounts (id VARCHAR(50) PRIMARY KEY, code VARCHAR(50), data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await db.query(`CREATE TABLE IF NOT EXISTS calendar_exceptions (date VARCHAR(20) PRIMARY KEY, data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

        // Seed Admin
        const [admins] = await db.query('SELECT id FROM users WHERE email = ?', ['info@4gracie.cz']);
        if (admins.length === 0) {
            console.log("🌱 Seeding default admin...");
            const hash = 'hashed_' + Buffer.from('1234').toString('base64');
            await db.query(
                'INSERT INTO users (id, email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?, ?)',
                ['admin_seed', 'info@4gracie.cz', hash, 'admin', 'Hlavní Administrátor', '+420000000000']
            );
        }

        // Load Debug Setting
        const [settings] = await db.query('SELECT data FROM app_settings WHERE key_name = "global"');
        if (settings.length > 0) {
            const data = parseJsonCol(settings[0], 'data');
            if (data.sqlDebug) {
                sqlDebugMode = true;
                console.log("🔧 SQL Debug enabled on startup.");
            }
        }

        console.log("✅ Database initialized.");
    } catch (e) {
        console.error("❌ Init DB Error:", e);
    }
};
initDb();

const withDb = (handler) => async (req, res) => {
  const db = await getDb();
  if (db) {
    try { await handler(req, res, db); } 
    catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
  } else {
    res.status(500).json({ error: 'DB Connection Failed' });
  }
};

// --- API ENDPOINTS ---

// Helper mapping for Czech Statuses in Emails
const STATUS_TRANSLATIONS = {
    'created': 'Zadaná',
    'confirmed': 'Potvrzená',
    'preparing': 'Připravuje se',
    'ready': 'Připravena',
    'on_way': 'Na cestě',
    'delivered': 'Doručena',
    'not_picked_up': 'Nevyzvednuta',
    'cancelled': 'Stornována'
};

// 1. BOOTSTRAP
app.get('/api/bootstrap', withDb(async (req, res, db) => {
    const [prodRows] = await db.query('SELECT * FROM products WHERE is_deleted = FALSE');
    const products = prodRows.map(row => ({
        ...parseJsonCol(row, 'full_json'),
        id: row.id,
        name: row.name,
        description: row.description,
        price: Number(row.price),
        unit: row.unit,
        category: row.category,
        workload: row.workload,
        workloadOverhead: row.workload_overhead,
        vatRateInner: Number(row.vat_rate_inner),
        vatRateTakeaway: Number(row.vat_rate_takeaway),
        volume: Number(parseJsonCol(row, 'full_json').volume || 0),
        images: row.image_url ? [row.image_url, ...(parseJsonCol(row, 'full_json').images || []).slice(1)] : []
    }));

    const [settings] = await db.query('SELECT * FROM app_settings WHERE key_name = "global"');
    const [discounts] = await db.query('SELECT * FROM discounts');
    const [calendar] = await db.query('SELECT * FROM calendar_exceptions');
    
    const today = new Date().toISOString().split('T')[0];
    const [activeOrders] = await db.query('SELECT full_json FROM orders WHERE delivery_date >= ? AND status != "cancelled"', [today]);

    res.json({
        products,
        settings: settings.length ? parseJsonCol(settings[0]) : null,
        discountCodes: discounts.map(r => ({...parseJsonCol(r), id: r.id})),
        dayConfigs: calendar.map(r => ({...parseJsonCol(r), date: r.date})),
        orders: activeOrders.map(r => parseJsonCol(r, 'full_json')),
        users: [] // Don't send all users in bootstrap for security/performance
    });
}));

// 2. PRODUCTS
app.post('/api/products', withDb(async (req, res, db) => {
    const p = req.body;
    const fullJson = JSON.stringify(p);
    const mainImage = p.images && p.images.length > 0 ? p.images[0] : null;

    await db.query(`
        INSERT INTO products (
            id, name, description, price, unit, category, workload, workload_overhead, 
            vat_rate_inner, vat_rate_takeaway, image_url, full_json, is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            name=?, description=?, price=?, unit=?, category=?, workload=?, workload_overhead=?, 
            vat_rate_inner=?, vat_rate_takeaway=?, image_url=?, full_json=?, is_deleted=?
    `, [
        p.id, p.name, p.description, p.price, p.unit, p.category, p.workload, p.workloadOverhead,
        p.vatRateInner, p.vatRateTakeaway, mainImage, fullJson, false,
        p.name, p.description, p.price, p.unit, p.category, p.workload, p.workloadOverhead,
        p.vatRateInner, p.vatRateTakeaway, mainImage, fullJson, false
    ]);
    res.status(200).json({ success: true });
}));

app.delete('/api/products/:id', withDb(async (req, res, db) => {
    await db.query('UPDATE products SET is_deleted = TRUE WHERE id = ?', [req.params.id]);
    res.json({ success: true });
}));

// 3. USERS
app.get('/api/users', withDb(async (req, res, db) => {
    const { search } = req.query;
    let query = 'SELECT * FROM users WHERE 1=1';
    const params = [];
    
    if (search) {
        query += ' AND (email LIKE ? OR name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    query += ' LIMIT 100';

    const [rows] = await db.query(query, params);
    const users = [];
    for (const row of rows) {
        const [addrs] = await db.query('SELECT * FROM user_addresses WHERE user_id = ?', [row.id]);
        users.push({
            id: row.id,
            email: row.email,
            name: row.name,
            phone: row.phone,
            role: row.role,
            isBlocked: Boolean(row.is_blocked),
            marketingConsent: Boolean(row.marketing_consent),
            passwordHash: row.password_hash,
            deliveryAddresses: addrs.filter(a => a.type === 'delivery'),
            billingAddresses: addrs.filter(a => a.type === 'billing')
        });
    }
    res.json({ success: true, users });
}));

app.post('/api/users', withDb(async (req, res, db) => {
    const u = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(`
            INSERT INTO users (id, email, password_hash, name, phone, role, is_blocked, marketing_consent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            email=?, password_hash=?, name=?, phone=?, role=?, is_blocked=?, marketing_consent=?
        `, [
            u.id, u.email, u.passwordHash, u.name, u.phone, u.role, u.isBlocked, u.marketingConsent,
            u.email, u.passwordHash, u.name, u.phone, u.role, u.isBlocked, u.marketingConsent
        ]);

        await conn.query('DELETE FROM user_addresses WHERE user_id = ?', [u.id]);
        const addresses = [
            ...(u.deliveryAddresses || []).map(a => ({...a, type: 'delivery'})),
            ...(u.billingAddresses || []).map(a => ({...a, type: 'billing'}))
        ];
        
        if (addresses.length > 0) {
            const values = addresses.map(a => [
                a.id || Date.now() + Math.random(), u.id, a.type, a.name, a.street, a.city, a.zip, a.phone, a.ic || null, a.dic || null
            ]);
            await conn.query(
                'INSERT INTO user_addresses (id, user_id, type, name, street, city, zip, phone, ic, dic) VALUES ?',
                [values]
            );
        }
        await conn.commit();
        res.json({ success: true });
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}));

app.post('/api/auth/login', withDb(async (req, res, db) => {
    const { email } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length > 0) {
        const u = rows[0];
        const [addrs] = await db.query('SELECT * FROM user_addresses WHERE user_id = ?', [u.id]);
        const fullUser = {
            id: u.id,
            email: u.email,
            name: u.name,
            phone: u.phone,
            role: u.role,
            isBlocked: Boolean(u.is_blocked),
            marketingConsent: Boolean(u.marketing_consent),
            passwordHash: u.password_hash,
            deliveryAddresses: addrs.filter(a => a.type === 'delivery'),
            billingAddresses: addrs.filter(a => a.type === 'billing')
        };
        res.json({ success: true, user: fullUser });
    } else {
        res.json({ success: false, message: 'Uživatel nenalezen' });
    }
}));

app.post('/api/auth/reset-password', withDb(async (req, res, db) => {
    const { email } = req.body;
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
        return res.json({ success: true, message: 'Pokud účet existuje, email byl odeslán.' });
    }
    const token = Buffer.from(`${email}-${Date.now()}`).toString('base64');
    
    if (transporter) {
        try {
            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            const host = req.get('host'); 
            const appUrl = process.env.VITE_APP_URL || `${protocol}://${host}`;
            const link = `${appUrl}/#/reset-password?token=${token}`;
            
            await transporter.sendMail({
                from: process.env.SMTP_FROM || '"4Gracie" <info@4gracie.cz>',
                to: email,
                subject: 'Obnova hesla - 4Gracie',
                html: `<p>Klikněte pro obnovu hesla:</p><a href="${link}">${link}</a>`
            });
        } catch (e) { console.error("Email error:", e); }
    }
    res.json({ success: true, message: 'Email odeslán.' });
}));

app.post('/api/auth/reset-password-confirm', withDb(async (req, res, db) => {
    const { token, newPasswordHash } = req.body;
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const email = decoded.substring(0, decoded.lastIndexOf('-'));
        const [result] = await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [newPasswordHash, email]);
        if (result.affectedRows > 0) res.json({ success: true, message: 'Heslo změněno.' });
        else res.json({ success: false, message: 'Uživatel nenalezen.' });
    } catch (e) { res.status(400).json({ success: false, message: 'Chyba.' }); }
}));

// 4. ORDERS & STATS
app.post('/api/orders', withDb(async (req, res, db) => {
    const o = req.body;
    if (!o.id || !o.userId) return res.status(400).json({ error: "Missing fields" });

    const dbOrder = { ...o };
    delete dbOrder.vopPdf; 
    const deliveryDate = formatToMysqlDate(dbOrder.deliveryDate);
    const createdAt = formatToMysqlDateTime(dbOrder.createdAt);

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(`
            INSERT INTO orders (
                id, user_id, user_name, delivery_date, status, total_price, 
                delivery_fee, packaging_fee, payment_method, is_paid, 
                delivery_type, delivery_address, billing_address, note, 
                pickup_location_id, language, created_at, full_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                status=?, total_price=?, delivery_date=?, user_name=?, 
                is_paid=?, delivery_address=?, full_json=?
        `, [
            dbOrder.id, dbOrder.userId, dbOrder.userName, deliveryDate, dbOrder.status, dbOrder.totalPrice,
            dbOrder.deliveryFee, dbOrder.packagingFee, dbOrder.paymentMethod, dbOrder.isPaid,
            dbOrder.deliveryType, dbOrder.deliveryAddress, dbOrder.billingAddress, dbOrder.note,
            dbOrder.pickupLocationId, dbOrder.language, createdAt, JSON.stringify(dbOrder),
            dbOrder.status, dbOrder.totalPrice, deliveryDate, dbOrder.userName,
            dbOrder.isPaid, dbOrder.deliveryAddress, JSON.stringify(dbOrder)
        ]);

        await conn.query('DELETE FROM order_items WHERE order_id = ?', [dbOrder.id]);
        if (dbOrder.items && dbOrder.items.length > 0) {
            const itemValues = dbOrder.items.map(i => [
                dbOrder.id, i.id, i.name, i.quantity, i.price, i.category, i.unit, 
                i.workload || 0, i.workloadOverhead || 0
            ]);
            await conn.query(`
                INSERT INTO order_items (
                    order_id, product_id, name, quantity, price, category, unit, 
                    workload, workload_overhead
                ) VALUES ?
            `, [itemValues]);
        }
        await conn.commit();

        // Email logic can be placed here if needed for creation, similar to status update below
        res.json({ success: true, id: dbOrder.id });
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}));

app.get('/api/orders', withDb(async (req, res, db) => {
    const { id, dateFrom, dateTo, userId, status, customer, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let query = 'SELECT full_json FROM orders WHERE 1=1';
    const params = [];

    if (id) { query += ' AND id LIKE ?'; params.push(`%${id}%`); }
    if (userId) { query += ' AND user_id = ?'; params.push(userId); }
    if (dateFrom) { query += ' AND delivery_date >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND delivery_date <= ?'; params.push(dateTo); }
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (customer) { query += ' AND user_name LIKE ?'; params.push(`%${customer}%`); }

    const [cnt] = await db.query(query.replace('SELECT full_json', 'SELECT COUNT(*) as t'), params);
    
    query += ' ORDER BY delivery_date DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    
    const [rows] = await db.query(query, params);
    res.json({ 
        success: true, 
        orders: rows.map(r => parseJsonCol(r, 'full_json')), 
        total: cnt[0].t, 
        page: Number(page), 
        pages: Math.ceil(cnt[0].t / Number(limit)) 
    });
}));

app.put('/api/orders/status', withDb(async (req, res, db) => {
    const { ids, status, notifyCustomer } = req.body;
    if (!ids || ids.length === 0) return res.status(400).json({ error: "No IDs provided" });

    const placeholders = ids.map(() => '?').join(',');
    await db.query(`UPDATE orders SET status=?, full_json=JSON_SET(full_json, '$.status', ?) WHERE id IN (${placeholders})`, [status, status, ...ids]);

    if (notifyCustomer && transporter) {
        try {
            const query = `SELECT o.id, o.full_json, u.email FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id IN (${placeholders})`;
            const [ordersToNotify] = await db.query(query, ids);

            for (const orderRow of ordersToNotify) {
                const userEmail = orderRow.email;
                if (!userEmail) continue;

                const dbOrder = parseJsonCol(orderRow, 'full_json');
                const translatedStatus = STATUS_TRANSLATIONS[status] || status;
                
                const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                const host = req.get('host'); 
                const appUrl = process.env.VITE_APP_URL || `${protocol}://${host}`;

                const itemsHtml = (dbOrder.items || []).map(item => `
                    <tr><td style="padding:10px;">${item.name}</td><td style="padding:10px;">${item.quantity} ${item.unit}</td><td style="padding:10px;">${item.price} Kč</td></tr>
                `).join('');

                await transporter.sendMail({
                    from: process.env.SMTP_FROM || '"4Gracie" <info@4gracie.cz>',
                    to: userEmail,
                    subject: `Aktualizace objednávky #${dbOrder.id} - ${translatedStatus}`,
                    html: `
                        <h2>Změna stavu objednávky #${dbOrder.id}</h2>
                        <p>Nový stav: <strong>${translatedStatus}</strong></p>
                        <hr/>
                        <table style="width:100%">${itemsHtml}</table>
                        <p>Celkem: <strong>${dbOrder.totalPrice} Kč</strong></p>
                        <p><a href="${appUrl}/#/profile">Zobrazit v profilu</a></p>
                    `
                });
            }
        } catch (e) { console.error("Email error:", e); }
    }
    res.json({ success: true });
}));

// STATS LOAD (Derived Table Fix)
app.get('/api/admin/stats/load', withDb(async (req, res, db) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Missing date parameter" });
    const targetDate = formatToMysqlDate(date); 

    const summaryQuery = `
        SELECT t.category, SUM(t.total_item_workload) as total_workload, SUM(t.overhead) as total_overhead, COUNT(DISTINCT t.order_id) as order_count
        FROM (
            SELECT o.id as order_id, COALESCE(p.category, oi.category, 'unknown') as category,
            (oi.quantity * COALESCE(p.workload, oi.workload, 0)) as total_item_workload,
            COALESCE(p.workload_overhead, oi.workload_overhead, 0) as overhead
            FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN products p ON oi.product_id = p.id
            WHERE o.delivery_date = ? AND o.status != 'cancelled'
        ) t GROUP BY t.category
    `;
    const detailQuery = `
        SELECT t.category, t.product_id, t.name, t.unit, SUM(t.quantity) as total_quantity, SUM(t.total_item_workload) as product_workload
        FROM (
            SELECT COALESCE(p.category, oi.category, 'unknown') as category, oi.product_id, COALESCE(p.name, oi.name) as name, COALESCE(p.unit, oi.unit) as unit, oi.quantity, (oi.quantity * COALESCE(p.workload, oi.workload, 0)) as total_item_workload
            FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN products p ON oi.product_id = p.id
            WHERE o.delivery_date = ? AND o.status != 'cancelled'
        ) t GROUP BY t.category, t.product_id, t.name, t.unit
    `;
    
    try {
        const [summary] = await db.query(summaryQuery, [targetDate]);
        const [details] = await db.query(detailQuery, [targetDate]);
        if (sqlDebugMode) console.log(`[Stats] Loaded for ${targetDate}`);
        res.json({ success: true, summary, details });
    } catch (e) { res.status(500).json({ error: e.message }); }
}));

// OTHER ENDPOINTS
app.post('/api/settings', withDb(async (req, res, db) => {
  if (req.body.sqlDebug !== undefined) sqlDebugMode = !!req.body.sqlDebug;
  await db.query('INSERT INTO app_settings (key_name, data) VALUES ("global", ?) ON DUPLICATE KEY UPDATE data=?', [JSON.stringify(req.body), JSON.stringify(req.body)]);
  res.json({ success: true });
}));
app.post('/api/discounts', withDb(async (req, res, db) => {
  const d = req.body;
  await db.query('INSERT INTO discounts (id, code, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data=?', [d.id, d.code, JSON.stringify(d), JSON.stringify(d)]);
  res.json({ success: true });
}));
app.delete('/api/discounts/:id', withDb(async (req, res, db) => {
  await db.query('DELETE FROM discounts WHERE id=?', [req.params.id]);
  res.json({ success: true });
}));
app.post('/api/calendar', withDb(async (req, res, db) => {
  const c = req.body;
  await db.query('INSERT INTO calendar_exceptions (date, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data=?', [c.date, JSON.stringify(c), JSON.stringify(c)]);
  res.json({ success: true });
}));
app.delete('/api/calendar/:date', withDb(async (req, res, db) => {
  await db.query('DELETE FROM calendar_exceptions WHERE date=?', [req.params.date]);
  res.json({ success: true });
}));

// --- IMAGE UPLOAD ---
app.post('/api/admin/upload', async (req, res) => {
    const { image, name } = req.body;
    if (!image) return res.status(400).json({ error: 'No image' });
    const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid format' });
    const buffer = Buffer.from(matches[2], 'base64');
    const safeName = name ? name.replace(/[^a-z0-9]/gi, '_') : 'img';
    const fileName = `${Date.now()}_${safeName}.jpg`;
    const fullPath = path.join(UPLOAD_IMAGES_DIR, fileName);
    try {
        fs.writeFileSync(fullPath, buffer);
        res.json({ success: true, url: `/uploads/images/${fileName}` });
    } catch (err) { res.status(500).json({ error: 'Save failed', details: err.message }); }
});

// --- SERVER START ---
const startServer = async () => {
  const sslKeyPath = process.env.SSL_KEY_PATH;
  const sslCertPath = process.env.SSL_CERT_PATH; 
  if (sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
      try {
          const httpsOptions = { key: fs.readFileSync(sslKeyPath), cert: fs.readFileSync(sslCertPath) };
          https.createServer(httpsOptions, app).listen(PORT, () => console.log(`🚀 Secure Server on port ${PORT}`));
          return;
      } catch (e) { console.error("HTTPS Fail", e); }
  }
  http.createServer(app).listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
};

startServer();
