
import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';

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

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
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

app.use('/uploads', express.static(UPLOAD_ROOT));

// --- EMAIL CONFIG ---
let transporter = null;
if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 465,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: false }
    });
    
    transporter.verify(function (error, success) {
        if (error) {
            console.error('❌ SMTP Connection Error:', error);
        } else {
            console.log(`✅ SMTP Server is ready.`);
            console.log(`   Auth User: ${process.env.SMTP_USER}`);
            console.log(`   Sender (From): ${process.env.EMAIL_FROM}`);
        }
    });
} else {
    console.warn('⚠️ SMTP Config Missing - Emails will not be sent.');
}

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
let sqlDebugMode = false;

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
    const itemsHtml = order.items.map(i => {
        // Resolve Image
        let imgHtml = '<div style="width: 50px; height: 50px; background-color: #f3f4f6; border-radius: 4px; display:inline-block;"></div>';
        
        if (i.images && i.images.length > 0) {
            let imgSrc = i.images[0];
            
            // If it is a local path, try to read file and convert to base64
            if (imgSrc.startsWith('/uploads/')) {
                try {
                    const relativePath = imgSrc.replace(/^\/uploads\//, '');
                    const fullPath = path.join(UPLOAD_ROOT, relativePath);
                    if (fs.existsSync(fullPath)) {
                        const ext = path.extname(fullPath).substring(1) || 'jpg';
                        const b64 = fs.readFileSync(fullPath, 'base64');
                        imgSrc = `data:image/${ext};base64,${b64}`;
                    }
                } catch (e) {
                    console.error("Failed to embed image in email:", e.message);
                }
            }
            
            imgHtml = `<img src="${imgSrc}" alt="${i.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; display: block;">`;
        }

        return `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; width: 60px; vertical-align: middle;">${imgHtml}</td>
            <td style="padding: 8px; vertical-align: middle;">${i.name}</td>
            <td style="padding: 8px; text-align: center; vertical-align: middle;">${i.quantity} ${i.unit || 'ks'}</td>
            <td style="padding: 8px; text-align: right; vertical-align: middle;">${i.price} Kč</td>
            <td style="padding: 8px; text-align: right; vertical-align: middle;">${i.price * i.quantity} Kč</td>
        </tr>
    `;
    }).join('');

    const discountSum = order.appliedDiscounts?.reduce((acc, d) => acc + d.amount, 0) || 0;
    const itemsTotal = order.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const finalTotal = Math.max(0, itemsTotal - discountSum) + order.packagingFee + (order.deliveryFee || 0);

    const discountsHtml = order.appliedDiscounts?.map(d => `
        <tr>
            <td colspan="4" style="padding: 4px 8px; text-align: right; color: green;">Sleva (${d.code})</td>
            <td style="padding: 4px 8px; text-align: right; color: green;">-${d.amount} Kč</td>
        </tr>
    `).join('') || '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; }
            h2 { color: #1f2937; border-bottom: 2px solid #9333ea; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; background: #f3f4f6; padding: 10px; font-size: 12px; text-transform: uppercase; }
            .total-row { font-weight: bold; font-size: 1.2em; background: #f9fafb; }
            .info-box { background: #f9fafb; padding: 15px; margin: 20px 0; border-radius: 8px; font-size: 0.9em; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>${title}</h2>
            <p>${introText}</p>
            
            <div class="info-box">
                <p><strong>Číslo objednávky:</strong> #${order.id}</p>
                <p><strong>Datum doručení:</strong> ${new Date(order.deliveryDate).toLocaleDateString('cs-CZ')}</p>
                <p><strong>Způsob dopravy:</strong> ${order.deliveryType === 'pickup' ? 'Osobní odběr' : 'Rozvoz'}</p>
                ${order.deliveryType === 'delivery' ? `<p><strong>Adresa doručení:</strong> ${order.deliveryStreet}, ${order.deliveryCity}, ${order.deliveryZip}</p>` : ''}
                <p><strong>Způsob platby:</strong> ${order.paymentMethod === 'gateway' ? 'Online karta' : order.paymentMethod === 'qr' ? 'QR Platba' : 'Hotovost/Karta'}</p>
                ${order.note ? `<p><strong>Poznámka:</strong> ${order.note}</p>` : ''}
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 60px;"></th>
                        <th>Položka</th>
                        <th style="text-align: center;">Ks</th>
                        <th style="text-align: right;">Cena/j</th>
                        <th style="text-align: right;">Celkem</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                    ${discountsHtml}
                    <tr>
                        <td colspan="4" style="padding: 8px; text-align: right;">Balné</td>
                        <td style="padding: 8px; text-align: right;">${order.packagingFee} Kč</td>
                    </tr>
                    <tr>
                        <td colspan="4" style="padding: 8px; text-align: right;">Doprava</td>
                        <td style="padding: 8px; text-align: right;">${order.deliveryFee || 0} Kč</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="4" style="padding: 15px; text-align: right;">CELKEM K ÚHRADĚ:</td>
                        <td style="padding: 15px; text-align: right; color: #9333ea;">${finalTotal} Kč</td>
                    </tr>
                </tbody>
            </table>
            
            <p style="margin-top: 30px; font-size: 0.8em; color: #888; text-align: center;">
                4Gracie<br>
                Toto je automaticky generovaná zpráva.
            </p>
        </div>
    </body>
    </html>
    `;
};

// --- PDF GENERATION HELPERS ---

const fetchBuffer = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to fetch ${url}, status: ${res.statusCode}`));
                return;
            }
            const data = [];
            res.on('data', (chunk) => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', (e) => reject(e));
    });
};

// Cache fonts
let regularFontBase64 = null;
let boldFontBase64 = null;

const loadFonts = async () => {
    if (regularFontBase64 && boldFontBase64) return;
    try {
        const regularBuffer = await fetchBuffer('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf');
        regularFontBase64 = regularBuffer.toString('base64');
        
        const boldBuffer = await fetchBuffer('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf');
        boldFontBase64 = boldBuffer.toString('base64');
    } catch (e) {
        console.error("Failed to load fonts for PDF (using fallback):", e.message);
    }
};

const removeDiacritics = (str) => {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const calculateCzIban = (accountString) => {
  if (!accountString) return '';
  const cleanStr = accountString.replace(/\s/g, '');
  const [accountPart, bankCode] = cleanStr.split('/');
  if (!accountPart || !bankCode || bankCode.length !== 4) return '';
  let prefix = '';
  let number = accountPart;
  if (accountPart.includes('-')) { [prefix, number] = accountPart.split('-'); }
  const paddedPrefix = prefix.padStart(6, '0');
  const paddedNumber = number.padStart(10, '0');
  const paddedBank = bankCode.padStart(4, '0');
  const bban = paddedBank + paddedPrefix + paddedNumber;
  const numericStr = bban + '123500';
  const remainder = BigInt(numericStr) % 97n;
  const checkDigitsVal = 98n - remainder;
  const checkDigitsStr = checkDigitsVal.toString().padStart(2, '0');
  return `CZ${checkDigitsStr}${bban}`;
};

// Gets VOP buffer ONLY from local file. 
const getVopPdfBuffer = async () => {
    const vopPath = process.env.VOP_PATH;
    
    if (vopPath) {
        const resolvedPath = path.resolve(process.cwd(), vopPath);
        if (fs.existsSync(resolvedPath)) {
            console.log(`📄 Loading VOP from file: ${resolvedPath}`);
            return fs.readFileSync(resolvedPath);
        } else {
            console.warn(`⚠️ VOP_PATH defined (${vopPath}) but file not found at: ${resolvedPath}. Email will be sent WITHOUT VOP attachment.`);
        }
    }
    return null;
};

const generateInvoicePdf = async (o, type = 'proforma', settings) => {
    await loadFonts();
    const doc = new jsPDF();
    
    // Add fonts ONLY if successfully loaded
    if (regularFontBase64 && boldFontBase64) {
        doc.addFileToVFS("Roboto-Regular.ttf", regularFontBase64);
        doc.addFileToVFS("Roboto-Medium.ttf", boldFontBase64);
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
        doc.addFont("Roboto-Medium.ttf", "Roboto", "bold");
        doc.setFont("Roboto");
    }

    const comp = o.companyDetailsSnapshot || settings?.companyDetails || {};
    const isVatPayer = !!comp.dic;
    
    const headerTitle = type === 'proforma' 
        ? "ZÁLOHOVÝ DAŇOVÝ DOKLAD" 
        : (isVatPayer ? "FAKTURA - DAŇOVÝ DOKLAD" : "FAKTURA");

    const dateToUse = type === 'final' 
        ? (o.finalInvoiceDate || new Date().toISOString()) 
        : o.createdAt;

    const s = (str) => str || '';

    // Header
    doc.setFontSize(18);
    if(boldFontBase64) doc.setFont("Roboto", "bold");
    doc.text(headerTitle, 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    if(regularFontBase64) doc.setFont("Roboto", "normal");
    
    doc.text(`Cislo dokladu: ${o.id}`, 105, 28, { align: "center" });
    
    const d = new Date(dateToUse);
    const dateStr = d.toLocaleDateString('cs-CZ');
    
    doc.text(`Datum vystaveni: ${dateStr}`, 105, 34, { align: "center" });
    if (isVatPayer) doc.text(`Datum zdan. plneni: ${dateStr}`, 105, 39, { align: "center" });

    // Supplier / Customer
    doc.setFontSize(11);
    doc.text("DODAVATEL:", 14, 50);
    doc.setFontSize(10);
    doc.text(s(comp.name), 14, 56);
    doc.text(s(comp.street), 14, 61);
    doc.text(`${s(comp.zip)} ${s(comp.city)}`, 14, 66);
    doc.text(`IC: ${s(comp.ic)}`, 14, 71);
    if(comp.dic) doc.text(`DIC: ${s(comp.dic)}`, 14, 76);
    
    doc.setFontSize(11);
    doc.text("ODBERATEL:", 120, 50);
    doc.setFontSize(10);
    
    let yPos = 56;
    doc.text(s(o.billingName || o.userName || 'Zakaznik'), 120, yPos); yPos += 5;
    doc.text(s(o.billingStreet), 120, yPos); yPos += 5;
    doc.text(`${s(o.billingZip)} ${s(o.billingCity)}`, 120, yPos); yPos += 5;
    if (o.billingIc) { doc.text(`IC: ${o.billingIc}`, 120, yPos); yPos += 5; }
    if (o.billingDic) { doc.text(`DIC: ${o.billingDic}`, 120, yPos); yPos += 5; }

    // Table Header
    let y = 100;
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFontSize(9);
    
    if (isVatPayer) {
        doc.text("POLOZKA", 14, y);
        doc.text("KS", 90, y);
        doc.text("CENA/KS", 105, y);
        doc.text("DPH", 130, y);
        doc.text("ZAKLAD", 150, y);
        doc.text("CELKEM", 180, y);
    } else {
        doc.text("POLOZKA", 14, y);
        doc.text("KS", 130, y);
        doc.text("CENA/KS", 150, y);
        doc.text("CELKEM", 180, y);
    }
    y += 3;
    doc.line(14, y, 196, y);
    y += 6;

    // Items
    const calculateVat = (priceWithVat, rate) => {
        const priceNoVat = priceWithVat / (1 + rate / 100);
        return { priceNoVat, vat: priceWithVat - priceNoVat };
    };

    let maxItemVatRate = 0;
    
    (o.items || []).forEach(item => {
        const itemTotal = item.price * item.quantity;
        const vatRate = item.vatRateTakeaway || 12; 
        if (vatRate > maxItemVatRate) maxItemVatRate = vatRate;

        if (isVatPayer) {
            const { priceNoVat } = calculateVat(item.price, vatRate);
            doc.text(s(item.name).substring(0, 35), 14, y);
            doc.text(String(item.quantity), 90, y);
            doc.text(priceNoVat.toFixed(2), 105, y);
            doc.text(`${vatRate}%`, 130, y);
            doc.text((priceNoVat * item.quantity).toFixed(2), 150, y);
            doc.text(itemTotal.toFixed(2), 180, y);
        } else {
            doc.text(s(item.name).substring(0, 50), 14, y);
            doc.text(String(item.quantity), 130, y);
            doc.text(String(item.price), 150, y);
            doc.text(String(itemTotal), 180, y);
        }
        y += 6;
    });

    const feeVatRate = maxItemVatRate > 0 ? maxItemVatRate : 21;

    // Fees
    if (o.packagingFee > 0) {
        if (isVatPayer) {
            const { priceNoVat } = calculateVat(o.packagingFee, feeVatRate);
            doc.text("Balne", 14, y);
            doc.text("1", 90, y);
            doc.text(priceNoVat.toFixed(2), 105, y);
            doc.text(`${feeVatRate}%`, 130, y);
            doc.text(priceNoVat.toFixed(2), 150, y);
            doc.text(o.packagingFee.toFixed(2), 180, y);
        } else {
            doc.text("Balne", 14, y);
            doc.text("1", 130, y);
            doc.text(String(o.packagingFee), 150, y);
            doc.text(String(o.packagingFee), 180, y);
        }
        y += 6;
    }

    if (o.deliveryFee > 0) {
        if (isVatPayer) {
            const { priceNoVat } = calculateVat(o.deliveryFee, feeVatRate);
            doc.text("Doprava", 14, y);
            doc.text("1", 90, y);
            doc.text(priceNoVat.toFixed(2), 105, y);
            doc.text(`${feeVatRate}%`, 130, y);
            doc.text(priceNoVat.toFixed(2), 150, y);
            doc.text(o.deliveryFee.toFixed(2), 180, y);
        } else {
            doc.text("Doprava", 14, y);
            doc.text("1", 130, y);
            doc.text(String(o.deliveryFee), 150, y);
            doc.text(String(o.deliveryFee), 180, y);
        }
        y += 6;
    }

    // Discounts
    (o.appliedDiscounts || []).forEach(d => {
        doc.text(`Sleva ${d.code}`, 14, y);
        doc.text(`-${d.amount}`, 180, y);
        y += 6;
    });

    doc.line(14, y, 196, y);
    y += 10;

    // Total
    const discountSum = (o.appliedDiscounts || []).reduce((a,b)=>a+b.amount,0);
    const total = Math.max(0, o.totalPrice + o.packagingFee + (o.deliveryFee || 0) - discountSum);

    doc.setFontSize(14);
    if(boldFontBase64) doc.setFont("Roboto", "bold");
    doc.text(`CELKEM K UHRADE: ${total.toFixed(2)} Kc`, 196, y, { align: "right" });

    // QR Code for Proforma
    if (type === 'proforma') {
        try {
            const iban = calculateCzIban(comp.bankAccount || '').replace(/\s/g,'');
            const bic = comp.bic ? `+${comp.bic}` : '';
            const acc = `ACC:${iban}${bic}`;
            const vs = String(o.id).replace(/\D/g,'') || '0';
            const msg = removeDiacritics(`Objednavka ${o.id}`);
            const qrString = `SPD*1.0*${acc}*AM:${total.toFixed(2)}*CC:CZK*X-VS:${vs}*MSG:${msg}`;
            
            // Fetch QR
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrString)}`;
            const qrBuffer = await fetchBuffer(qrUrl);
            const qrBase64 = qrBuffer.toString('base64');
            
            doc.addImage(qrBase64, 'PNG', 150, y + 10, 40, 40);
            doc.setFontSize(8);
            doc.text("QR Platba", 170, y + 55, { align: "center" });
        } catch (e) {
            console.error("QR gen error", e.message);
        }
    } else {
        // Final invoice footer
        y += 10;
        doc.setFontSize(12);
        doc.text("NEPLATIT - Jiz uhrazeno zalohou.", 105, y, { align: "center" });
    }

    // Output as Buffer
    const arrayBuffer = doc.output('arraybuffer');
    return Buffer.from(arrayBuffer);
};

// --- INITIALIZATION ---
const initDb = async () => {
    const db = await getDb();
    if (!db) return;

    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(50) PRIMARY KEY,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                name VARCHAR(100),
                phone VARCHAR(20),
                role VARCHAR(20) DEFAULT 'customer',
                is_blocked BOOLEAN DEFAULT FALSE,
                marketing_consent BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS user_addresses (
                id VARCHAR(50) PRIMARY KEY,
                user_id VARCHAR(50),
                type VARCHAR(20),
                name VARCHAR(100),
                street VARCHAR(255),
                city VARCHAR(100),
                zip VARCHAR(20),
                phone VARCHAR(20),
                ic VARCHAR(20),
                dic VARCHAR(20),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS products (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10,2),
                unit VARCHAR(10),
                category VARCHAR(50),
                workload INT DEFAULT 0,
                workload_overhead INT DEFAULT 0,
                vat_rate_inner DECIMAL(5,2),
                vat_rate_takeaway DECIMAL(5,2),
                is_deleted BOOLEAN DEFAULT FALSE,
                image_url TEXT,
                full_json JSON,
                INDEX idx_category (category)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id VARCHAR(50) PRIMARY KEY,
                user_id VARCHAR(50),
                user_name VARCHAR(255),
                delivery_date DATE,
                status VARCHAR(50),
                total_price DECIMAL(10,2),
                delivery_fee DECIMAL(10,2),
                packaging_fee DECIMAL(10,2),
                payment_method VARCHAR(50),
                is_paid BOOLEAN DEFAULT FALSE,
                delivery_type VARCHAR(50),
                
                delivery_name VARCHAR(100),
                delivery_street VARCHAR(255),
                delivery_city VARCHAR(100),
                delivery_zip VARCHAR(20),
                delivery_phone VARCHAR(20),
                
                billing_name VARCHAR(100),
                billing_street VARCHAR(255),
                billing_city VARCHAR(100),
                billing_zip VARCHAR(20),
                billing_ic VARCHAR(20),
                billing_dic VARCHAR(20),

                note TEXT,
                pickup_location_id VARCHAR(100),
                language VARCHAR(10),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                final_invoice_date TIMESTAMP NULL,
                full_json JSON,
                INDEX idx_date (delivery_date),
                INDEX idx_status (status),
                INDEX idx_user (user_id)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);

        try { await db.query(`ALTER TABLE orders ADD COLUMN final_invoice_date TIMESTAMP NULL AFTER created_at`); } catch(e) {}

        await db.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(50),
                product_id VARCHAR(50),
                name VARCHAR(255),
                quantity INT,
                price DECIMAL(10,2),
                category VARCHAR(50),
                unit VARCHAR(20),
                workload INT,
                workload_overhead INT,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                INDEX idx_order (order_id),
                INDEX idx_category (category)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);

        await db.query(`CREATE TABLE IF NOT EXISTS app_settings (key_name VARCHAR(50) PRIMARY KEY, data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await db.query(`CREATE TABLE IF NOT EXISTS discounts (id VARCHAR(50) PRIMARY KEY, code VARCHAR(50), data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await db.query(`CREATE TABLE IF NOT EXISTS calendar_exceptions (date VARCHAR(20) PRIMARY KEY, data JSON) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

        const [admins] = await db.query('SELECT id FROM users WHERE email = ?', ['info@4gracie.cz']);
        if (admins.length === 0) {
            console.log("🌱 Seeding default admin...");
            const hash = 'hashed_' + Buffer.from('1234').toString('base64');
            await db.query(
                'INSERT INTO users (id, email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?, ?)',
                ['admin_seed', 'info@4gracie.cz', hash, 'admin', 'Hlavní Administrátor', '+420000000000']
            );
        }

        console.log("✅ Database initialized.");
    } catch (e) {
        console.error("❌ Init DB Error:", e);
    }
};
initDb();

// --- API ENDPOINTS ---

app.get('/api/health', async (req, res) => {
    const db = await getDb();
    if (db) {
        res.json({ status: 'ok', database: 'connected' });
    } else {
        res.status(500).json({ status: 'error', database: 'disconnected' });
    }
});

app.get('/api/bootstrap', withDb(async (req, res, db) => {
    try {
        const [prodRows] = await db.query('SELECT * FROM products WHERE is_deleted = FALSE');
        const products = prodRows.map(row => ({
            ...parseJsonCol(row, 'full_json'),
            id: row.id,
            name: row.name,
            description: row.description,
            price: Number(row.price),
            unit: row.unit,
            category: row.category,
            workload: row.workload,
            workloadOverhead: row.workload_overhead,
            vatRateInner: Number(row.vat_rate_inner),
            vatRateTakeaway: Number(row.vat_rate_takeaway),
            volume: Number(parseJsonCol(row, 'full_json').volume || 0),
            images: row.image_url ? [row.image_url, ...(parseJsonCol(row, 'full_json').images || []).slice(1)] : []
        }));

        const [settings] = await db.query('SELECT * FROM app_settings WHERE key_name = "global"');
        const [discounts] = await db.query('SELECT * FROM discounts');
        const [calendar] = await db.query('SELECT * FROM calendar_exceptions');
        
        const today = new Date().toISOString().split('T')[0];
        const [activeOrders] = await db.query('SELECT full_json, final_invoice_date FROM orders WHERE delivery_date >= ? AND status != "cancelled"', [today]);

        const mergedOrders = activeOrders.map(r => {
            const json = parseJsonCol(r, 'full_json');
            if (r.final_invoice_date) json.finalInvoiceDate = r.final_invoice_date;
            return json;
        });

        res.json({
            products,
            settings: settings.length ? parseJsonCol(settings[0]) : null,
            discountCodes: discounts.map(r => ({...parseJsonCol(r), id: r.id})),
            dayConfigs: calendar.map(r => ({...parseJsonCol(r), date: r.date})),
            orders: mergedOrders,
            users: [] 
        });
    } catch (e) {
        console.error("Bootstrap error:", e);
        res.status(500).json({ error: e.message });
    }
}));

// PRODUCTS
app.post('/api/products', withDb(async (req, res, db) => {
    const p = req.body;
    const fullJson = JSON.stringify(p);
    const mainImage = p.images && p.images.length > 0 ? p.images[0] : null;

    await db.query(`
        INSERT INTO products (
            id, name, description, price, unit, category, workload, workload_overhead, 
            vat_rate_inner, vat_rate_takeaway, image_url, full_json, is_deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            name=?, description=?, price=?, unit=?, category=?, workload=?, workload_overhead=?, 
            vat_rate_inner=?, vat_rate_takeaway=?, image_url=?, full_json=?, is_deleted=?
    `, [
        p.id, p.name, p.description, p.price, p.unit, p.category, p.workload, p.workloadOverhead,
        p.vatRateInner, p.vatRateTakeaway, mainImage, fullJson, false,
        p.name, p.description, p.price, p.unit, p.category, p.workload, p.workloadOverhead,
        p.vatRateInner, p.vatRateTakeaway, mainImage, fullJson, false
    ]);
    res.status(200).json({ success: true });
}));

app.delete('/api/products/:id', withDb(async (req, res, db) => {
    await db.query('UPDATE products SET is_deleted = TRUE WHERE id = ?', [req.params.id]);
    res.json({ success: true });
}));

// USERS
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
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(`INSERT INTO users (id, email, password_hash, name, phone, role, is_blocked, marketing_consent) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE email=?, password_hash=?, name=?, phone=?, role=?, is_blocked=?, marketing_consent=?`, [u.id, u.email, u.passwordHash, u.name, u.phone, u.role, u.isBlocked, u.marketingConsent, u.email, u.passwordHash, u.name, u.phone, u.role, u.isBlocked, u.marketingConsent]);
        await conn.query('DELETE FROM user_addresses WHERE user_id = ?', [u.id]);
        const addresses = [...(u.deliveryAddresses||[]).map(a => ({...a, type: 'delivery'})), ...(u.billingAddresses||[]).map(a => ({...a, type: 'billing'}))];
        if (addresses.length > 0) {
            const values = addresses.map(a => [a.id || Date.now()+Math.random(), u.id, a.type, a.name, a.street, a.city, a.zip, a.phone, a.ic||null, a.dic||null]);
            await conn.query('INSERT INTO user_addresses (id, user_id, type, name, street, city, zip, phone, ic, dic) VALUES ?', [values]);
        }
        await conn.commit();
        
        res.json({ success: true });
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

// AUTH
app.post('/api/auth/login', withDb(async (req, res, db) => {
    const { email } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length > 0) {
        const u = rows[0];
        const [addrs] = await db.query('SELECT * FROM user_addresses WHERE user_id = ?', [u.id]);
        res.json({ success: true, user: { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, isBlocked: Boolean(u.is_blocked), marketingConsent: Boolean(u.marketing_consent), passwordHash: u.password_hash, deliveryAddresses: addrs.filter(a => a.type === 'delivery'), billingAddresses: addrs.filter(a => a.type === 'billing') } });
    } else { res.json({ success: false, message: 'Uživatel nenalezen' }); }
}));

app.post('/api/auth/reset-password', withDb(async (req, res, db) => {
    const { email } = req.body;
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length > 0 && transporter) {
        const token = Buffer.from(`${email}-${Date.now()}`).toString('base64');
        const link = `${process.env.VITE_APP_URL || 'https://eshop.4gracie.cz'}/#/reset-password?token=${token}`;
        
        const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER;
        
        await transporter.sendMail({ 
            from: fromAddress,
            replyTo: fromAddress, 
            to: email, 
            subject: 'Obnova hesla', 
            html: `<a href="${link}">Resetovat heslo</a>` 
        });
    }
    res.json({ success: true, message: 'Email odeslán.' });
}));

app.post('/api/auth/reset-password-confirm', withDb(async (req, res, db) => {
    const { token, newPasswordHash } = req.body;
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const email = decoded.substring(0, decoded.lastIndexOf('-'));
        await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [newPasswordHash, email]);
        res.json({ success: true, message: 'Heslo změněno.' });
    } catch (e) { res.status(400).json({ success: false }); }
}));

// ORDERS
app.post('/api/orders', withDb(async (req, res, db) => {
    const o = req.body;
    const deliveryDate = formatToMysqlDate(o.deliveryDate);
    const createdAt = formatToMysqlDateTime(o.createdAt);
    const finalDate = (o.status === 'delivered' && o.finalInvoiceDate) ? formatToMysqlDateTime(o.finalInvoiceDate) : null;
    const conn = await db.getConnection();
    
    // Fetch settings for PDF generation
    const [settingsRows] = await db.query('SELECT * FROM app_settings WHERE key_name = "global"');
    const settings = settingsRows.length ? parseJsonCol(settingsRows[0]) : {};
    
    const operatorEmail = settings.companyDetails?.email || 'info@4gracie.cz';
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER;

    try {
        await conn.beginTransaction();
        await conn.query(`
            INSERT INTO orders (id, user_id, user_name, delivery_date, status, total_price, delivery_fee, packaging_fee, payment_method, is_paid, delivery_type, delivery_name, delivery_street, delivery_city, delivery_zip, delivery_phone, billing_name, billing_street, billing_city, billing_zip, billing_ic, billing_dic, note, pickup_location_id, language, created_at, final_invoice_date, full_json) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE status=?, total_price=?, delivery_date=?, user_name=?, is_paid=?, delivery_type=?, delivery_name=?, delivery_street=?, delivery_city=?, delivery_zip=?, delivery_phone=?, billing_name=?, billing_street=?, billing_city=?, billing_zip=?, billing_ic=?, billing_dic=?, final_invoice_date=?, full_json=?
        `, [
            o.id, o.userId, o.userName, deliveryDate, o.status, o.totalPrice, o.deliveryFee, o.packagingFee, o.paymentMethod, o.isPaid, o.deliveryType, o.deliveryName, o.deliveryStreet, o.deliveryCity, o.deliveryZip, o.deliveryPhone, o.billingName, o.billingStreet, o.billingCity, o.billingZip, o.billingIc, o.billingDic, o.note, o.pickupLocationId, o.language, createdAt, finalDate, JSON.stringify(o),
            o.status, o.totalPrice, deliveryDate, o.userName, o.isPaid, o.deliveryType, o.deliveryName, o.deliveryStreet, o.deliveryCity, o.deliveryZip, o.deliveryPhone, o.billingName, o.billingStreet, o.billingCity, o.billingZip, o.billingIc, o.billingDic, finalDate, JSON.stringify(o)
        ]);
        
        await conn.query('DELETE FROM order_items WHERE order_id = ?', [o.id]);
        if (o.items && o.items.length > 0) {
            const itemValues = o.items.map(i => [o.id, i.id, i.name, i.quantity, i.price, i.category, i.unit, i.workload||0, i.workloadOverhead||0]);
            await conn.query('INSERT INTO order_items (order_id, product_id, name, quantity, price, category, unit, workload, workload_overhead) VALUES ?', [itemValues]);
        }
        await conn.commit();
        console.log(`✅ Order #${o.id} saved to DB.`);

        // --- EMAIL NOTIFICATION FOR NEW ORDER ---
        if (transporter && o.status === 'created') {
            console.log(`📧 Attempting to send creation emails for #${o.id} using sender: ${fromAddress}`);
            try {
                // Generate detailed HTML content
                const fullHtml = generateEmailHtml(o, `Potvrzení objednávky #${o.id}`, 'Děkujeme za Vaši objednávku. Níže naleznete rekapitulaci.');

                // 1. Email to Customer (With Attachments)
                const [userRows] = await db.query('SELECT email FROM users WHERE id = ?', [o.userId]);
                const userEmail = userRows[0]?.email;

                if (userEmail) {
                    console.log(`📄 Generating PDF attachments...`);
                    const attachments = [];
                    
                    // 1. Invoice
                    try {
                        const invoicePdf = await generateInvoicePdf(o, 'proforma', settings);
                        attachments.push({ filename: `zalohova_faktura_${o.id}.pdf`, content: invoicePdf });
                    } catch (pdfErr) {
                        console.error('Failed to generate invoice PDF:', pdfErr);
                    }

                    // 2. VOP
                    try {
                        const vopPdf = await getVopPdfBuffer();
                        if (vopPdf) {
                            attachments.push({ filename: 'VOP_4Gracie.pdf', content: vopPdf });
                        }
                    } catch (vopErr) {
                        console.error('Failed to load VOP file:', vopErr);
                    }

                    console.log(`📨 Sending customer email to ${userEmail}...`);
                    await transporter.sendMail({
                        from: fromAddress,
                        replyTo: operatorEmail, // Customer replies to Operator
                        to: userEmail,
                        subject: `Potvrzení objednávky #${o.id}`,
                        html: fullHtml,
                        attachments,
                        textEncoding: 'base64'
                    });
                    console.log(`✅ Customer email sent to ${userEmail}`);
                } else {
                    console.warn(`⚠️ User email not found for ID ${o.userId}`);
                }

                // 2. Email to Operator (NO Attachments, Detailed Info)
                // Ensure operator email is not null/empty
                if (operatorEmail) {
                    console.log(`📨 Sending operator email to ${operatorEmail}...`);
                    await transporter.sendMail({
                        from: fromAddress,
                        replyTo: userEmail || fromAddress, // Operator replies to Customer
                        to: operatorEmail,
                        subject: `Nová objednávka #${o.id} (${o.userName})`,
                        html: fullHtml,
                        textEncoding: 'base64' 
                    });
                    console.log(`✅ Operator email sent to ${operatorEmail}`);
                }

            } catch (emailErr) {
                console.error("❌ Failed to send order emails (SMTP):", emailErr);
                if (emailErr.response) {
                    console.error("❌ SMTP Response:", emailErr.response);
                }
            }
        }

        res.json({ success: true });
    } catch (e) { 
        console.error("❌ Order Transaction Failed:", e);
        await conn.rollback(); 
        throw e; 
    } finally { 
        conn.release(); 
    }
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
    
    // Fetch settings for PDF generation if needed
    const [settingsRows] = await db.query('SELECT * FROM app_settings WHERE key_name = "global"');
    const settings = settingsRows.length ? parseJsonCol(settingsRows[0]) : {};
    
    const operatorEmail = settings.companyDetails?.email || 'info@4gracie.cz';
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER;

    const placeholders = ids.map(() => '?').join(',');
    let sql = `UPDATE orders SET status=?, full_json=JSON_SET(full_json, '$.status', ?)`;
    
    // If delivering, set finalInvoiceDate
    if (status === 'delivered') {
        sql += `, final_invoice_date = IF(final_invoice_date IS NULL, NOW(), final_invoice_date), full_json = JSON_SET(full_json, '$.finalInvoiceDate', DATE_FORMAT(IF(final_invoice_date IS NULL, NOW(), final_invoice_date), '%Y-%m-%dT%H:%i:%s.000Z'))`;
    }
    
    sql += ` WHERE id IN (${placeholders})`;
    await db.query(sql, [status, status, ...ids]);
    
    // --- EMAIL NOTIFICATION FOR STATUS UPDATE ---
    if (notifyCustomer && transporter) {
        console.log(`📧 Sending status update emails for ${ids.length} orders...`);
        // Fetch full order data to generate emails
        const [rows] = await db.query(`SELECT full_json, final_invoice_date, u.email FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id IN (${placeholders})`, ids);
        
        for (const row of rows) {
            if (row.email) {
                try {
                    const o = parseJsonCol(row, 'full_json');
                    if (row.final_invoice_date) o.finalInvoiceDate = row.final_invoice_date;

                    // Use common HTML generator
                    const czStatus = STATUS_TRANSLATIONS[status] || status;
                    let emailBodyHtml = generateEmailHtml(o, `Změna stavu objednávky #${o.id}`, `Stav Vaší objednávky byl změněn na: <strong>${czStatus}</strong>.`);
                    const attachments = [];

                    // If delivered, generate Final Invoice
                    if (status === 'delivered') {
                        console.log(`📄 Generating Final Invoice for #${o.id}...`);
                        try {
                            const finalInvoicePdf = await generateInvoicePdf(o, 'final', settings);
                            attachments.push({ filename: `faktura_${o.id}.pdf`, content: finalInvoicePdf });
                            emailBodyHtml = emailBodyHtml.replace('</body>', '<p style="text-align:center; font-weight:bold;">V příloze naleznete daňový doklad.</p></body>');
                        } catch (invErr) {
                            console.error('Invoice gen error in status update:', invErr);
                        }
                    }

                    await transporter.sendMail({ 
                        from: fromAddress, 
                        replyTo: operatorEmail,
                        to: row.email, 
                        subject: `Změna stavu objednávky #${o.id}`, 
                        html: emailBodyHtml,
                        attachments,
                        textEncoding: 'base64'
                    });
                    console.log(`✅ Status update email sent to ${row.email} for order #${o.id}`);
                } catch (emailErr) {
                    console.error(`❌ Failed to send status email for order ${row.id || '?'}:`, emailErr);
                    if (emailErr.response) {
                        console.error("❌ SMTP Response:", emailErr.response);
                    }
                }
            }
        }
    }
    res.json({ success: true });
}));

// OTHER ADMIN ENDPOINTS
app.get('/api/admin/stats/load', withDb(async (req, res, db) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Missing date" });
    const targetDate = formatToMysqlDate(date); 
    
    // Updated SQL Queries to robustly handle category and unit missing in relational columns by falling back to JSON data
    
    const summaryQuery = `
        SELECT 
            t.category, 
            SUM(t.total_item_workload) as total_workload, 
            SUM(t.overhead) as total_overhead, 
            COUNT(DISTINCT t.order_id) as order_count 
        FROM (
            SELECT 
                o.id as order_id, 
                COALESCE(p.category, JSON_UNQUOTE(JSON_EXTRACT(p.full_json, '$.category')), oi.category, 'unknown') as category, 
                (oi.quantity * COALESCE(p.workload, oi.workload, 0)) as total_item_workload, 
                COALESCE(p.workload_overhead, oi.workload_overhead, 0) as overhead 
            FROM order_items oi 
            JOIN orders o ON o.id = oi.order_id 
            LEFT JOIN products p ON oi.product_id = p.id 
            WHERE o.delivery_date = ? AND o.status != 'cancelled'
        ) t 
        GROUP BY t.category
    `;

    const detailQuery = `
        SELECT 
            t.category, 
            t.product_id, 
            t.name, 
            t.unit, 
            SUM(t.quantity) as total_quantity, 
            SUM(t.total_item_workload) as product_workload 
        FROM (
            SELECT 
                COALESCE(p.category, JSON_UNQUOTE(JSON_EXTRACT(p.full_json, '$.category')), oi.category, 'unknown') as category, 
                oi.product_id, 
                COALESCE(p.name, oi.name) as name, 
                COALESCE(p.unit, JSON_UNQUOTE(JSON_EXTRACT(p.full_json, '$.unit')), oi.unit) as unit, 
                oi.quantity, 
                (oi.quantity * COALESCE(p.workload, oi.workload, 0)) as total_item_workload 
            FROM order_items oi 
            JOIN orders o ON o.id = oi.order_id 
            LEFT JOIN products p ON oi.product_id = p.id 
            WHERE o.delivery_date = ? AND o.status != 'cancelled'
        ) t 
        GROUP BY t.category, t.product_id, t.name, t.unit
    `;

    const [summary] = await db.query(summaryQuery, [targetDate]);
    const [details] = await db.query(detailQuery, [targetDate]);
    res.json({ success: true, summary, details });
}));

app.post('/api/settings', withDb(async (req, res, db) => {
  if (req.body.sqlDebug !== undefined) sqlDebugMode = !!req.body.sqlDebug;
  await db.query('INSERT INTO app_settings (key_name, data) VALUES ("global", ?) ON DUPLICATE KEY UPDATE data=?', [JSON.stringify(req.body), JSON.stringify(req.body)]);
  res.json({ success: true });
}));
app.post('/api/discounts', withDb(async (req, res, db) => { const d = req.body; await db.query('INSERT INTO discounts (id, code, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data=?', [d.id, d.code, JSON.stringify(d), JSON.stringify(d)]); res.json({ success: true }); }));
app.delete('/api/discounts/:id', withDb(async (req, res, db) => { await db.query('DELETE FROM discounts WHERE id=?', [req.params.id]); res.json({ success: true }); }));
app.post('/api/calendar', withDb(async (req, res, db) => { const c = req.body; await db.query('INSERT INTO calendar_exceptions (date, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data=?', [c.date, JSON.stringify(c), JSON.stringify(c)]); res.json({ success: true }); }));
app.delete('/api/calendar/:date', withDb(async (req, res, db) => { await db.query('DELETE FROM calendar_exceptions WHERE date=?', [req.params.date]); res.json({ success: true }); }));

app.post('/api/admin/upload', async (req, res) => {
    const { image, name } = req.body;
    if (!image) return res.status(400).json({ error: 'No image' });
    const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid format' });
    const buffer = Buffer.from(matches[2], 'base64');
    const safeName = name ? name.replace(/[^a-z0-9]/gi, '_') : 'img';
    const fileName = `${Date.now()}_${safeName}.jpg`;
    const fullPath = path.join(UPLOAD_IMAGES_DIR, fileName);
    try {
        fs.writeFileSync(fullPath, buffer);
        res.json({ success: true, url: `/uploads/images/${fileName}` });
    } catch (err) { res.status(500).json({ error: 'Save failed', details: err.message }); }
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
