
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

// 1. Explicitly load .env from the current directory (server/)
const envPath = path.resolve(__dirname, '.env');
console.log(`📂 Loading configuration from: ${envPath}`);

const result = dotenv.config({ path: envPath });
if (result.error) {
  console.warn("⚠️ Warning: .env file not found at specified path. Trying default lookup...");
  dotenv.config(); // Fallback to default
}

const app = express();
const PORT = process.env.PORT || 3000;

// Log loaded configuration (masking sensitive data)
console.log('🔧 Active Configuration:');
console.log(`   - DB Host: ${process.env.DB_HOST || 'UNDEFINED (Using default: localhost)'}`);
console.log(`   - DB User: ${process.env.DB_USER || 'UNDEFINED (Using default: root)'}`);
console.log(`   - DB Name: ${process.env.DB_NAME || 'UNDEFINED (Using default: 4gracie_db)'}`);
console.log(`   - DB Pass: ${process.env.DB_PASSWORD ? '******' : '(empty)'}`);
console.log(`   - SSL Key: ${process.env.SSL_KEY_PATH || 'Not set'}`);
console.log(`   - SSL Cert: ${process.env.SSL_CERT_PATH || 'Not set'}`);

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// --- MOCK DATA STORE (Fallback if DB is missing) ---
const DEFAULT_SETTINGS_SEED = {
  defaultCapacities: {
    'warm': 1000,
    'cold': 2000,
    'dessert': 500,
    'drink': 5000
  },
  companyDetails: {
    name: '4Gracie s.r.o. (DB)',
    ic: '12345678',
    dic: 'CZ12345678',
    street: 'Václavské náměstí 1',
    city: 'Praha 1',
    zip: '110 00',
    email: 'info@4gracie.cz',
    phone: '+420 123 456 789',
    bankAccount: '2701000000/2010',
    bic: 'RZBCCZPP' 
  },
  paymentMethods: [
    { id: 'gateway', label: 'Online karta / Apple Pay', description: 'Rychlá a bezpečná platba kartou přes platební bránu.', enabled: true },
    { id: 'qr', label: 'QR Platba', description: 'Okamžitý převod z vaší bankovní aplikace pomocí QR kódu.', enabled: true },
    { id: 'cash', label: 'Hotovost / Karta na místě', description: 'Platba při převzetí na prodejně.', enabled: true }
  ],
  deliveryRegions: [
    { id: '1', name: 'Praha Centrum', zips: ['11000', '12000'], price: 150, freeFrom: 2000, enabled: true, deliveryTimeStart: '10:00', deliveryTimeEnd: '14:00' },
  ],
  packaging: {
    types: [
      { id: 'box-small', name: 'Malá krabice', volume: 500, price: 15 },
      { id: 'box-medium', name: 'Střední krabice', volume: 1500, price: 35 },
      { id: 'box-large', name: 'Velká krabice', volume: 3000, price: 60 }
    ],
    freeFrom: 5000
  }
};

// Database Connection Helper
let pool = null;

const initDb = async (db) => {
  try {
    const tableQueries = [
      `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255),
        role VARCHAR(50),
        data JSON
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      
      `CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(255) PRIMARY KEY,
        category VARCHAR(50),
        is_deleted BOOLEAN DEFAULT FALSE,
        data JSON
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      
      `CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        delivery_date VARCHAR(20),
        status VARCHAR(50),
        total_price DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data JSON
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      
      `CREATE TABLE IF NOT EXISTS app_settings (
        key_name VARCHAR(50) PRIMARY KEY,
        data JSON
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      
      `CREATE TABLE IF NOT EXISTS discounts (
        id VARCHAR(255) PRIMARY KEY,
        code VARCHAR(50),
        data JSON
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      
      `CREATE TABLE IF NOT EXISTS calendar_exceptions (
        date VARCHAR(20) PRIMARY KEY,
        data JSON
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    ];

    for (const query of tableQueries) {
      await db.query(query);
    }

    const [settingsRows] = await db.query('SELECT * FROM app_settings WHERE key_name = "global"');
    if (settingsRows.length === 0) {
       console.log('🌱 Seeding default settings into DB...');
       await db.query('INSERT INTO app_settings (key_name, data) VALUES ("global", ?)', [JSON.stringify(DEFAULT_SETTINGS_SEED)]);
    }

    console.log('✅ Database tables initialized successfully.');
  } catch (err) {
    console.error('❌ Failed to initialize database tables:', err.message);
  }
};

const getDb = async () => {
  if (pool) return pool;
  try {
    console.log('⏳ Attempting to connect to database...');
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || '4gracie_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000, // Increased timeout
      ssl: {
        rejectUnauthorized: false // Often required for remote connections if certs aren't perfect
      }
    });
    
    // Test connection
    const connection = await pool.getConnection();
    console.log(`✅ Connected to MariaDB at ${process.env.DB_HOST || 'localhost'}`);
    
    await initDb(connection);
    
    connection.release();
    return pool;
  } catch (err) {
    console.error(`❌ Database connection failed [${process.env.DB_HOST}]:`, err.message);
    if (err.code === 'ECONNREFUSED') {
       console.error('   -> Connection refused. Check if IP/Port is correct and firewall allows access.');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
       console.error('   -> Access denied. Check username/password.');
    }
    pool = null; 
    return null;
  }
};

// Helper to parse JSON from DB
const parseData = (rows) => rows.map(row => {
  const jsonData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return { ...jsonData, id: row.id || row.key_name || row.date };
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

app.post('/api/orders', async (req, res) => {
  const order = req.body;
  const db = await getDb();
  if (db) {
    try {
      await db.query(
        'INSERT INTO orders (id, user_id, delivery_date, status, total_price, data) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = ?, total_price = ?, data = ?',
        [order.id, order.userId, order.deliveryDate, order.status, order.totalPrice, JSON.stringify(order), order.status, order.totalPrice, JSON.stringify(order)]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.put('/api/orders/status', async (req, res) => {
  const { ids, status } = req.body;
  const db = await getDb();
  if (db) {
    try {
      for (const id of ids) {
         await db.query(`UPDATE orders SET status = ?, data = JSON_SET(data, '$.status', ?) WHERE id = ?`, [status, status, id]);
      }
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.post('/api/products', async (req, res) => {
  const product = req.body;
  const db = await getDb();
  if (db) {
    try {
      await db.query(
        'INSERT INTO products (id, category, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE category = ?, data = ?',
        [product.id, product.category, JSON.stringify(product), product.category, JSON.stringify(product)]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const db = await getDb();
  if (db) {
    try {
      await db.query('UPDATE products SET is_deleted = TRUE WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.post('/api/users', async (req, res) => {
  const user = req.body;
  const db = await getDb();
  if (db) {
    try {
      await db.query(
        'INSERT INTO users (id, email, role, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE email = ?, role = ?, data = ?',
        [user.id, user.email, user.role, JSON.stringify(user), user.email, user.role, JSON.stringify(user)]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.post('/api/settings', async (req, res) => {
  const settings = req.body;
  const db = await getDb();
  if (db) {
    try {
      await db.query(
        'INSERT INTO app_settings (key_name, data) VALUES ("global", ?) ON DUPLICATE KEY UPDATE data = ?',
        [JSON.stringify(settings), JSON.stringify(settings)]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.post('/api/discounts', async (req, res) => {
  const discount = req.body;
  const db = await getDb();
  if (db) {
    try {
      await db.query(
        'INSERT INTO discounts (id, code, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = ?',
        [discount.id, discount.code, JSON.stringify(discount), JSON.stringify(discount)]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.delete('/api/discounts/:id', async (req, res) => {
  const { id } = req.params;
  const db = await getDb();
  if (db) {
    try {
      await db.query('DELETE FROM discounts WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.post('/api/calendar', async (req, res) => {
  const config = req.body;
  const db = await getDb();
  if (db) {
    try {
      await db.query(
        'INSERT INTO calendar_exceptions (date, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?',
        [config.date, JSON.stringify(config), JSON.stringify(config)]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.delete('/api/calendar/:date', async (req, res) => {
  const { date } = req.params;
  const db = await getDb();
  if (db) {
    try {
      await db.query('DELETE FROM calendar_exceptions WHERE date = ?', [date]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// --- SERVER STARTUP (HTTP/HTTPS) ---

const startServer = () => {
  const keyPath = process.env.SSL_KEY_PATH;
  const certPath = process.env.SSL_CERT_PATH;
  
  if (keyPath && certPath) {
    // Try HTTPS
    try {
      if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        throw new Error(`SSL files not found. Key: ${keyPath}, Cert: ${certPath}`);
      }
      
      const httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
      
      https.createServer(httpsOptions, app).listen(PORT, () => {
        console.log(`🔒 SECURE Backend running on https://localhost:${PORT}`);
      });
      return;
    } catch (error) {
      console.error('⚠️ HTTPS Setup Failed:', error.message);
      console.log('➡️ Falling back to HTTP...');
    }
  }

  // HTTP Fallback
  http.createServer(app).listen(PORT, () => {
    console.log(`🔓 Backend running on http://localhost:${PORT}`);
  });
};

startServer();
