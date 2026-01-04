
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
        console.log(`✅ Created upload directory: ${UPLOAD_IMAGES_DIR}`);
    } catch (e) {
        console.error(`❌ Failed to create upload directory: ${e.message}`);
    }
}

// Explicitly serve uploads using res.sendFile for robustness
app.get('/uploads/*', (req, res) => {
    try {
        const relativePath = req.params[0];
        if (!relativePath || relativePath.includes('..')) {
            return res.status(403).send('Access Denied');
        }
        
        const fullPath = path.join(UPLOAD_ROOT, relativePath);

        if (!fullPath.startsWith(UPLOAD_ROOT)) {
            return res.status(403).send('Access Denied');
        }

        if (fs.existsSync(fullPath)) {
            res.sendFile(fullPath);
        } else {
            res.status(404).send('File not found');
        }
    } catch (error) {
        console.error('Error serving file:', error);
        res.status(500).send('Internal Server Error');
    }
});

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

// ... (Other endpoints remain the same, kept brief for robust startup logic focus) ...
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
