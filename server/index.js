
import 'dotenv/config'; // CRITICAL: Must be first import to load .env before other modules
import express from 'express';
import cors from 'cors';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import { initEmail, startEmailWorker } from './services/email.js';
import { startRideWorker } from './services/rideWorker.js'; 
import { checkAndGenerateMissingVariants } from './services/imageProcessor.js'; // NEW IMPORT

// ROUTES IMPORTS
import authRoutes from './routes/users.js'; 
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import bootstrapRoutes from './routes/bootstrap.js';
import settingsRoutes from './routes/settings.js';
import aiRoutes from './routes/ai.js';
import statsRoutes from './routes/stats.js';
import notificationRoutes from './routes/notifications.js';
import ridesRoutes from './routes/rides.js';

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

// Check JWT Secret
if (!process.env.JWT_SECRET) {
    console.warn("⚠️  VAROVÁNÍ: JWT_SECRET není nastaven v .env souboru. Používá se výchozí (nebezpečný) klíč.");
} else {
    console.log("🔒 JWT_SECRET načten z .env.");
}

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
app.use('/api/bootstrap', bootstrapRoutes);
app.use('/api/users', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', aiRoutes);
app.use('/api/admin/rides', ridesRoutes);
app.use('/api/admin/stats', statsRoutes);
app.use('/api', settingsRoutes);
app.use('/api/notifications', notificationRoutes);

// --- ERROR HANDLING MIDDLEWARE ---
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }
    if (err.code === 'ECONNABORTED' || (err.message && err.message.includes('aborted'))) {
        console.warn(`⚠️ Request aborted by client: ${req.method} ${req.originalUrl}`);
        return;
    }
    
    console.error("❌ Unhandled Server Error:", err);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

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
        
        await db.query(`CREATE TABLE IF NOT EXISTS rides (
            id VARCHAR(50) PRIMARY KEY,
            date DATE,
            driver_id VARCHAR(50),
            status VARCHAR(20),
            departure_time VARCHAR(10),
            order_ids JSON,
            steps JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

        await db.query(`CREATE TABLE IF NOT EXISTS email_queue (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type VARCHAR(50),
            recipient_email VARCHAR(255),
            subject VARCHAR(255),
            status ENUM('pending', 'processing', 'sent', 'error') DEFAULT 'pending',
            error_message TEXT,
            payload JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP NULL
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

        await db.query(`CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(50),
            endpoint TEXT NOT NULL,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_endpoint (endpoint(255))
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

        await db.query(`CREATE TABLE IF NOT EXISTS notification_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            subject VARCHAR(255),
            body TEXT,
            recipient_count INT,
            filters JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

        await db.query(`CREATE TABLE IF NOT EXISTS push_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(50),
            title VARCHAR(255),
            body TEXT,
            status ENUM('sent', 'error') DEFAULT 'sent',
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

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
  await initDb();
  await initEmail();
  startEmailWorker();
  startRideWorker();
  
  // Background task: Check existing images and generate optimized versions if missing
  checkAndGenerateMissingVariants(); 

  const sslKey = process.env.SSL_KEY_PATH;
  const sslCert = process.env.SSL_CERT_PATH; 
  
  if (sslKey && sslCert && fs.existsSync(sslKey) && fs.existsSync(sslCert)) {
      https.createServer({ key: fs.readFileSync(sslKey), cert: fs.readFileSync(sslCert) }, app).listen(PORT, '0.0.0.0', () => console.log(`🚀 HTTPS Server on ${PORT}`));
  } else {
      http.createServer(app).listen(PORT, '0.0.0.0', () => console.log(`🚀 HTTP Server on ${PORT}`));
  }
};

startServer();
