
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
console.log("--- 4Gracie Server Init ---");

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

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global headers
app.use((req, res, next) => {
    if (!req.path.startsWith('/uploads')) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
    next();
});

// --- STATIC FILES & UPLOAD CONFIG ---
const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');
const UPLOAD_IMAGES_DIR = path.join(UPLOAD_ROOT, 'images');

if (!fs.existsSync(UPLOAD_IMAGES_DIR)) {
    try {
        fs.mkdirSync(UPLOAD_IMAGES_DIR, { recursive: true, mode: 0o777 });
    } catch (e) {
        console.error(`❌ Failed to create upload directory: ${e.message}`);
    }
}

// Explicitly serve uploads using res.sendFile for robustness
app.get('/uploads/*', (req, res) => {
    try {
        const relativePath = req.params[0];
        // Security check
        if (!relativePath || relativePath.includes('..')) {
            return res.status(403).send('Access Denied');
        }
        
        const fullPath = path.join(UPLOAD_ROOT, relativePath);

        // Ensure we are still inside UPLOAD_ROOT
        if (!fullPath.startsWith(UPLOAD_ROOT)) {
            return res.status(403).send('Access Denied');
        }

        if (fs.existsSync(fullPath)) {
            res.sendFile(fullPath);
        } else {
            console.warn(`File not found: ${fullPath}`);
            res.status(404).send('File not found');
        }
    } catch (error) {
        console.error('Error serving file:', error);
        res.status(500).send('Internal Server Error');
    }
});

// --- CONSTANTS ---
const STATUS_TRANSLATIONS = {
    'created': 'Zadaná',
    'confirmed': 'Potvrzená',
    'preparing': 'Připravuje se',
    'ready': 'Připravena',
    'on_way': 'Na cestě',
    'delivered': 'Doručena',
    'not_picked_up': 'Nevyzvednuto',
    'cancelled': 'Stornována'
};

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
    console.error(`❌ DB Connection Failed: ${err.message}`);
    return null;
  }
};

const withDb = (handler) => async (req, res) => {
  const db = await getDb();
  if (db) {
    try { await handler(req, res, db); } 
    catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
  } else {
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
            await t.verify();
            transporter = t;
            console.log(`✅ SMTP Server is ready (${process.env.SMTP_USER})`);
        } catch (e) {
            console.error('❌ SMTP Init Error:', e.message);
        }
    }
};
initEmail();

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

// --- EMAIL HTML GENERATOR ---
const generateEmailHtml = (order, title, introText) => {
    // Basic HTML generation without external dependencies
    const itemsHtml = order.items.map(i => {
        let imgHtml = '<div style="width: 50px; height: 50px; background-color: #f3f4f6; border-radius: 4px; display:inline-block;"></div>';
        if (i.images && i.images.length > 0) {
            let imgSrc = i.images[0];
            if (imgSrc.startsWith('/uploads/')) {
                // Try to embed only if filesystem access works
                try {
                    const relativePath = imgSrc.replace(/^\/uploads\//, '');
                    const fullPath = path.join(UPLOAD_ROOT, relativePath);
                    if (fs.existsSync(fullPath)) {
                        const ext = path.extname(fullPath).substring(1) || 'jpg';
                        const b64 = fs.readFileSync(fullPath, 'base64');
                        imgSrc = `data:image/${ext};base64,${b64}`;
                    }
                } catch (e) {}
            }
            imgHtml = `<img src="${imgSrc}" alt="${i.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; display: block;">`;
        }
        return `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; width: 60px;">${imgHtml}</td>
            <td style="padding: 8px;">${i.name}</td>
            <td style="padding: 8px; text-align: center;">${i.quantity} ${i.unit || 'ks'}</td>
            <td style="padding: 8px; text-align: right;">${i.price} Kč</td>
            <td style="padding: 8px; text-align: right;">${i.price * i.quantity} Kč</td>
        </tr>`;
    }).join('');

    const discountSum = order.appliedDiscounts?.reduce((acc, d) => acc + d.amount, 0) || 0;
    const itemsTotal = order.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const finalTotal = Math.max(0, itemsTotal - discountSum) + order.packagingFee + (order.deliveryFee || 0);

    return `
    <!DOCTYPE html>
    <html>
    <head><style>body{font-family:Arial,sans-serif;color:#333}table{width:100%;border-collapse:collapse}th{text-align:left;background:#f3f4f6;padding:10px}td{vertical-align:middle}</style></head>
    <body>
        <div style="max-width:600px;margin:0 auto;border:1px solid #ddd;padding:20px">
            <h2 style="color:#1f2937;border-bottom:2px solid #9333ea;padding-bottom:10px">${title}</h2>
            <p>${introText}</p>
            <div style="background:#f9fafb;padding:15px;margin:20px 0;border-radius:8px">
                <p><strong>Objednávka:</strong> #${order.id}</p>
                <p><strong>Doručení:</strong> ${new Date(order.deliveryDate).toLocaleDateString('cs-CZ')}</p>
            </div>
            <table>
                <thead><tr><th style="width:60px"></th><th>Položka</th><th>Ks</th><th>Cena/j</th><th>Celkem</th></tr></thead>
                <tbody>
                    ${itemsHtml}
                    <tr><td colspan="4" style="padding:8px;text-align:right">Balné</td><td style="padding:8px;text-align:right">${order.packagingFee} Kč</td></tr>
                    <tr><td colspan="4" style="padding:8px;text-align:right">Doprava</td><td style="padding:8px;text-align:right">${order.deliveryFee||0} Kč</td></tr>
                    ${discountSum > 0 ? `<tr><td colspan="4" style="padding:8px;text-align:right;color:green">Sleva</td><td style="padding:8px;text-align:right;color:green">-${discountSum} Kč</td></tr>` : ''}
                    <tr style="font-weight:bold;font-size:1.2em;background:#f9fafb"><td colspan="4" style="padding:15px;text-align:right">CELKEM:</td><td style="padding:15px;text-align:right;color:#9333ea">${finalTotal} Kč</td></tr>
                </tbody>
            </table>
        </div>
    </body>
    </html>`;
};

// --- PDF GENERATION ---
const fetchBuffer = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) { reject(new Error(`Status ${res.statusCode}`)); return; }
            const data = [];
            res.on('data', c => data.push(c));
            res.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', reject);
    });
};

// Font cache
let fontRegular = null;
let fontBold = null;

const generateInvoicePdf = async (o, type = 'proforma', settings) => {
    const jsPDF = await getJsPdf();
    if (!jsPDF) return null;

    if (!fontRegular || !fontBold) {
        try {
            const [reg, bld] = await Promise.all([
                fetchBuffer('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf'),
                fetchBuffer('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf')
            ]);
            fontRegular = reg.toString('base64');
            fontBold = bld.toString('base64');
        } catch (e) { console.error('Font load failed', e); }
    }

    const doc = new jsPDF();
    if (fontRegular && fontBold) {
        doc.addFileToVFS("Roboto-Regular.ttf", fontRegular);
        doc.addFileToVFS("Roboto-Medium.ttf", fontBold);
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
        doc.addFont("Roboto-Medium.ttf", "Roboto", "bold");
        doc.setFont("Roboto");
    }

    const comp = o.companyDetailsSnapshot || settings?.companyDetails || {};
    const title = type === 'proforma' ? "ZÁLOHOVÝ LIST" : "DAŇOVÝ DOKLAD";
    
    doc.setFontSize(18);
    doc.text(title, 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Číslo: ${o.id}`, 105, 30, { align: "center" });
    doc.text("DODAVATEL:", 14, 50);
    doc.text(comp.name || '', 14, 56);
    doc.text(`IČ: ${comp.ic || ''}`, 14, 62);
    
    doc.text("ODBĚRATEL:", 120, 50);
    doc.text(o.billingName || o.userName || 'Zákazník', 120, 56);
    
    // Items
    let y = 90;
    o.items.forEach(i => {
        doc.text(`${i.name} (${i.quantity} ${i.unit})`, 14, y);
        doc.text(`${i.price * i.quantity} Kč`, 180, y, { align: 'right' });
        y += 6;
    });
    
    // Totals
    const total = o.totalPrice + o.packagingFee + (o.deliveryFee || 0) - (o.appliedDiscounts?.reduce((a,b)=>a+b.amount,0)||0);
    y += 10;
    doc.setFontSize(12);
    doc.text(`CELKEM: ${total} Kč`, 180, y, { align: 'right' });

    // QR
    if (type === 'proforma') {
        try {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=SPD*1.0*ACC:${(comp.bankAccount||'').replace('/','')}*AM:${total}*CC:CZK*MSG:OBJ${o.id}`;
            const qrBuf = await fetchBuffer(qrUrl);
            doc.addImage(qrBuf.toString('base64'), 'PNG', 150, y + 10, 30, 30);
        } catch(e) {}
    }

    return Buffer.from(doc.output('arraybuffer'));
};

const getVopPdfBuffer = async () => {
    const vopPath = process.env.VOP_PATH;
    if (vopPath) {
        const p = path.resolve(process.cwd(), vopPath);
        if (fs.existsSync(p)) return fs.readFileSync(p);
    }
    return null;
};

// --- INITIALIZATION ---
const initDb = async () => {
    const db = await getDb();
    if (!db) return;
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
        console.log("✅ Database tables initialized.");
    } catch (e) { console.error("❌ Init DB Error:", e); }
};
initDb();

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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

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
        res.status(500).json({ error: e.message });
    }
}));

// Basic CRUD endpoints simplified for robustness
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

app.post('/api/orders', withDb(async (req, res, db) => {
    const o = req.body;
    const deliveryDate = formatToMysqlDate(o.deliveryDate);
    const createdAt = formatToMysqlDateTime(o.createdAt);
    
    await db.query(`INSERT INTO orders (id, user_id, user_name, delivery_date, status, total_price, delivery_fee, packaging_fee, payment_method, is_paid, delivery_type, delivery_name, delivery_street, delivery_city, delivery_zip, delivery_phone, billing_name, billing_street, billing_city, billing_zip, billing_ic, billing_dic, note, pickup_location_id, language, created_at, full_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=?, total_price=?, delivery_date=?, full_json=?`, 
    [o.id, o.userId, o.userName, deliveryDate, o.status, o.totalPrice, o.deliveryFee, o.packagingFee, o.paymentMethod, o.isPaid, o.deliveryType, o.deliveryName, o.deliveryStreet, o.deliveryCity, o.deliveryZip, o.deliveryPhone, o.billingName, o.billingStreet, o.billingCity, o.billingZip, o.billingIc, o.billingDic, o.note, o.pickupLocationId, o.language, createdAt, JSON.stringify(o), o.status, o.totalPrice, deliveryDate, JSON.stringify(o)]);
    
    await db.query('DELETE FROM order_items WHERE order_id = ?', [o.id]);
    if (o.items && o.items.length > 0) {
        const values = o.items.map(i => [o.id, i.id, i.name, i.quantity, i.price, i.category, i.unit, i.workload||0, i.workloadOverhead||0]);
        await db.query('INSERT INTO order_items (order_id, product_id, name, quantity, price, category, unit, workload, workload_overhead) VALUES ?', [values]);
    }

    if (transporter && o.status === 'created') {
        const [settingsRows] = await db.query('SELECT * FROM app_settings WHERE key_name = "global"');
        const settings = settingsRows.length ? parseJsonCol(settingsRows[0]) : {};
        const html = generateEmailHtml(o, `Objednávka #${o.id}`, 'Potvrzení přijetí objednávky.');
        const [u] = await db.query('SELECT email FROM users WHERE id=?', [o.userId]);
        
        if (u[0]?.email) {
            const attachments = [];
            const pdf = await generateInvoicePdf(o, 'proforma', settings);
            if (pdf) attachments.push({ filename: 'zaloha.pdf', content: pdf });
            const vop = await getVopPdfBuffer();
            if (vop) attachments.push({ filename: 'VOP.pdf', content: vop });

            transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: u[0].email,
                subject: `Potvrzení objednávky #${o.id}`,
                html,
                attachments
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
                const html = generateEmailHtml(o, `Změna stavu #${o.id}`, `Nový stav: ${STATUS_TRANSLATIONS[status]||status}`);
                transporter.sendMail({ from: process.env.EMAIL_FROM, to: r.email, subject: `Změna stavu #${o.id}`, html }).catch(console.error);
            }
        }
    }
    res.json({ success: true });
}));

// Other endpoints
app.post('/api/settings', withDb(async (req, res, db) => { await db.query('INSERT INTO app_settings (key_name, data) VALUES ("global", ?) ON DUPLICATE KEY UPDATE data=?', [JSON.stringify(req.body), JSON.stringify(req.body)]); res.json({ success: true }); }));
app.post('/api/discounts', withDb(async (req, res, db) => { const d = req.body; await db.query('INSERT INTO discounts (id, code, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data=?', [d.id, d.code, JSON.stringify(d), JSON.stringify(d)]); res.json({ success: true }); }));
app.delete('/api/discounts/:id', withDb(async (req, res, db) => { await db.query('DELETE FROM discounts WHERE id=?', [req.params.id]); res.json({ success: true }); }));
app.post('/api/calendar', withDb(async (req, res, db) => { const c = req.body; await db.query('INSERT INTO calendar_exceptions (date, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data=?', [c.date, JSON.stringify(c), JSON.stringify(c)]); res.json({ success: true }); }));
app.delete('/api/calendar/:date', withDb(async (req, res, db) => { await db.query('DELETE FROM calendar_exceptions WHERE date=?', [req.params.date]); res.json({ success: true }); }));

app.post('/api/admin/upload', async (req, res) => {
    const { image, name } = req.body;
    if (!image) return res.status(400).json({ error: 'No image' });
    const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid format' });
    let ext = matches[1]; if(ext==='jpeg')ext='jpg'; if(ext==='svg+xml')ext='svg';
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `${Date.now()}_${(name||'img').replace(/[^a-z0-9]/gi,'_')}.${ext}`;
    const fullPath = path.join(UPLOAD_IMAGES_DIR, fileName);
    try { fs.writeFileSync(fullPath, buffer); res.json({ success: true, url: `/uploads/images/${fileName}` }); } catch (err) { res.status(500).json({ error: 'Save failed' }); }
});

const startServer = async () => {
  const sslKeyPath = process.env.SSL_KEY_PATH;
  const sslCertPath = process.env.SSL_CERT_PATH; 
  if (sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
      try {
          const httpsOptions = { key: fs.readFileSync(sslKeyPath), cert: fs.readFileSync(sslCertPath) };
          https.createServer(httpsOptions, app).listen(PORT, () => console.log(`🚀 Secure Server on port ${PORT}`));
          return;
      } catch (e) { console.error("❌ HTTPS Fail:", e.message); }
  }
  http.createServer(app).listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
};

startServer();
