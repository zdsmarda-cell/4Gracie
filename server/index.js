
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- POLYFILLS FOR NODE.JS ENVIRONMENT ---
if (typeof global.btoa === 'undefined') {
    global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}
if (typeof global.atob === 'undefined') {
    global.atob = (b64Encoded) => Buffer.from(b64Encoded, 'base64').toString('binary');
}
if (typeof global.window === 'undefined') {
    global.window = global;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIG LOADING ---
console.log("--- 4Gracie Server Startup Sequence ---");

const pathsToCheck = [
  path.resolve(__dirname, '..', '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '.env')
];

let envLoaded = false;
for (const p of pathsToCheck) {
  if (fs.existsSync(p)) {
    console.log(`✅ FOUND config file at: ${p}`);
    const result = dotenv.config({ path: p });
    if (result.error) {
        console.error(`❌ Error parsing .env:`, result.error);
    } else {
        envLoaded = true;
        console.log(`✅ Loaded environment variables.`);
    }
    break;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// --- GLOBAL REQUEST LOGGER ---
app.use((req, res, next) => {
    // Log only API methods to keep logs clean, but log ALL upload attempts
    if (req.method !== 'GET' || req.url.includes('upload')) {
        console.log(`📡 [${req.method}] ${req.url}`);
    }
    next();
});

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global headers
app.use((req, res, next) => {
    // Disable cache for API, but allow for images (handled in image route)
    if (req.path.startsWith('/api') && !req.path.includes('/uploads/')) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
    next();
});

// --- STATIC FILES & UPLOAD CONFIG ---
// Resolve upload root relative to this file (server/index.js) -> up one level -> uploads
const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');
const UPLOAD_IMAGES_DIR = path.join(UPLOAD_ROOT, 'images');

// Ensure directories exist
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
if (!fs.existsSync(UPLOAD_IMAGES_DIR)) fs.mkdirSync(UPLOAD_IMAGES_DIR, { recursive: true });

console.log(`📂 Serving static uploads from: ${UPLOAD_ROOT}`);

// --- FILE SERVING HANDLER ---
const handleFileRequest = (req, res) => {
    try {
        // Express Regex routes capture the group in req.params[0]
        const rawRelativePath = req.params[0];
        
        console.log(`🔍 [FILE] Request for: '${rawRelativePath}'`);

        if (!rawRelativePath) {
            console.warn(`   ⚠️ Empty path`);
            return res.status(404).send('File not found');
        }

        // Prevent directory traversal
        if (rawRelativePath.includes('..')) {
            console.warn(`   ⚠️ Access Denied (Traversal)`);
            return res.status(403).send('Access Denied');
        }

        // Safe Decode
        let safeRelative;
        try {
            safeRelative = decodeURIComponent(rawRelativePath);
        } catch (e) {
            console.warn(`   ⚠️ Failed to decode URI component: ${rawRelativePath}`);
            safeRelative = rawRelativePath; // Fallback to raw
        }

        const fullPath = path.join(UPLOAD_ROOT, safeRelative);
        
        // Verify the file is actually inside our upload root
        if (!fullPath.startsWith(UPLOAD_ROOT)) {
            console.warn(`   ⚠️ Access Denied (Path outside root): ${fullPath}`);
            return res.status(403).send('Access Denied');
        }

        if (fs.existsSync(fullPath)) {
            // Check if directory
            if (fs.statSync(fullPath).isDirectory()) {
                console.warn(`   ⚠️ Access Denied (Is directory)`);
                return res.status(403).send('Access Denied');
            }
            
            // Set cache headers for images
            res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
            
            res.sendFile(fullPath, (err) => {
                if (err) {
                    console.error(`   ❌ Error sending file: ${err.message}`);
                    if (!res.headersSent) res.status(500).end(); 
                }
            });
        } else {
            console.error(`   ❌ File NOT FOUND on disk: ${fullPath}`);
            res.status(404).send('File not found');
        }
    } catch (error) {
        console.error('CRITICAL ERROR in file handler:', error);
        if (!res.headersSent) res.status(500).send('Internal Server Error');
    }
};

// --- FILE ROUTES ---
// Using Regex routes to support Express 5 and avoiding "path-to-regexp" errors
// Matches /api/uploads/ANYTHING and /uploads/ANYTHING
app.get(/^\/api\/uploads\/(.+)$/, handleFileRequest);
app.get(/^\/uploads\/(.+)$/, handleFileRequest);


// --- DATABASE CONNECTION ---
let pool = null;

const getDb = async () => {
  if (pool) return pool;
  try {
    if (!process.env.DB_HOST) throw new Error("DB_HOST missing from .env");
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
    return pool;
  } catch (err) {
    console.error(`❌ DB Configuration Error: ${err.message}`);
    return null;
  }
};

const withDb = (handler) => async (req, res) => {
  const db = await getDb();
  if (db) {
    try { await handler(req, res, db); } 
    catch (err) { console.error("Handler Error:", err); res.status(500).json({ error: err.message }); }
  } else {
    console.error("❌ Database connection not available for request.");
    res.status(500).json({ error: 'DB Connection Failed' });
  }
};

// --- DYNAMIC IMPORTS HELPERS ---
const getNodemailer = async () => {
    try {
        const mod = await import('nodemailer');
        return mod.default || mod;
    } catch (e) {
        console.warn('⚠️ Nodemailer not found. Emails will not be sent.');
        return null;
    }
};

const getJsPdf = async () => {
    try {
        const mod = await import('jspdf');
        return mod.jsPDF || mod.default?.jsPDF;
    } catch (e) {
        console.warn('⚠️ jsPDF not found. PDFs will not be generated.');
        return null;
    }
};

const getGoogleGenAI = async () => {
    try {
        const mod = await import('@google/genai');
        return mod.GoogleGenAI;
    } catch (e) {
        console.warn('⚠️ @google/genai not found. Translations will not work.');
        return null;
    }
};

// --- EMAIL SETUP ---
let transporter = null;
const initEmail = async () => {
    const nodemailer = await getNodemailer();
    if (nodemailer && process.env.SMTP_HOST) {
        try {
            const t = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 465,
                secure: process.env.SMTP_SECURE === 'true',
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
                tls: { rejectUnauthorized: false }
            });
            // Don't await verify to not block startup
            t.verify().then(() => console.log(`✅ SMTP Verified (${process.env.SMTP_USER})`)).catch(e => console.error("❌ SMTP Verify Failed:", e.message));
            transporter = t;
        } catch (e) {
            console.error('❌ SMTP Init Error:', e.message);
        }
    }
};
// Run email init in background
initEmail();

// --- API ENDPOINTS ---

app.post('/api/admin/translate', async (req, res) => {
    const { sourceData } = req.body;
    if (!sourceData) return res.status(400).json({ error: 'Missing sourceData' });
    if (!process.env.API_KEY) return res.json({ translations: { en: {}, de: {} } });

    try {
        const GoogleGenAI = await getGoogleGenAI();
        if (!GoogleGenAI) return res.status(500).json({ error: "GenAI module missing" });

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Translate to EN/DE JSON: ${JSON.stringify(sourceData)}`;
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(cleanText));
    } catch (e) {
        console.error("Translation Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/bootstrap', withDb(async (req, res, db) => {
    try {
        const [prodRows] = await db.query('SELECT * FROM products WHERE is_deleted = FALSE');
        const [settings] = await db.query('SELECT * FROM app_settings WHERE key_name = "global"');
        const [discounts] = await db.query('SELECT * FROM discounts');
        const [calendar] = await db.query('SELECT * FROM calendar_exceptions');
        const today = new Date().toISOString().split('T')[0];
        const [activeOrders] = await db.query('SELECT full_json, final_invoice_date FROM orders WHERE delivery_date >= ? AND status != "cancelled"', [today]);

        const products = prodRows.map(row => ({ ...parseJsonCol(row, 'full_json'), id: row.id, name: row.name, price: Number(row.price), category: row.category }));
        const mergedOrders = activeOrders.map(r => { const j = parseJsonCol(r, 'full_json'); if(r.final_invoice_date) j.finalInvoiceDate = r.final_invoice_date; return j; });

        res.json({
            products,
            settings: settings.length ? parseJsonCol(settings[0]) : null,
            discountCodes: discounts.map(r => ({...parseJsonCol(r), id: r.id})),
            dayConfigs: calendar.map(r => ({...parseJsonCol(r), date: r.date})),
            orders: mergedOrders,
            users: [] 
        });
    } catch (e) {
        console.error("Bootstrap Error:", e);
        res.status(500).json({ error: e.message });
    }
}));

// Helper function to parse JSON columns safely
const parseJsonCol = (row, colName = 'data') => {
    return typeof row[colName] === 'string' ? JSON.parse(row[colName]) : (row[colName] || {});
};

// --- INITIALIZATION ---
// We define initDb but do NOT await it at the top level to avoid blocking server start
const initDb = async () => {
    console.log("🔄 Attempting to initialize Database tables...");
    const db = await getDb();
    if (!db) {
        console.log("⚠️ Database not available yet. Skipping table creation.");
        return;
    }
    try {
        await db.query(`CREATE TABLE IF NOT EXISTS users (id VARCHAR(50) PRIMARY KEY, email VARCHAR(100) UNIQUE, password_hash VARCHAR(255), name VARCHAR(100), phone VARCHAR(20), role VARCHAR(20) DEFAULT 'customer', is_blocked BOOLEAN DEFAULT FALSE, marketing_consent BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await db.query(`CREATE TABLE IF NOT EXISTS user_addresses (id VARCHAR(50) PRIMARY KEY, user_id VARCHAR(50), type VARCHAR(20), name VARCHAR(100), street VARCHAR(255), city VARCHAR(100), zip VARCHAR(20), phone VARCHAR(20), ic VARCHAR(20), dic VARCHAR(20)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await db.query(`CREATE TABLE IF NOT EXISTS products (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), description TEXT, price DECIMAL(10,2), unit VARCHAR(10), category VARCHAR(50), workload INT, workload_overhead INT, vat_rate_inner DECIMAL(5,2), vat_rate_takeaway DECIMAL(5,2), is_deleted BOOLEAN DEFAULT FALSE, image_url TEXT, full_json JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await db.query(`CREATE TABLE IF NOT EXISTS orders (id VARCHAR(50) PRIMARY KEY, user_id VARCHAR(50), user_name VARCHAR(255), delivery_date DATE, status VARCHAR(50), total_price DECIMAL(10,2), delivery_fee DECIMAL(10,2), packaging_fee DECIMAL(10,2), payment_method VARCHAR(50), is_paid BOOLEAN, delivery_type VARCHAR(50), delivery_name VARCHAR(100), delivery_street VARCHAR(255), delivery_city VARCHAR(100), delivery_zip VARCHAR(20), delivery_phone VARCHAR(20), billing_name VARCHAR(100), billing_street VARCHAR(255), billing_city VARCHAR(100), billing_zip VARCHAR(20), billing_ic VARCHAR(20), billing_dic VARCHAR(20), note TEXT, pickup_location_id VARCHAR(100), language VARCHAR(10), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, final_invoice_date TIMESTAMP NULL, full_json JSON, INDEX idx_date (delivery_date)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await db.query(`CREATE TABLE IF NOT EXISTS order_items (id INT AUTO_INCREMENT PRIMARY KEY, order_id VARCHAR(50), product_id VARCHAR(50), name VARCHAR(255), quantity INT, price DECIMAL(10,2), category VARCHAR(50), unit VARCHAR(20), workload INT, workload_overhead INT, FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await db.query(`CREATE TABLE IF NOT EXISTS app_settings (key_name VARCHAR(50) PRIMARY KEY, data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await db.query(`CREATE TABLE IF NOT EXISTS discounts (id VARCHAR(50) PRIMARY KEY, code VARCHAR(50), data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await db.query(`CREATE TABLE IF NOT EXISTS calendar_exceptions (date VARCHAR(20) PRIMARY KEY, data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        
        const [admins] = await db.query('SELECT id FROM users WHERE email = ?', ['info@4gracie.cz']);
        if (admins.length === 0) {
            console.log("🌱 Seeding default admin...");
            const hash = 'hashed_' + Buffer.from('1234').toString('base64');
            await db.query('INSERT INTO users (id, email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?, ?)', ['admin_seed', 'info@4gracie.cz', hash, 'admin', 'Hlavní Administrátor', '+420000000000']);
        }
        console.log("✅ Database tables initialized successfully.");
    } catch (e) { 
        console.error("❌ Init DB Error:", e); 
    }
};

// --- ROUTE DEFINITIONS FOR APP FUNCTIONALITY ---

// PRODUCTS
app.post('/api/products', withDb(async (req, res, db) => {
    const p = req.body;
    await db.query(`INSERT INTO products (id, name, description, price, unit, category, workload, workload_overhead, vat_rate_inner, vat_rate_takeaway, image_url, full_json, is_deleted) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=?, description=?, price=?, unit=?, category=?, workload=?, workload_overhead=?, vat_rate_inner=?, vat_rate_takeaway=?, image_url=?, full_json=?, is_deleted=?`, 
    [p.id, p.name, p.description, p.price, p.unit, p.category, p.workload, p.workloadOverhead, p.vatRateInner, p.vatRateTakeaway, p.images?.[0]||null, JSON.stringify(p), false, 
     p.name, p.description, p.price, p.unit, p.category, p.workload, p.workloadOverhead, p.vatRateInner, p.vatRateTakeaway, p.images?.[0]||null, JSON.stringify(p), false]);
    res.json({ success: true });
}));

app.delete('/api/products/:id', withDb(async (req, res, db) => {
    await db.query('UPDATE products SET is_deleted = TRUE WHERE id = ?', [req.params.id]);
    res.json({ success: true });
}));

// USERS
app.get('/api/users', withDb(async (req, res, db) => {
    const { search } = req.query;
    let query = 'SELECT * FROM users WHERE 1=1';
    const params = [];
    if (search) { query += ' AND (email LIKE ? OR name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    query += ' LIMIT 100';
    const [rows] = await db.query(query, params);
    const users = [];
    for (const row of rows) {
        const [addrs] = await db.query('SELECT * FROM user_addresses WHERE user_id = ?', [row.id]);
        users.push({
            id: row.id, email: row.email, name: row.name, phone: row.phone, role: row.role,
            isBlocked: Boolean(row.is_blocked), marketingConsent: Boolean(row.marketing_consent),
            passwordHash: row.password_hash,
            deliveryAddresses: addrs.filter(a => a.type === 'delivery'),
            billingAddresses: addrs.filter(a => a.type === 'billing')
        });
    }
    res.json({ success: true, users });
}));

app.post('/api/users', withDb(async (req, res, db) => {
    const u = req.body;
    await db.query(`INSERT INTO users (id, email, password_hash, name, phone, role, is_blocked, marketing_consent) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE email=?, password_hash=?, name=?, phone=?, role=?, is_blocked=?, marketing_consent=?`, [u.id, u.email, u.passwordHash, u.name, u.phone, u.role, u.isBlocked, u.marketingConsent, u.email, u.passwordHash, u.name, u.phone, u.role, u.isBlocked, u.marketingConsent]);
    await db.query('DELETE FROM user_addresses WHERE user_id = ?', [u.id]);
    const addresses = [...(u.deliveryAddresses||[]).map(a=>({...a,type:'delivery'})), ...(u.billingAddresses||[]).map(a=>({...a,type:'billing'}))];
    if (addresses.length > 0) {
        const values = addresses.map(a => [a.id || Date.now()+Math.random(), u.id, a.type, a.name, a.street, a.city, a.zip, a.phone, a.ic||null, a.dic||null]);
        await db.query('INSERT INTO user_addresses (id, user_id, type, name, street, city, zip, phone, ic, dic) VALUES ?', [values]);
    }
    res.json({ success: true });
}));

app.post('/api/auth/login', withDb(async (req, res, db) => {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [req.body.email]);
    if (rows.length > 0) {
        const u = rows[0];
        const [addrs] = await db.query('SELECT * FROM user_addresses WHERE user_id = ?', [u.id]);
        res.json({ success: true, user: { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, isBlocked: Boolean(u.is_blocked), marketingConsent: Boolean(u.marketing_consent), passwordHash: u.password_hash, deliveryAddresses: addrs.filter(a => a.type === 'delivery'), billingAddresses: addrs.filter(a => a.type === 'billing') } });
    } else { res.json({ success: false, message: 'User not found' }); }
}));

app.post('/api/auth/reset-password', withDb(async (req, res, db) => {
    const { email } = req.body;
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length > 0 && transporter) {
        const token = Buffer.from(`${email}-${Date.now()}`).toString('base64');
        const link = `${process.env.VITE_APP_URL || 'https://eshop.4gracie.cz'}/#/reset-password?token=${token}`;
        
        await transporter.sendMail({ 
            from: process.env.EMAIL_FROM,
            to: email, 
            subject: 'Obnova hesla', 
            html: `<a href="${link}">Resetovat heslo</a>` 
        }).catch(err => console.error("Email send fail:", err));
    }
    res.json({ success: true, message: 'Email odeslán.' });
}));

app.post('/api/auth/reset-password-confirm', withDb(async (req, res, db) => {
    const { token, newPasswordHash } = req.body;
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const email = decoded.substring(0, decoded.lastIndexOf('-'));
        await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [newPasswordHash, email]);
        res.json({ success: true, message: 'Heslo změněno.' });
    } catch (e) { res.status(400).json({ success: false }); }
}));

// ORDERS
app.post('/api/orders', withDb(async (req, res, db) => {
    const o = req.body;
    const deliveryDate = o.deliveryDate; // formatToMysqlDate handled in UI usually, but good to be safe
    const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    await db.query(`INSERT INTO orders (id, user_id, user_name, delivery_date, status, total_price, delivery_fee, packaging_fee, payment_method, is_paid, delivery_type, delivery_name, delivery_street, delivery_city, delivery_zip, delivery_phone, billing_name, billing_street, billing_city, billing_zip, billing_ic, billing_dic, note, pickup_location_id, language, created_at, full_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=?, total_price=?, delivery_date=?, full_json=?`, 
    [o.id, o.userId, o.userName, deliveryDate, o.status, o.totalPrice, o.deliveryFee, o.packagingFee, o.paymentMethod, o.isPaid, o.deliveryType, o.deliveryName, o.deliveryStreet, o.deliveryCity, o.deliveryZip, o.deliveryPhone, o.billingName, o.billingStreet, o.billingCity, o.billingZip, o.billingIc, o.billingDic, o.note, o.pickupLocationId, o.language, createdAt, JSON.stringify(o), o.status, o.totalPrice, deliveryDate, JSON.stringify(o)]);
    
    await db.query('DELETE FROM order_items WHERE order_id = ?', [o.id]);
    if (o.items && o.items.length > 0) {
        const values = o.items.map(i => [o.id, i.id, i.name, i.quantity, i.price, i.category, i.unit, i.workload||0, i.workloadOverhead||0]);
        await db.query('INSERT INTO order_items (order_id, product_id, name, quantity, price, category, unit, workload, workload_overhead) VALUES ?', [values]);
    }

    if (transporter && o.status === 'created') {
        const [u] = await db.query('SELECT email FROM users WHERE id=?', [o.userId]);
        if (u[0]?.email) {
            transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: u[0].email,
                subject: `Potvrzení objednávky #${o.id}`,
                html: `Děkujeme za objednávku #${o.id}. Celkem: ${o.totalPrice + o.packagingFee + (o.deliveryFee||0)} Kč.`
            }).catch(console.error);
        }
    }
    res.json({ success: true });
}));

app.get('/api/orders', withDb(async (req, res, db) => {
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

app.put('/api/orders/status', withDb(async (req, res, db) => {
    const { ids, status, notifyCustomer } = req.body;
    let sql = `UPDATE orders SET status=?, full_json=JSON_SET(full_json, '$.status', ?)`;
    if (status === 'delivered') sql += `, final_invoice_date = IF(final_invoice_date IS NULL, NOW(), final_invoice_date), full_json = JSON_SET(full_json, '$.finalInvoiceDate', DATE_FORMAT(IF(final_invoice_date IS NULL, NOW(), final_invoice_date), '%Y-%m-%dT%H:%i:%s.000Z'))`;
    sql += ` WHERE id IN (${ids.map(()=>'?').join(',')})`;
    await db.query(sql, [status, status, ...ids]);
    
    if (notifyCustomer && transporter) {
        const [rows] = await db.query(`SELECT full_json, u.email FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id IN (${ids.map(()=>'?').join(',')})`, ids);
        for(const r of rows) {
            if(r.email) {
                const o = parseJsonCol(r, 'full_json');
                transporter.sendMail({ from: process.env.EMAIL_FROM, to: r.email, subject: `Změna stavu #${o.id}`, html: `Nový stav: ${status}` }).catch(console.error);
            }
        }
    }
    res.json({ success: true });
}));

// ADMIN STATS LOAD
app.get('/api/admin/stats/load', withDb(async (req, res, db) => {
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

// UPLOAD
app.post('/api/admin/upload', async (req, res) => {
    const { image, name } = req.body;
    if (!image) return res.status(400).json({ error: 'No image' });
    const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid format' });
    let ext = matches[1]; if(ext==='jpeg')ext='jpg'; if(ext==='svg+xml')ext='svg';
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `${Date.now()}_${(name||'img').replace(/[^a-z0-9]/gi,'_')}.${ext}`;
    const fullPath = path.join(UPLOAD_IMAGES_DIR, fileName);
    
    try { 
        fs.writeFileSync(fullPath, buffer);
        console.log(`✅ Image saved: ${fullPath} (${buffer.length} bytes)`);
        // IMPORTANT: Return URL with /api/uploads prefix so it bypasses Nginx static serving
        res.json({ success: true, url: `/api/uploads/images/${fileName}` }); 
    } catch (err) { 
        console.error("❌ Save failed:", err);
        res.status(500).json({ error: 'Save failed' }); 
    }
});

// SETTINGS & OTHER
app.post('/api/settings', withDb(async (req, res, db) => { await db.query('INSERT INTO app_settings (key_name, data) VALUES ("global", ?) ON DUPLICATE KEY UPDATE data=?', [JSON.stringify(req.body), JSON.stringify(req.body)]); res.json({ success: true }); }));
app.post('/api/discounts', withDb(async (req, res, db) => { const d = req.body; await db.query('INSERT INTO discounts (id, code, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data=?', [d.id, d.code, JSON.stringify(d), JSON.stringify(d)]); res.json({ success: true }); }));
app.delete('/api/discounts/:id', withDb(async (req, res, db) => { await db.query('DELETE FROM discounts WHERE id=?', [req.params.id]); res.json({ success: true }); }));
app.post('/api/calendar', withDb(async (req, res, db) => { const c = req.body; await db.query('INSERT INTO calendar_exceptions (date, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data=?', [c.date, JSON.stringify(c), JSON.stringify(c)]); res.json({ success: true }); }));
app.delete('/api/calendar/:date', withDb(async (req, res, db) => { await db.query('DELETE FROM calendar_exceptions WHERE date=?', [req.params.date]); res.json({ success: true }); }));

app.post('/api/admin/import', withDb(async (req, res, db) => {
    const { data } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        if (data.products) {
            await conn.query('DELETE FROM products');
            for(const p of data.products) await conn.query('INSERT INTO products (id, name, full_json) VALUES (?,?,?)', [p.id, p.name, JSON.stringify(p)]);
        }
        // ... (simplified import logic for brevity, full logic would iterate all tables)
        await conn.commit();
        res.json({ success: true });
    } catch(e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally {
        conn.release();
    }
}));

// --- SERVER STARTUP ---
const startServer = async () => {
  console.log("🚀 Starting Server...");

  // Trigger DB init in background
  initDb();

  const sslKeyPath = process.env.SSL_KEY_PATH;
  const sslCertPath = process.env.SSL_CERT_PATH; 
  
  let server;

  // Try HTTPS first if configured
  if (sslKeyPath && sslCertPath) {
      if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
          try {
              console.log("🔐 Found SSL certificates, attempting HTTPS...");
              const httpsOptions = { key: fs.readFileSync(sslKeyPath), cert: fs.readFileSync(sslCertPath) };
              server = https.createServer(httpsOptions, app);
          } catch (e) { 
              console.error("❌ HTTPS Setup Failed (falling back to HTTP):", e.message); 
          }
      } else {
          console.warn("⚠️ SSL Paths defined but files not found. Falling back to HTTP.");
      }
  }

  // Fallback to HTTP
  if (!server) {
      console.log("🔓 Starting in HTTP mode.");
      server = http.createServer(app);
  }

  // CRITICAL: Bind to 0.0.0.0 to ensure visibility and add error listener
  server.on('error', (e) => {
      console.error("❌ SERVER LISTEN ERROR:", e);
      if (e.code === 'EADDRINUSE') {
          console.error(`❌ Port ${PORT} is already in use!`);
      }
  });

  server.listen(PORT, '0.0.0.0', () => {
      console.log(`=========================================`);
      console.log(`🚀 Server successfully listening!`);
      console.log(`👉 Port: ${PORT}`);
      console.log(`👉 Address: 0.0.0.0 (Accessible via localhost or network IP)`);
      console.log(`=========================================`);
  });
};

startServer();
