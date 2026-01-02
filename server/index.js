
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
import nodemailer from 'nodemailer';

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

// --- EMAIL SETUP ---
let transporter = null;
if (process.env.SMTP_HOST) {
    const smtpConfig = {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 465,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        // CRITICAL FIX for Postfix "SSL_accept error":
        // Allow self-signed certificates or hostname mismatches within internal network
        tls: {
            rejectUnauthorized: false
        }
    };

    transporter = nodemailer.createTransport(smtpConfig);
    
    // Verify connection configuration
    transporter.verify(function (error, success) {
        if (error) {
            console.error('❌ SMTP Connection Error:', error);
        } else {
            console.log(`📧 SMTP Server is ready to take our messages (${process.env.SMTP_HOST})`);
        }
    });
} else {
    console.warn('⚠️ SMTP settings not found. Emails will NOT be sent.');
}

const sendEmail = async (to, subject, html) => {
    if (!transporter) {
        console.warn(`⚠️ Cannot send email to ${to}: Transporter not configured.`);
        return false;
    }
    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"4Gracie" <info@4gracie.cz>',
            to,
            subject,
            html,
        });
        console.log(`📧 Email sent to ${to}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        return false;
    }
};

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
let lastDbError = null; 

// Definition of tables for easy maintenance
const TABLE_DEFINITIONS = [
  { name: 'users', query: `CREATE TABLE IF NOT EXISTS users (id VARCHAR(255) PRIMARY KEY, email VARCHAR(255), role VARCHAR(50), data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` },
  { name: 'products', query: `CREATE TABLE IF NOT EXISTS products (id VARCHAR(255) PRIMARY KEY, category VARCHAR(50), is_deleted BOOLEAN DEFAULT FALSE, data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` },
  { name: 'orders', query: `CREATE TABLE IF NOT EXISTS orders (id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255), delivery_date VARCHAR(20), status VARCHAR(50), total_price DECIMAL(10,2), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` },
  { name: 'app_settings', query: `CREATE TABLE IF NOT EXISTS app_settings (key_name VARCHAR(50) PRIMARY KEY, data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` },
  { name: 'discounts', query: `CREATE TABLE IF NOT EXISTS discounts (id VARCHAR(255) PRIMARY KEY, code VARCHAR(50), data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` },
  { name: 'calendar_exceptions', query: `CREATE TABLE IF NOT EXISTS calendar_exceptions (date VARCHAR(20) PRIMARY KEY, data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` }
];

const initDb = async (db) => {
  try {
    for (const def of TABLE_DEFINITIONS) {
      await db.query(def.query);
    }
    
    // Seed settings if empty
    const [settingsRows] = await db.query('SELECT * FROM app_settings WHERE key_name = "global"');
    if (settingsRows.length === 0) {
      await db.query('INSERT INTO app_settings (key_name, data) VALUES ("global", ?)', [JSON.stringify(DEFAULT_SETTINGS_SEED)]);
    }
    console.log('✅ Database tables initialized successfully.');
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to initialize database tables:', err.message);
    return { success: false, error: err.message };
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
      // SSL removed
    });
    
    const connection = await newPool.getConnection();
    console.log(`✅ Connected to MariaDB at ${process.env.DB_HOST}`);
    
    // Attempt init, but don't fail getDb if it fails (so we can see error in /health or /setup)
    const initResult = await initDb(connection);
    if (!initResult.success) {
      lastDbError = `Connection OK, but Table Init Failed: ${initResult.error}`;
    }

    connection.release();
    pool = newPool;
    if (!lastDbError) lastDbError = null;
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

const resolvePath = (p) => {
  if (!p) return null;
  if (path.isAbsolute(p)) return p;
  const cwdPath = path.resolve(process.cwd(), p);
  if (fs.existsSync(cwdPath)) return cwdPath;
  const dirPath = path.resolve(__dirname, p);
  if (fs.existsSync(dirPath)) return dirPath;
  return cwdPath;
};

// --- ENDPOINTS ---

app.get('/api/health', async (req, res) => {
  if (!pool) await getDb();
  res.json({
    server: 'Running',
    databaseStatus: pool ? 'Connected' : 'Disconnected',
    lastDbError: lastDbError,
    smtpConfigured: !!process.env.SMTP_HOST
  });
});

// --- MANUAL SETUP ENDPOINT ---
app.get('/api/setup', async (req, res) => {
  const db = await getDb();
  if (!db) {
    return res.status(500).json({ error: 'Cannot connect to DB', details: lastDbError });
  }

  const report = [];
  try {
    const connection = await db.getConnection();
    
    for (const def of TABLE_DEFINITIONS) {
      try {
        await connection.query(def.query);
        report.push({ table: def.name, status: 'OK' });
      } catch (e) {
        report.push({ table: def.name, status: 'ERROR', details: e.message, code: e.code });
      }
    }

    // Check seed
    try {
        const [rows] = await connection.query('SELECT * FROM app_settings WHERE key_name = "global"');
        if (rows.length === 0) {
            await connection.query('INSERT INTO app_settings (key_name, data) VALUES ("global", ?)', [JSON.stringify(DEFAULT_SETTINGS_SEED)]);
            report.push({ seed: 'app_settings', status: 'INSERTED' });
        } else {
            report.push({ seed: 'app_settings', status: 'EXISTS' });
        }
    } catch(e) {
        report.push({ seed: 'app_settings', status: 'ERROR', details: e.message });
    }

    connection.release();
    res.json({ success: true, report });

  } catch (e) {
    res.status(500).json({ error: 'Setup fatal error', details: e.message });
  }
});

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
      // If table doesn't exist, provide a hint to run /api/setup
      res.status(500).json({ error: 'Database query failed: ' + err.message, hint: 'Try running /api/setup to create tables.' });
    }
  } else {
    res.status(500).json({ error: 'Database connection failed', details: lastDbError });
  }
});

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

// --- AUTH EMAIL ENDPOINT ---
app.post('/api/auth/reset-password', withDb(async (req, res, db) => {
  const { email } = req.body;
  
  // 1. Check if user exists
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  
  if (rows.length === 0) {
    // Security: Don't reveal if user exists, but success=true so frontend shows "If account exists, email sent"
    return res.json({ success: true, message: 'Pokud je email registrován, instrukce byly odeslány.' });
  }

  // 2. Generate Link
  // Note: For simplicity in this project, we create a basic base64 token containing email and expiry.
  // In a highly secure system, store a random token in DB.
  const tokenPayload = JSON.stringify({ email, exp: Date.now() + 3600000 }); // 1 hour expiry
  const token = Buffer.from(tokenPayload).toString('base64');
  
  // Determine frontend origin (handle dev localhost vs production)
  const origin = req.get('origin') || (req.protocol + '://' + req.get('host'));
  const link = `${origin}/#/reset-password?token=${token}`;

  // 3. Send Email
  if (transporter) {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1f2937;">Obnova hesla</h1>
        <p>Obdrželi jsme žádost o obnovu hesla pro účet spojený s emailem <strong>${email}</strong>.</p>
        <p>Pro nastavení nového hesla klikněte na tlačítko níže:</p>
        <br>
        <a href="${link}" style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Nastavit nové heslo</a>
        <br><br>
        <p style="color: #6b7280; font-size: 12px;">Odkaz je platný 1 hodinu. Pokud jste o změnu nežádali, tento email ignorujte.</p>
      </div>
    `;
    
    const sent = await sendEmail(email, 'Obnova hesla - 4Gracie', html);
    if (sent) {
        res.json({ success: true, message: 'Email s instrukcemi byl odeslán.' });
    } else {
        res.status(500).json({ success: false, message: 'Chyba při odesílání emailu.' });
    }
  } else {
    res.json({ success: false, message: 'Chyba serveru: Emailová služba není nakonfigurována.' });
  }
}));

app.post('/api/orders', withDb(async (req, res, db) => {
  const o = req.body;
  const isNew = !o.statusHistory || o.statusHistory.length <= 1; // Simplistic check if it's a fresh creation or first insert
  
  await db.query('INSERT INTO orders (id, user_id, delivery_date, status, total_price, data) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status=?, total_price=?, data=?', [o.id, o.userId, o.deliveryDate, o.status, o.totalPrice, JSON.stringify(o), o.status, o.totalPrice, JSON.stringify(o)]);
  
  // Send Email on New Order (if status is CREATED)
  if (o.status === 'created' && transporter) {
      // Find user email from DB or order (Order has userName, but userId links to users table. Order object might not have email directly if not in snapshots, but let's try to get it from DB)
      const [userRows] = await db.query('SELECT email FROM users WHERE id = ?', [o.userId]);
      const userEmail = userRows.length > 0 ? userRows[0].email : null;
      
      if (userEmail) {
          const subject = `Potvrzení objednávky #${o.id}`;
          const html = `
            <h1>Děkujeme za vaši objednávku!</h1>
            <p>Vaše objednávka <strong>#${o.id}</strong> byla přijata ke zpracování.</p>
            <p>Datum doručení: ${o.deliveryDate}</p>
            <p>Celková cena: <strong>${o.totalPrice + o.packagingFee + (o.deliveryFee||0)} Kč</strong></p>
            <br/>
            <p>Tým 4Gracie</p>
          `;
          sendEmail(userEmail, subject, html);
      }
  }

  res.json({ success: true });
}));

app.put('/api/orders/status', withDb(async (req, res, db) => {
  for (const id of req.body.ids) {
      await db.query(`UPDATE orders SET status=?, data=JSON_SET(data, '$.status', ?) WHERE id=?`, [req.body.status, req.body.status, id]);
      
      // Notify Customer if requested
      if (req.body.notifyCustomer && transporter) {
          const [rows] = await db.query('SELECT data FROM orders WHERE id = ?', [id]);
          if (rows.length > 0) {
              const orderData = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
              const [userRows] = await db.query('SELECT email FROM users WHERE id = ?', [orderData.userId]);
              if (userRows.length > 0) {
                  const subject = `Aktualizace objednávky #${id}`;
                  const html = `
                    <h1>Změna stavu objednávky</h1>
                    <p>Vaše objednávka <strong>#${id}</strong> změnila stav na:</p>
                    <h2 style="color: #9333ea;">${req.body.status.toUpperCase()}</h2>
                    <br/>
                    <p>Tým 4Gracie</p>
                  `;
                  sendEmail(userRows[0].email, subject, html);
              }
          }
      }
  }
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
  const isNew = await db.query('SELECT id FROM users WHERE id = ?', [u.id]).then(([rows]) => rows.length === 0);
  
  await db.query('INSERT INTO users (id, email, role, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE email=?, role=?, data=?', [u.id, u.email, u.role, JSON.stringify(u), u.email, u.role, JSON.stringify(u)]);
  
  // Send Welcome/Password Reset Email for new users
  if (isNew && transporter) {
      // Logic same as reset-password but with welcome message
      const tokenPayload = JSON.stringify({ email: u.email, exp: Date.now() + 3600000 * 24 }); // 24h
      const token = Buffer.from(tokenPayload).toString('base64');
      const origin = req.get('origin') || (req.protocol + '://' + req.get('host'));
      const link = `${origin}/#/reset-password?token=${token}`;

      const subject = `Vítejte v 4Gracie Catering`;
      const html = `
        <h1>Vítejte, ${u.name}!</h1>
        <p>Váš účet byl úspěšně vytvořen.</p>
        <p>Pro nastavení vašeho hesla a první přihlášení klikněte zde:</p>
        <a href="${link}">Nastavit heslo</a>
      `;
      sendEmail(u.email, subject, html);
  }

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

const startServer = () => {
  const keyPathRaw = process.env.SSL_KEY_PATH;
  const certPathRaw = process.env.SSL_CERT_PATH;
  const keyPath = resolvePath(keyPathRaw);
  const certPath = resolvePath(certPathRaw);

  if (keyPath && certPath && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    try {
      https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, app).listen(PORT, () => {
        console.log(`🔒 SECURE Backend running on https://localhost:${PORT}`);
      });
      return;
    } catch (error) {
      console.error('⚠️ HTTPS Setup Failed:', error.message);
    }
  }

  http.createServer(app).listen(PORT, () => {
    console.log(`🔓 Backend running on http://localhost:${PORT}`);
  });
};

startServer();
