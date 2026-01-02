
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- ROBUST .ENV LOADING ---
const pathsToCheck = [
  path.resolve(__dirname, '.env'),           // Same dir as index.js (server/)
  path.resolve(process.cwd(), '.env'),       // Where node was run from
  path.resolve(__dirname, '..', '.env')      // One level up
];

let envLoaded = false;
for (const p of pathsToCheck) {
  if (fs.existsSync(p)) {
    console.log(`✅ FOUND config file at: ${p}`);
    const result = dotenv.config({ path: p });
    if (!result.error) {
      envLoaded = true;
      break;
    }
  }
}

if (!envLoaded) {
  console.error("❌ ERROR: .env file NOT found in any of these paths:", pathsToCheck);
  console.error("   Server will likely fail to connect to DB or start HTTPS.");
}

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION DEBUG LOG ---
console.log('------------------------------------------------');
console.log('🔧 SERVER CONFIGURATION DEBUG');
console.log('------------------------------------------------');
console.log(`Date: ${new Date().toISOString()}`);
console.log(`DB_HOST:       '${process.env.DB_HOST}'`);
console.log(`DB_NAME:       '${process.env.DB_NAME}'`);
console.log(`DB_USER:       '${process.env.DB_USER}'`);
console.log(`DB_PASSWORD:   ${process.env.DB_PASSWORD ? '****** (Set)' : '❌ NOT SET'}`);
console.log(`SSL_KEY_PATH:  '${process.env.SSL_KEY_PATH}'`);
console.log(`SSL_CERT_PATH: '${process.env.SSL_CERT_PATH}'`);
console.log('------------------------------------------------');

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// --- MOCK DATA STORE (Fallback) ---
const DEFAULT_SETTINGS_SEED = {
  defaultCapacities: { 'warm': 1000, 'cold': 2000, 'dessert': 500, 'drink': 5000 },
  companyDetails: { name: '4Gracie s.r.o. (DB)', ic: '12345678', dic: 'CZ12345678', street: 'Václavské náměstí 1', city: 'Praha 1', zip: '110 00', email: 'info@4gracie.cz', phone: '+420 123 456 789', bankAccount: '2701000000/2010', bic: 'RZBCCZPP' },
  paymentMethods: [
    { id: 'gateway', label: 'Online karta / Apple Pay', description: 'Rychlá a bezpečná platba kartou přes platební bránu.', enabled: true },
    { id: 'qr', label: 'QR Platba', description: 'Okamžitý převod z vaší bankovní aplikace pomocí QR kódu.', enabled: true },
    { id: 'cash', label: 'Hotovost / Karta na místě', description: 'Platba při převzetí na prodejně.', enabled: true }
  ],
  deliveryRegions: [{ id: '1', name: 'Praha Centrum', zips: ['11000', '12000'], price: 150, freeFrom: 2000, enabled: true, deliveryTimeStart: '10:00', deliveryTimeEnd: '14:00' }],
  packaging: { types: [{ id: 'box-small', name: 'Malá krabice', volume: 500, price: 15 }, { id: 'box-medium', name: 'Střední krabice', volume: 1500, price: 35 }, { id: 'box-large', name: 'Velká krabice', volume: 3000, price: 60 }], freeFrom: 5000 }
};

// Database Connection Helper
let pool = null;

const initDb = async (db) => {
  try {
    const tableQueries = [
      `CREATE TABLE IF NOT EXISTS users (id VARCHAR(255) PRIMARY KEY, email VARCHAR(255), role VARCHAR(50), data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS products (id VARCHAR(255) PRIMARY KEY, category VARCHAR(50), is_deleted BOOLEAN DEFAULT FALSE, data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS orders (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), delivery_date VARCHAR(20), status VARCHAR(50), total_price DECIMAL(10,2), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS app_settings (key_name VARCHAR(50) PRIMARY KEY, data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS discounts (id VARCHAR(255) PRIMARY KEY, code VARCHAR(50), data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS calendar_exceptions (date VARCHAR(20) PRIMARY KEY, data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    ];
    for (const query of tableQueries) await db.query(query);
    const [settingsRows] = await db.query('SELECT * FROM app_settings WHERE key_name = "global"');
    if (settingsRows.length === 0) await db.query('INSERT INTO app_settings (key_name, data) VALUES ("global", ?)', [JSON.stringify(DEFAULT_SETTINGS_SEED)]);
    console.log('✅ Database tables initialized successfully.');
  } catch (err) {
    console.error('❌ Failed to initialize database tables:', err.message);
  }
};

const getDb = async () => {
  if (pool) return pool;
  try {
    // Check critical vars
    if (!process.env.DB_HOST) throw new Error("DB_HOST is missing in env");

    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || '4gracie_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
      ssl: { rejectUnauthorized: false } // Required for some remote hosts
    });
    
    const connection = await pool.getConnection();
    console.log(`✅ Connected to MariaDB at ${process.env.DB_HOST}`);
    await initDb(connection);
    connection.release();
    return pool;
  } catch (err) {
    console.error(`❌ Database connection failed [Host: ${process.env.DB_HOST}]:`);
    console.error(`   Error Code: ${err.code}`);
    console.error(`   Message: ${err.message}`);
    pool = null; 
    return null;
  }
};

const parseData = (rows) => rows.map(row => {
  const jsonData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return { ...jsonData, id: row.id || row.key_name || row.date };
});

// --- DIAGNOSTIC ENDPOINT (Open in Browser) ---
app.get('/api/health', async (req, res) => {
  let dbStatus = 'Unknown';
  let dbError = null;
  
  try {
    const db = await getDb();
    if (db) {
       await db.query('SELECT 1');
       dbStatus = 'Connected';
    } else {
       dbStatus = 'Failed to Connect';
    }
  } catch (e) {
    dbStatus = 'Error';
    dbError = e.message;
  }

  res.json({
    server: 'Running',
    protocol: req.protocol,
    secure: req.secure,
    envLoaded: envLoaded,
    config: {
      dbHost: process.env.DB_HOST || 'UNDEFINED',
      dbUser: process.env.DB_USER || 'UNDEFINED',
      dbName: process.env.DB_NAME || 'UNDEFINED',
      sslKeyFound: process.env.SSL_KEY_PATH ? fs.existsSync(process.env.SSL_KEY_PATH) : false,
      sslCertFound: process.env.SSL_CERT_PATH ? fs.existsSync(process.env.SSL_CERT_PATH) : false,
    },
    databaseConnection: dbStatus,
    lastDbError: dbError
  });
});

// --- API ENDPOINTS ---

app.get('/api/bootstrap', async (req, res) => {
  const db = await getDb();
  if (db) {
    try {
      const [users] = await db.query('SELECT * FROM users');
      const [products] = await db.query('SELECT * FROM products WHERE is_deleted = FALSE');
      const [orders] = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
      const [settings] = await db.query('SELECT * FROM app_settings WHERE key_name = "global"');
      const [discounts] = await db.query('SELECT * FROM discounts');
      const [calendar] = await db.query('SELECT * FROM calendar_exceptions');

      res.json({
        users: parseData(users),
        products: parseData(products),
        orders: parseData(orders),
        settings: settings.length > 0 ? (typeof settings[0].data === 'string' ? JSON.parse(settings[0].data) : settings[0].data) : null,
        discountCodes: parseData(discounts),
        dayConfigs: parseData(calendar)
      });
    } catch (err) {
      console.error('Query Error:', err);
      res.status(500).json({ error: 'Database query failed: ' + err.message });
    }
  } else {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// ... (Rest of POST/PUT/DELETE endpoints remain same, just updating getDb usage which is handled above) ...
app.post('/api/orders', async (req, res) => { const db = await getDb(); if(db) { try { const o=req.body; await db.query('INSERT INTO orders (id, user_id, delivery_date, status, total_price, data) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status=?, total_price=?, data=?', [o.id, o.userId, o.deliveryDate, o.status, o.totalPrice, JSON.stringify(o), o.status, o.totalPrice, JSON.stringify(o)]); res.json({success:true}); } catch(e){ res.status(500).json({error:e.message}); } } else res.status(500).json({error:'DB Failed'}) });
app.put('/api/orders/status', async (req, res) => { const db = await getDb(); if(db) { try { for(const id of req.body.ids) await db.query(`UPDATE orders SET status=?, data=JSON_SET(data, '$.status', ?) WHERE id=?`, [req.body.status, req.body.status, id]); res.json({success:true}); } catch(e){ res.status(500).json({error:e.message}); } } else res.status(500).json({error:'DB Failed'}) });
app.post('/api/products', async (req, res) => { const db = await getDb(); if(db) { try { const p=req.body; await db.query('INSERT INTO products (id, category, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE category=?, data=?', [p.id, p.category, JSON.stringify(p), p.category, JSON.stringify(p)]); res.json({success:true}); } catch(e){ res.status(500).json({error:e.message}); } } else res.status(500).json({error:'DB Failed'}) });
app.delete('/api/products/:id', async (req, res) => { const db = await getDb(); if(db) { try { await db.query('UPDATE products SET is_deleted=TRUE WHERE id=?', [req.params.id]); res.json({success:true}); } catch(e){ res.status(500).json({error:e.message}); } } else res.status(500).json({error:'DB Failed'}) });
app.post('/api/users', async (req, res) => { const db = await getDb(); if(db) { try { const u=req.body; await db.query('INSERT INTO users (id, email, role, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE email=?, role=?, data=?', [u.id, u.email, u.role, JSON.stringify(u), u.email, u.role, JSON.stringify(u)]); res.json({success:true}); } catch(e){ res.status(500).json({error:e.message}); } } else res.status(500).json({error:'DB Failed'}) });
app.post('/api/settings', async (req, res) => { const db = await getDb(); if(db) { try { await db.query('INSERT INTO app_settings (key_name, data) VALUES ("global", ?) ON DUPLICATE KEY UPDATE data=?', [JSON.stringify(req.body), JSON.stringify(req.body)]); res.json({success:true}); } catch(e){ res.status(500).json({error:e.message}); } } else res.status(500).json({error:'DB Failed'}) });
app.post('/api/discounts', async (req, res) => { const db = await getDb(); if(db) { try { const d=req.body; await db.query('INSERT INTO discounts (id, code, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data=?', [d.id, d.code, JSON.stringify(d), JSON.stringify(d)]); res.json({success:true}); } catch(e){ res.status(500).json({error:e.message}); } } else res.status(500).json({error:'DB Failed'}) });
app.delete('/api/discounts/:id', async (req, res) => { const db = await getDb(); if(db) { try { await db.query('DELETE FROM discounts WHERE id=?', [req.params.id]); res.json({success:true}); } catch(e){ res.status(500).json({error:e.message}); } } else res.status(500).json({error:'DB Failed'}) });
app.post('/api/calendar', async (req, res) => { const db = await getDb(); if(db) { try { const c=req.body; await db.query('INSERT INTO calendar_exceptions (date, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data=?', [c.date, JSON.stringify(c), JSON.stringify(c)]); res.json({success:true}); } catch(e){ res.status(500).json({error:e.message}); } } else res.status(500).json({error:'DB Failed'}) });
app.delete('/api/calendar/:date', async (req, res) => { const db = await getDb(); if(db) { try { await db.query('DELETE FROM calendar_exceptions WHERE date=?', [req.params.date]); res.json({success:true}); } catch(e){ res.status(500).json({error:e.message}); } } else res.status(500).json({error:'DB Failed'}) });

// --- SERVER STARTUP (HTTP/HTTPS) ---

const startServer = () => {
  const keyPath = process.env.SSL_KEY_PATH;
  const certPath = process.env.SSL_CERT_PATH;
  
  if (keyPath && certPath) {
    try {
      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        const httpsOptions = {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath)
        };
        https.createServer(httpsOptions, app).listen(PORT, () => {
          console.log(`🔒 SECURE Backend running on https://localhost:${PORT}`);
          console.log(`   (Accessible via https://eshop.4gracie.cz:${PORT})`);
        });
        return;
      } else {
        console.error('⚠️  SSL Files defined in .env but NOT found on disk.');
      }
    } catch (error) {
      console.error('⚠️ HTTPS Setup Failed:', error.message);
    }
  }

  // HTTP Fallback
  http.createServer(app).listen(PORT, () => {
    console.log(`🔓 Backend running on http://localhost:${PORT}`);
    console.log(`   (SSL keys missing or invalid, verify paths in .env)`);
  });
};

startServer();
