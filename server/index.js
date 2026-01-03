
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
import { GoogleGenAI, Type } from "@google/genai";

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
app.use(bodyParser.json({ limit: '50mb' })); // Increased limit for backups

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

// Unified send function accepting options (like attachments)
const sendEmail = async (to, subject, html, attachments = []) => {
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
            attachments
        });
        console.log(`📧 Email sent to ${to}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        return false;
    }
};

// --- EMAIL TRANSLATIONS ---
const EMAIL_TRANSLATIONS = {
  cs: {
    statuses: {
      created: 'Vytvořena',
      confirmed: 'Potvrzená',
      preparing: 'Připravuje se',
      ready: 'Připravena',
      on_way: 'Na cestě',
      delivered: 'Doručena',
      not_picked_up: 'Nevyzvednuta',
      cancelled: 'Stornována'
    },
    headers: {
      image: 'Foto',
      qty: 'Ks',
      item: 'Položka',
      price: 'Cena',
      packaging: 'Balné',
      delivery: 'Doprava',
      total: 'CELKEM',
      discount: 'Sleva',
      date: 'Datum doručení'
    },
    footer: 'Děkujeme, že využíváte naše služby.<br/>Tým 4Gracie'
  },
  en: {
    statuses: {
      created: 'Created',
      confirmed: 'Confirmed',
      preparing: 'Preparing',
      ready: 'Ready',
      on_way: 'On the way',
      delivered: 'Delivered',
      not_picked_up: 'Not picked up',
      cancelled: 'Cancelled'
    },
    headers: {
      image: 'Photo',
      qty: 'Qty',
      item: 'Item',
      price: 'Price',
      packaging: 'Packaging',
      delivery: 'Delivery',
      total: 'TOTAL',
      discount: 'Discount',
      date: 'Delivery Date'
    },
    footer: 'Thank you for choosing our services.<br/>Team 4Gracie'
  },
  de: {
    statuses: {
      created: 'Erstellt',
      confirmed: 'Bestätigt',
      preparing: 'In Vorbereitung',
      ready: 'Bereit',
      on_way: 'Unterwegs',
      delivered: 'Geliefert',
      not_picked_up: 'Nicht abgeholt',
      cancelled: 'Storniert'
    },
    headers: {
      image: 'Foto',
      qty: 'Menge',
      item: 'Artikel',
      price: 'Preis',
      packaging: 'Verpackung',
      delivery: 'Lieferung',
      total: 'GESAMT',
      discount: 'Rabatt',
      date: 'Lieferdatum'
    },
    footer: 'Vielen Dank, dass Sie unsere Dienste nutzen.<br/>Team 4Gracie'
  }
};

// --- EMAIL TEMPLATE GENERATOR ---
const generateOrderEmailHtml = (order, title, subTitle) => {
    const lang = order.language || 'cs';
    const t = EMAIL_TRANSLATIONS[lang] || EMAIL_TRANSLATIONS.cs;

    const itemsHtml = order.items.map(item => {
      // Image Handling: Check if images exist and use the first one
      const imgHtml = (item.images && item.images.length > 0) 
        ? `<img src="${item.images[0]}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; display: block;">` 
        : '<div style="width: 50px; height: 50px; background-color: #eee; border-radius: 4px;"></div>';

      return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee; width: 60px; text-align: center;">${imgHtml}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; width: 40px; text-align: center;">${item.quantity}x</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${item.name}</strong></td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${item.price * item.quantity} Kč</td>
      </tr>
    `}).join('');

    const discountSum = order.appliedDiscounts?.reduce((sum, d) => sum + d.amount, 0) || 0;
    const deliveryFee = order.deliveryFee || 0;
    const packagingFee = order.packagingFee || 0;
    const itemTotal = order.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const finalTotal = Math.max(0, itemTotal - discountSum) + packagingFee + deliveryFee;

    const discountsHtml = order.appliedDiscounts?.map(d => `
      <tr>
        <td colspan="3" style="padding: 8px; color: green;">${t.headers.discount} (${d.code})</td>
        <td style="padding: 8px; text-align: right; color: green;">-${d.amount} Kč</td>
      </tr>
    `).join('') || '';

    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h1 style="color: #1f2937;">${title}</h1>
        <p>${subTitle}</p>
        
        <h3 style="margin-top: 30px;">Detail objednávky #${order.id}</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 8px; text-align: center;">${t.headers.image}</th>
              <th style="padding: 8px; text-align: center;">${t.headers.qty}</th>
              <th style="padding: 8px; text-align: left;">${t.headers.item}</th>
              <th style="padding: 8px; text-align: right;">${t.headers.price}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            ${discountsHtml}
            <tr>
              <td colspan="3" style="padding: 8px; color: #666;">${t.headers.packaging}</td>
              <td style="padding: 8px; text-align: right;">${packagingFee} Kč</td>
            </tr>
            ${deliveryFee > 0 ? `
            <tr>
              <td colspan="3" style="padding: 8px; color: #666;">${t.headers.delivery}</td>
              <td style="padding: 8px; text-align: right;">${deliveryFee} Kč</td>
            </tr>` : ''}
            <tr style="font-size: 1.2em; font-weight: bold; background-color: #f9fafb;">
              <td colspan="3" style="padding: 12px; border-top: 2px solid #ddd;">${t.headers.total}</td>
              <td style="padding: 12px; border-top: 2px solid #ddd; text-align: right; color: #9333ea;">${finalTotal} Kč</td>
            </tr>
          </tbody>
        </table>

        <p>${t.headers.date}: <strong>${order.deliveryDate}</strong></p>
        
        <br/>
        <p style="font-size: 0.9em; color: #666;">${t.footer}</p>
      </div>
    `;
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

// --- TRANSLATION ENDPOINT ---
app.post('/api/admin/translate', async (req, res) => {
    try {
        const { sourceData } = req.body;
        if (!process.env.API_KEY) {
            console.error('Missing API_KEY in env');
            return res.status(500).json({ error: 'API_KEY not configured on server' });
        }
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const prompt = `
          Translate the following JSON object values from Czech (CS) to English (EN) and German (DE).
          Return a JSON object with 'en' and 'de' keys, each containing the translated key-value pairs.
          Keep the tone professional and suitable for a catering e-shop.
          
          Source Data:
          ${JSON.stringify(sourceData)}
        `;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                en: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    label: { type: Type.STRING },
                  }
                },
                de: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    label: { type: Type.STRING },
                  }
                }
              }
            }
          }
        });

        if (response.text) {
             res.json({ success: true, translations: JSON.parse(response.text) });
        } else {
             res.json({ success: false, translations: {} });
        }
    } catch (e) {
        console.error("Translation Error:", e);
        res.status(500).json({ error: e.message });
    }
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

// --- AUTH ENDPOINTS ---

app.post('/api/auth/reset-password', withDb(async (req, res, db) => {
  const { email } = req.body;
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  if (rows.length === 0) {
    return res.json({ success: true, message: 'Pokud je email registrován, instrukce byly odeslány.' });
  }
  const tokenPayload = JSON.stringify({ email, exp: Date.now() + 3600000 }); // 1 hour expiry
  const token = Buffer.from(tokenPayload).toString('base64');
  const origin = req.get('origin') || (req.protocol + '://' + req.get('host'));
  const link = `${origin}/#/reset-password?token=${token}`;

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

app.post('/api/auth/reset-password-confirm', withDb(async (req, res, db) => {
    const { token, newPasswordHash } = req.body;
    
    if (!token || !newPasswordHash) {
        return res.status(400).json({ success: false, message: 'Chybějící údaje.' });
    }

    try {
        const decodedString = Buffer.from(token, 'base64').toString('ascii');
        const payload = JSON.parse(decodedString);
        
        if (payload.exp < Date.now()) {
            return res.json({ success: false, message: 'Platnost odkazu vypršela.' });
        }

        const email = payload.email;
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (rows.length === 0) {
            return res.json({ success: false, message: 'Uživatel nenalezen.' });
        }

        // Update password hash inside the JSON data AND update the users record
        await db.query(`UPDATE users SET data=JSON_SET(data, '$.passwordHash', ?) WHERE email=?`, [newPasswordHash, email]);
        
        res.json({ success: true, message: 'Heslo bylo úspěšně změněno. Nyní se můžete přihlásit.' });

    } catch (e) {
        console.error('Reset Confirm Error:', e);
        res.status(400).json({ success: false, message: 'Neplatný token.' });
    }
}));

app.post('/api/orders', withDb(async (req, res, db) => {
  const o = req.body;
  
  await db.query('INSERT INTO orders (id, user_id, delivery_date, status, total_price, data) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status=?, total_price=?, data=?', [o.id, o.userId, o.deliveryDate, o.status, o.totalPrice, JSON.stringify(o), o.status, o.totalPrice, JSON.stringify(o)]);
  
  // Send Email on New Order (if status is CREATED)
  if (o.status === 'created' && transporter) {
      const [userRows] = await db.query('SELECT email FROM users WHERE id = ?', [o.userId]);
      const userEmail = userRows.length > 0 ? userRows[0].email : null;
      
      const lang = o.language || 'cs';
      const t = EMAIL_TRANSLATIONS[lang] || EMAIL_TRANSLATIONS.cs;
      const subject = `${t.statuses.created}: #${o.id}`; 
      const subTitle = `Vaše objednávka <strong>#${o.id}</strong> byla přijata ke zpracování.`;
      const html = generateOrderEmailHtml(o, 'Děkujeme za vaši objednávku!', subTitle);

      // --- SEND TO CUSTOMER (WITH ATTACHMENT) ---
      if (userEmail) {
          // Assume VOP.pdf is in public folder. Resolve relative to THIS file (server/index.js)
          const vopPath = path.resolve(__dirname, '../public/VOP.pdf');
          let userAttachments = [];
          
          if (fs.existsSync(vopPath)) {
              userAttachments.push({
                  filename: 'VOP_4Gracie.pdf',
                  path: vopPath
              });
          } else {
              console.warn('⚠️ VOP.pdf not found in public folder, sending email without attachment.');
          }

          sendEmail(userEmail, subject, html, userAttachments);
      }

      // --- SEND TO OPERATOR (WITHOUT ATTACHMENT) ---
      // Get operator email from settings if available, or fallback to env/default
      const [settingsRows] = await db.query('SELECT data FROM app_settings WHERE key_name = "global"');
      let operatorEmail = process.env.SMTP_USER || 'info@4gracie.cz';
      
      if (settingsRows.length > 0) {
          const s = typeof settingsRows[0].data === 'string' ? JSON.parse(settingsRows[0].data) : settingsRows[0].data;
          if (s.companyDetails?.email) operatorEmail = s.companyDetails.email;
      }

      if (operatorEmail) {
          const operatorHtml = generateOrderEmailHtml(o, 'Nová objednávka z eshopu', `Zákazník: ${o.userName}`);
          // Send to operator without VOP attachment
          sendEmail(operatorEmail, `NOVÁ OBJEDNÁVKA #${o.id}`, operatorHtml, []); 
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
                  const lang = orderData.language || 'cs';
                  const t = EMAIL_TRANSLATIONS[lang] || EMAIL_TRANSLATIONS.cs;
                  // Localize the status
                  const localizedStatus = t.statuses[req.body.status] || req.body.status;
                  
                  const subject = `Aktualizace objednávky #${id}`;
                  const subTitle = `Vaše objednávka <strong>#${id}</strong> má nyní stav: <strong style="color: #9333ea;">${localizedStatus.toUpperCase()}</strong>`;
                  const html = generateOrderEmailHtml(orderData, 'Změna stavu objednávky', subTitle);
                  
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

// --- BULK IMPORT ENDPOINT ---
app.post('/api/admin/import', withDb(async (req, res, db) => {
    const { data, selection } = req.body;
    
    try {
        await db.beginTransaction();

        // Users
        if (selection.users && data.users && Array.isArray(data.users)) {
            await db.query('TRUNCATE TABLE users');
            for (const u of data.users) {
                await db.query('INSERT INTO users (id, email, role, data) VALUES (?, ?, ?, ?)', [u.id, u.email, u.role, JSON.stringify(u)]);
            }
        }

        // Products
        if (selection.products && data.products && Array.isArray(data.products)) {
            await db.query('TRUNCATE TABLE products');
            for (const p of data.products) {
                await db.query('INSERT INTO products (id, category, is_deleted, data) VALUES (?, ?, ?, ?)', [p.id, p.category, false, JSON.stringify(p)]);
            }
        }

        // Orders
        if (selection.orders && data.orders && Array.isArray(data.orders)) {
            await db.query('TRUNCATE TABLE orders');
            for (const o of data.orders) {
                await db.query('INSERT INTO orders (id, user_id, delivery_date, status, total_price, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                    [o.id, o.userId, o.deliveryDate, o.status, o.totalPrice, o.createdAt || new Date(), JSON.stringify(o)]);
            }
        }

        // Discounts
        if (selection.discountCodes && data.discountCodes && Array.isArray(data.discountCodes)) {
            await db.query('TRUNCATE TABLE discounts');
            for (const d of data.discountCodes) {
                await db.query('INSERT INTO discounts (id, code, data) VALUES (?, ?, ?)', [d.id, d.code, JSON.stringify(d)]);
            }
        }

        // Calendar
        if (selection.dayConfigs && data.dayConfigs && Array.isArray(data.dayConfigs)) {
            await db.query('TRUNCATE TABLE calendar_exceptions');
            for (const c of data.dayConfigs) {
                await db.query('INSERT INTO calendar_exceptions (date, data) VALUES (?, ?)', [c.date, JSON.stringify(c)]);
            }
        }

        // Settings
        if (selection.settings && data.settings) {
            await db.query('INSERT INTO app_settings (key_name, data) VALUES ("global", ?) ON DUPLICATE KEY UPDATE data=?', [JSON.stringify(data.settings), JSON.stringify(data.settings)]);
        }

        await db.commit();
        res.json({ success: true });

    } catch (e) {
        await db.rollback();
        console.error('Import Failed:', e);
        res.status(500).json({ error: 'Import failed: ' + e.message });
    }
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
