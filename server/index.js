
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import { initEmail } from './services/email.js';

// ROUTES IMPORTS
import authRoutes from './routes/users.js'; 
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import bootstrapRoutes from './routes/bootstrap.js';
import settingsRoutes from './routes/settings.js';
import aiRoutes from './routes/ai.js';
import statsRoutes from './routes/stats.js';

// --- POLYFILLS FOR NODE.JS ENVIRONMENT (Required for jsPDF) ---
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

// --- CONFIG ---
console.log("--- 4Gracie Server Startup ---");
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- STATIC FILES ---
const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');
app.use('/api/uploads', express.static(UPLOAD_ROOT));
app.use('/uploads', express.static(UPLOAD_ROOT));

// --- MOUNT ROUTES ---
app.use('/api/bootstrap', bootstrapRoutes); // New endpoint for initial data loading
app.use('/api/users', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes); // Upload & Import
app.use('/api/admin', aiRoutes); // Translation (/translate)
app.use('/api/admin/stats', statsRoutes); // Stats (/load)
app.use('/api', settingsRoutes); // Settings, Discounts, Calendar

// --- INITIALIZATION ---
const initDb = async () => {
    console.log("🔄 Initializing DB...");
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
        
        try { await db.query('SELECT full_json FROM products LIMIT 1'); } 
        catch (e) { await db.query('ALTER TABLE products ADD COLUMN full_json JSON'); }

        const [admins] = await db.query('SELECT id FROM users WHERE email = ?', ['info@4gracie.cz']);
        if (admins.length === 0) {
            const hash = 'hashed_' + Buffer.from('1234').toString('base64');
            await db.query('INSERT INTO users (id, email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?, ?)', ['admin_seed', 'info@4gracie.cz', hash, 'admin', 'Hlavní Administrátor', '+420000000000']);
        }
        console.log("✅ DB Init Complete");
    } catch (e) { console.error("❌ Init DB Error:", e); }
};

// --- START SERVER ---
const startServer = async () => {
  initDb();
  await initEmail();

  const sslKey = process.env.SSL_KEY_PATH;
  const sslCert = process.env.SSL_CERT_PATH; 
  
  if (sslKey && sslCert && fs.existsSync(sslKey) && fs.existsSync(sslCert)) {
      https.createServer({ key: fs.readFileSync(sslKey), cert: fs.readFileSync(sslCert) }, app).listen(PORT, '0.0.0.0', () => console.log(`🚀 HTTPS Server on ${PORT}`));
  } else {
      http.createServer(app).listen(PORT, '0.0.0.0', () => console.log(`🚀 HTTP Server on ${PORT}`));
  }
};

startServer();
