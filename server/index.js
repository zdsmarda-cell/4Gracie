
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
  path.resolve(__dirname, '.env'),           // server/
  path.resolve(process.cwd(), '.env'),       // root
  path.resolve(__dirname, '..', '.env')      // one up
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

const app = express();
const PORT = process.env.PORT || 3000;

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
let lastDbError = null; // Global variable to store last connection error for diagnostics

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
    if (!process.env.DB_HOST) throw new Error("DB_HOST is not defined in .env");

    const newPool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || '4gracie_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
      ssl: { rejectUnauthorized: false }
    });
    
    // Explicitly test connection to capture error immediately
    const connection = await newPool.getConnection();
    console.log(`✅ Connected to MariaDB at ${process.env.DB_HOST}`);
    
    await initDb(connection);
    connection.release();
    
    pool = newPool;
    lastDbError = null; // Clear any previous error
    return pool;
  } catch (err) {
    lastDbError = `${err.code ? err.code + ': ' : ''}${err.message}`;
    console.error(`❌ Database connection failed: ${lastDbError}`);
    pool = null; 
    return null;
  }
};

const parseData = (rows) => rows.map(row => {
  const jsonData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return { ...jsonData, id: row.id || row.key_name || row.date };
});

// --- HELPER: RESOLVE SSL PATHS ---
const resolvePath = (p) => {
  if (!p) return null;
  if (path.isAbsolute(p)) return p;
  // Try relative to CWD
  const cwdPath = path.resolve(process.cwd(), p);
  if (fs.existsSync(cwdPath)) return cwdPath;
  // Try relative to this file
  const dirPath = path.resolve(__dirname, p);
  if (fs.existsSync(dirPath)) return dirPath;
  return cwdPath; // Return the standard relative one as default for error reporting
};

// --- DIAGNOSTIC ENDPOINT ---
app.get('/api/health', async (req, res) => {
  // Trigger DB connection attempt if not already connected
  if (!pool) await getDb();

  const sslKeyRaw = process.env.SSL_KEY_PATH;
  const sslCertRaw = process.env.SSL_CERT_PATH;
  const sslKeyResolved = resolvePath(sslKeyRaw);
  const sslCertResolved = resolvePath(sslCertRaw);

  res.json({
    server: 'Running',
    protocol: req.protocol,
    secure: req.secure,
    envLoaded: envLoaded,
    sslConfig: {
      keyDefined: !!sslKeyRaw,
      certDefined: !!sslCertRaw,
      keyPathChecked: sslKeyResolved || 'N/A',
      certPathChecked: sslCertResolved || 'N/A',
      keyExists: sslKeyResolved ? fs.existsSync(sslKeyResolved) : false,
      certExists: sslCertResolved ? fs.existsSync(sslCertResolved) : false
    },
    dbConfig: {
      host: process.env.DB_HOST || 'UNDEFINED',
      user: process.env.DB_USER || 'UNDEFINED',
      db: process.env.DB_NAME || 'UNDEFINED'
    },
    databaseStatus: pool ? 'Connected' : 'Disconnected',
    lastDbError: lastDbError // This will now contain the real error message
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
    // Return the actual connection error if available
    res.status(500).json({ error: 'Database connection failed', details: lastDbError });
  }
});

// ... Standard CRUD endpoints wrapper ...
const withDb = (handler) => async (req, res) => {
  const db = await getDb();
  if (db) {
    try {
      await handler(req, res, db);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(500).json({ error: 'Database connection failed', details: lastDbError });
  }
};

app.post('/api/orders', withDb(async (req, res, db) => {
  const o = req.body;
  await db.query('INSERT INTO orders (id, user_id, delivery_date, status, total_price, data) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status=?, total_price=?, data=?', [o.id, o.userId, o.deliveryDate, o.status, o.totalPrice, JSON.stringify(o), o.status, o.totalPrice, JSON.stringify(o)]);
  res.json({ success: true });
}));

app.put('/api/orders/status', withDb(async (req, res, db) => {
  for (const id of req.body.ids) await db.query(`UPDATE orders SET status=?, data=JSON_SET(data, '$.status', ?) WHERE id=?`, [req.body.status, req.body.status, id]);
  res.json({ success: true });
}));

app.post('/api/products', withDb(async (req, res, db) => {
  const p = req.body;
  await db.query('INSERT INTO products (id, category, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE category=?, data=?', [p.id, p.category, JSON.stringify(p), p.category, JSON.stringify(p)]);
  res.json({ success: true });
}));

app.delete('/api/products/:id', withDb(async (req, res, db) => {
  await db.query('UPDATE products SET is_deleted=TRUE WHERE id=?', [req.params.id]);
  res.json({ success: true });
}));

app.post('/api/users', withDb(async (req, res, db) => {
  const u = req.body;
  await db.query('INSERT INTO users (id, email, role, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE email=?, role=?, data=?', [u.id, u.email, u.role, JSON.stringify(u), u.email, u.role, JSON.stringify(u)]);
  res.json({ success: true });
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

// --- SERVER STARTUP (HTTP/HTTPS) ---

const startServer = () => {
  const keyPathRaw = process.env.SSL_KEY_PATH;
  const certPathRaw = process.env.SSL_CERT_PATH;
  
  const keyPath = resolvePath(keyPathRaw);
  const certPath = resolvePath(certPathRaw);

  if (keyPath && certPath && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    try {
      const httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
      https.createServer(httpsOptions, app).listen(PORT, () => {
        console.log(`🔒 SECURE Backend running on https://localhost:${PORT}`);
        console.log(`   SSL Key: ${keyPath}`);
      });
      return;
    } catch (error) {
      console.error('⚠️ HTTPS Setup Failed (falling back to HTTP):', error.message);
    }
  } else {
    if (keyPathRaw || certPathRaw) {
       console.log('⚠️ SSL configuration present but files not found:');
       console.log(`   Key:  ${keyPathRaw} -> Resolved: ${keyPath} (${fs.existsSync(keyPath) ? 'Found' : 'Missing'})`);
       console.log(`   Cert: ${certPathRaw} -> Resolved: ${certPath} (${fs.existsSync(certPath) ? 'Found' : 'Missing'})`);
    }
  }

  // HTTP Fallback
  http.createServer(app).listen(PORT, () => {
    console.log(`🔓 Backend running on http://localhost:${PORT}`);
  });
};

startServer();
