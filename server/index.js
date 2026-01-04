
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
// Remove independent body-parser import, use express native
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

// Debug middleware to log request sizes (optional, helps debugging)
app.use((req, res, next) => {
    if (req.path === '/api/admin/upload' || req.path === '/api/products') {
        // console.log(`[${req.method}] ${req.path} - Payload size: ${req.headers['content-length']} bytes`);
    }
    next();
});

// --- STATIC FILES & UPLOAD CONFIG ---
// Use process.cwd() to target the PROJECT ROOT, not the server subdirectory
const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const UPLOAD_IMAGES_DIR = path.join(UPLOAD_ROOT, 'images');

console.log(`📂 Upload Root configured at: ${UPLOAD_ROOT}`);
console.log(`📂 Images Directory configured at: ${UPLOAD_IMAGES_DIR}`);

// Ensure directories exist
if (!fs.existsSync(UPLOAD_IMAGES_DIR)) {
    try {
        fs.mkdirSync(UPLOAD_IMAGES_DIR, { recursive: true, mode: 0o777 }); // 777 to ensure write permissions
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
    return pool;
  } catch (err) {
    console.error(`❌ DB Connection Failed: ${err.message}`);
    return null;
  }
};

// --- HELPER FUNCTIONS ---
// Fix for "Incorrect date format" errors in MySQL
const formatToMysqlDateTime = (isoDateString) => {
    if (!isoDateString) return new Date().toISOString().slice(0, 19).replace('T', ' ');
    try {
        // If it's already in simple format (length 10 like YYYY-MM-DD), return as is (DB handles it or we append time)
        if (isoDateString.length === 10) return isoDateString; 
        
        // Remove 'T' and 'Z' and milliseconds for standard SQL format 'YYYY-MM-DD HH:MM:SS'
        return new Date(isoDateString).toISOString().slice(0, 19).replace('T', ' ');
    } catch (e) {
        console.warn("Date formatting failed for:", isoDateString);
        return new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
};

const formatToMysqlDate = (dateString) => {
    if (!dateString) return new Date().toISOString().split('T')[0];
    try {
        return new Date(dateString).toISOString().split('T')[0];
    } catch (e) {
        return dateString; // Fallback
    }
};

// --- INITIALIZATION & SEEDING ---
const initDb = async () => {
    const db = await getDb();
    if (!db) return;

    try {
        // 1. Users & Addresses
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
                type VARCHAR(20), -- 'delivery' or 'billing'
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

        // 2. Products
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
                image_url TEXT, -- Primary image
                full_json JSON, -- Store extra props (allergens, visibility, translations)
                INDEX idx_category (category)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);

        // 3. Orders (Relational)
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

        // 4. Order Items (Historical Snapshot)
        await db.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(50),
                product_id VARCHAR(50),
                name VARCHAR(255),
                quantity INT,
                price DECIMAL(10,2), -- Historical price at moment of purchase
                category VARCHAR(50),
                unit VARCHAR(20),
                workload INT,          -- Historical workload snapshot
                workload_overhead INT, -- Historical overhead snapshot
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                INDEX idx_order (order_id),
                INDEX idx_category (category)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);

        // 5. Config Tables
        await db.query(`CREATE TABLE IF NOT EXISTS app_settings (key_name VARCHAR(50) PRIMARY KEY, data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await db.query(`CREATE TABLE IF NOT EXISTS discounts (id VARCHAR(50) PRIMARY KEY, code VARCHAR(50), data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await db.query(`CREATE TABLE IF NOT EXISTS calendar_exceptions (date VARCHAR(20) PRIMARY KEY, data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

        // --- SEED ADMIN ---
        const [admins] = await db.query('SELECT id FROM users WHERE email = ?', ['info@4gracie.cz']);
        if (admins.length === 0) {
            console.log("🌱 Seeding default admin...");
            // Simple hash simulation for demo (in prod use bcrypt)
            const hash = 'hashed_' + Buffer.from('1234').toString('base64');
            await db.query(
                'INSERT INTO users (id, email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?, ?)',
                ['admin_seed', 'info@4gracie.cz', hash, 'admin', 'Hlavní Administrátor', '+420000000000']
            );
        }

        console.log("✅ Database schema initialized (Relational & Historical).");
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

const parseJsonCol = (row, colName = 'data') => {
    return typeof row[colName] === 'string' ? JSON.parse(row[colName]) : (row[colName] || {});
};

// --- API ENDPOINTS ---

// 1. PRODUCTS (Relational CRUD)
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
        users: []
    });
}));

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

// 2. USERS (Relational CRUD)
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

// ADDED: Password Reset Endpoint
app.post('/api/auth/reset-password', withDb(async (req, res, db) => {
    const { email } = req.body;
    // 1. Check if user exists
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
        // Return success even if user not found to prevent enumeration
        return res.json({ success: true, message: 'Pokud účet existuje, email byl odeslán.' });
    }

    // 2. Generate token (simplified for this example, use proper JWT or random string in prod)
    const token = Buffer.from(`${email}-${Date.now()}`).toString('base64');
    // Store token in DB (not implemented in this simplified schema, normally would go to password_resets table)

    // 3. Send Email
    if (transporter) {
        try {
            // FIX: Use VITE_APP_URL or fallback to Origin header to generate correct link
            const appUrl = process.env.VITE_APP_URL || req.headers.origin || 'http://localhost:5173';
            const link = `${appUrl}/#/reset-password?token=${token}`;
            
            await transporter.sendMail({
                from: process.env.SMTP_FROM || '"4Gracie" <info@4gracie.cz>',
                to: email,
                subject: 'Obnova hesla - 4Gracie',
                html: `
                    <p>Dobrý den,</p>
                    <p>Obdrželi jsme žádost o obnovu hesla.</p>
                    <p>Klikněte na odkaz níže pro nastavení nového hesla:</p>
                    <a href="${link}">${link}</a>
                    <p>Pokud jste o změnu nežádali, tento email ignorujte.</p>
                `
            });
            console.log(`📧 Reset email sent to ${email}`);
        } catch (e) {
            console.error("❌ Email send failed:", e);
            return res.status(500).json({ error: 'Chyba při odesílání emailu.' });
        }
    } else {
        // For development/debugging when no SMTP is set
        const appUrl = process.env.VITE_APP_URL || req.headers.origin || 'http://localhost:5173';
        console.warn("⚠️ SMTP not configured, printing reset link:", `${appUrl}/#/reset-password?token=${token}`);
    }

    res.json({ success: true, message: 'Instrukce byly odeslány na váš email.' });
}));

// 3. ORDERS & STATS (Historical & Aggregated)
app.post('/api/orders', withDb(async (req, res, db) => {
    const o = req.body;
    const { vopPdf } = req.body; // Extract Base64 PDF
    
    if (!o.id || !o.userId) return res.status(400).json({ error: "Missing fields" });

    // Clean order object for DB (remove transient PDF data if mixed)
    const dbOrder = { ...o };
    delete dbOrder.vopPdf; 

    // Date formatting to ensure MySQL compatibility (YYYY-MM-DD HH:MM:SS)
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

        // --- EMAIL SENDING LOGIC ---
        if (transporter) {
            try {
                // Get User Email
                const [userRows] = await db.query('SELECT email FROM users WHERE id = ?', [dbOrder.userId]);
                const userEmail = userRows[0]?.email;

                if (userEmail) {
                    const mailOptions = {
                        from: process.env.SMTP_FROM || '"4Gracie Catering" <info@4gracie.cz>',
                        to: userEmail,
                        subject: `Potvrzení objednávky #${dbOrder.id}`,
                        html: `
                            <div style="font-family: Arial, sans-serif; color: #333;">
                                <h2>Děkujeme za Vaši objednávku!</h2>
                                <p>Vaše objednávka <strong>#${dbOrder.id}</strong> byla úspěšně přijata.</p>
                                <hr/>
                                <p><strong>Datum doručení:</strong> ${dbOrder.deliveryDate}</p>
                                <p><strong>Celková cena:</strong> ${dbOrder.totalPrice + dbOrder.packagingFee + (dbOrder.deliveryFee || 0)} Kč</p>
                                <p>Stav objednávky můžete sledovat ve svém profilu.</p>
                                <br/>
                                <p>S pozdravem,<br/>Tým 4Gracie</p>
                            </div>
                        `,
                        attachments: []
                    };

                    // Attach VOP PDF if provided
                    if (vopPdf) {
                        mailOptions.attachments.push({
                            filename: 'Obchodni_podminky_4Gracie.pdf',
                            content: Buffer.from(vopPdf, 'base64'),
                            contentType: 'application/pdf'
                        });
                    }

                    await transporter.sendMail(mailOptions);
                    console.log(`📧 Order confirmation sent to ${userEmail}`);
                }
            } catch (mailError) {
                console.error("❌ Failed to send order email:", mailError);
                // Don't fail the request if email fails, just log it
            }
        }

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

app.get('/api/admin/stats/load', withDb(async (req, res, db) => {
    const { date } = req.query;
    const summaryQuery = `
        SELECT 
            oi.category, 
            SUM(oi.quantity * oi.workload) as total_workload,
            SUM(oi.workload_overhead) as total_overhead,
            COUNT(DISTINCT o.id) as order_count
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.delivery_date = ? AND o.status != 'cancelled'
        GROUP BY oi.category
    `;
    const detailQuery = `
        SELECT 
            oi.category,
            oi.product_id,
            oi.name,
            oi.unit,
            SUM(oi.quantity) as total_quantity,
            SUM(oi.quantity * oi.workload) as product_workload
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.delivery_date = ? AND o.status != 'cancelled'
        GROUP BY oi.category, oi.product_id, oi.name, oi.unit
    `;
    const [summary] = await db.query(summaryQuery, [date]);
    const [details] = await db.query(detailQuery, [date]);
    res.json({ success: true, summary, details });
}));

app.post('/api/settings', withDb(async (req, res, db) => {
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
app.put('/api/orders/status', withDb(async (req, res, db) => {
    const { ids, status } = req.body;
    const placeholders = ids.map(() => '?').join(',');
    await db.query(`UPDATE orders SET status=?, full_json=JSON_SET(full_json, '$.status', ?) WHERE id IN (${placeholders})`, [status, status, ...ids]);
    res.json({ success: true });
}));

// --- IMAGE UPLOAD ---
app.post('/api/admin/upload', async (req, res) => {
    const { image, name } = req.body;
    if (!image) {
        console.error('❌ Upload: No image data received');
        return res.status(400).json({ error: 'No image data' });
    }
    
    // Extract format and data
    const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        console.error('❌ Upload: Invalid base64 format');
        return res.status(400).json({ error: 'Invalid image format' });
    }
    
    const imageBuffer = Buffer.from(matches[2], 'base64');
    const safeName = name ? name.replace(/[^a-z0-9]/gi, '_') : 'img';
    const fileName = `${Date.now()}_${safeName}.jpg`;
    
    // Construct path using the ROOT directory defined above
    const fullPath = path.join(UPLOAD_IMAGES_DIR, fileName);
    
    console.log(`💾 Writing ${imageBuffer.length} bytes to: ${fullPath}`);
    
    try {
        // Use synchronous write to ensure file exists before response
        fs.writeFileSync(fullPath, imageBuffer);
        console.log(`✅ File successfully saved.`);
        
        // Return URL relative to static mount point
        res.json({ success: true, url: `/uploads/images/${fileName}` });
    } catch (err) {
        console.error("❌ File Write Error:", err);
        return res.status(500).json({ error: 'Save failed', details: err.message });
    }
});

// --- SERVER START ---
const startServer = async () => {
  const sslKeyPath = process.env.SSL_KEY_PATH;
  const sslCertPath = process.env.SSL_CERT_PATH; 

  if (sslKeyPath && sslCertPath) {
      try {
          if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
              console.log("🔒 Loading SSL Certificates...");
              const httpsOptions = {
                  key: fs.readFileSync(sslKeyPath),
                  cert: fs.readFileSync(sslCertPath)
              };
              https.createServer(httpsOptions, app).listen(PORT, () => {
                  console.log(`🚀 Secure Server running on port ${PORT} (HTTPS)`);
              });
              return;
          } else {
              console.warn(`⚠️ SSL files not found at paths: \nKEY: ${sslKeyPath}\nCERT: ${sslCertPath}\nFalling back to HTTP.`);
          }
      } catch (e) {
          console.error("❌ Failed to start HTTPS server:", e.message);
          console.warn("Falling back to HTTP.");
      }
  }

  http.createServer(app).listen(PORT, () => console.log(`🚀 Server running on port ${PORT} (HTTP)`));
};

startServer();
