
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// --- MOCK DATA STORE (Fallback if DB is missing) ---
const mockStore = {
  users: [],
  products: [],
  orders: [],
  settings: null,
  discounts: [],
  calendar: []
};

// Database Connection Helper
let pool = null;

const getDb = async () => {
  if (pool) return pool;
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || '4gracie_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 2000 // Fast fail for dev
    });
    // Test connection
    await pool.getConnection();
    console.log('✅ Connected to MariaDB');
    return pool;
  } catch (err) {
    console.warn('⚠️  Database connection failed. Switching to MEMORY MODE.');
    console.warn(`   Error: ${err.message}`);
    pool = null; 
    return null;
  }
};

// Helper to parse JSON from DB
const parseData = (rows) => rows.map(row => ({ ...row.data, id: row.id || row.key_name || row.date }));

// --- API ENDPOINTS ---

// 1. BOOTSTRAP (Load everything on startup)
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
        settings: settings.length > 0 ? settings[0].data : null,
        discountCodes: parseData(discounts),
        dayConfigs: parseData(calendar)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database query failed' });
    }
  } else {
    // Memory Mode Response
    res.json({
      users: mockStore.users,
      products: mockStore.products,
      orders: mockStore.orders,
      settings: mockStore.settings,
      discountCodes: mockStore.discounts,
      dayConfigs: mockStore.calendar
    });
  }
});

// 2. ORDERS
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
      res.status(500).json({ error: err.message });
    }
  } else {
    // Memory Mode
    const idx = mockStore.orders.findIndex(o => o.id === order.id);
    if (idx >= 0) mockStore.orders[idx] = order;
    else mockStore.orders.unshift(order); // Newest first
    res.json({ success: true });
  }
});

app.put('/api/orders/status', async (req, res) => {
  const { ids, status } = req.body;
  const db = await getDb();
  
  if (db) {
    try {
      await db.query('UPDATE orders SET status = ? WHERE id IN (?)', [status, ids]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    // Memory Mode
    mockStore.orders = mockStore.orders.map(o => ids.includes(o.id) ? { ...o, status } : o);
    res.json({ success: true });
  }
});

// 3. PRODUCTS
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
      res.status(500).json({ error: err.message });
    }
  } else {
    // Memory Mode
    const idx = mockStore.products.findIndex(p => p.id === product.id);
    if (idx >= 0) mockStore.products[idx] = product;
    else mockStore.products.push(product);
    res.json({ success: true });
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
      res.status(500).json({ error: err.message });
    }
  } else {
    // Memory Mode
    mockStore.products = mockStore.products.filter(p => p.id !== id);
    res.json({ success: true });
  }
});

// 4. USERS
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
      res.status(500).json({ error: err.message });
    }
  } else {
    // Memory Mode
    const idx = mockStore.users.findIndex(u => u.id === user.id);
    if (idx >= 0) mockStore.users[idx] = user;
    else mockStore.users.push(user);
    res.json({ success: true });
  }
});

// 5. SETTINGS
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
      res.status(500).json({ error: err.message });
    }
  } else {
    // Memory Mode
    mockStore.settings = settings;
    res.json({ success: true });
  }
});

// 6. DISCOUNTS
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
      res.status(500).json({ error: err.message });
    }
  } else {
    // Memory Mode
    const idx = mockStore.discounts.findIndex(d => d.id === discount.id);
    if (idx >= 0) mockStore.discounts[idx] = discount;
    else mockStore.discounts.push(discount);
    res.json({ success: true });
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
      res.status(500).json({ error: err.message });
    }
  } else {
    // Memory Mode
    mockStore.discounts = mockStore.discounts.filter(d => d.id !== id);
    res.json({ success: true });
  }
});

// 7. CALENDAR
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
      res.status(500).json({ error: err.message });
    }
  } else {
    // Memory Mode
    const idx = mockStore.calendar.findIndex(c => c.date === config.date);
    if (idx >= 0) mockStore.calendar[idx] = config;
    else mockStore.calendar.push(config);
    res.json({ success: true });
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
      res.status(500).json({ error: err.message });
    }
  } else {
    // Memory Mode
    mockStore.calendar = mockStore.calendar.filter(c => c.date !== date);
    res.json({ success: true });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log('Mode: ' + (pool ? 'MariaDB' : 'Memory Fallback'));
});
