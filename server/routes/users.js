
import express from 'express';
import { withDb } from '../db.js';
import nodemailer from 'nodemailer';

const router = express.Router();

const hashPassword = (pwd) => `hashed_${Buffer.from(pwd).toString('base64')}`;

// GET USERS
router.get('/', withDb(async (req, res, db) => {
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

// CREATE/UPDATE USER
router.post('/', withDb(async (req, res, db) => {
    const u = req.body;
    await db.query(`INSERT INTO users (id, email, password_hash, name, phone, role, is_blocked, marketing_consent) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE email=?, password_hash=?, name=?, phone=?, role=?, is_blocked=?, marketing_consent=?`, [u.id, u.email, u.passwordHash, u.name, u.phone, u.role, u.isBlocked, u.marketingConsent, u.email, u.passwordHash, u.name, u.phone, u.role, u.isBlocked, u.marketingConsent]);
    await db.query('DELETE FROM user_addresses WHERE user_id = ?', [u.id]);
    const addresses = [...(u.deliveryAddresses||[]).map(a=>({...a,type:'delivery'})), ...(u.billingAddresses||[]).map(a=>({...a,type:'billing'}))];
    if (addresses.length > 0) {
        const values = addresses.map(a => [a.id || Date.now()+Math.random(), u.id, a.type, a.name, a.street, a.city, a.zip, a.phone, a.ic||null, a.dic||null]);
        await db.query('INSERT INTO user_addresses (id, user_id, type, name, street, city, zip, phone, ic, dic) VALUES ?', [values]);
    }
    res.json({ success: true });
}));

// AUTH LOGIN
router.post('/login', withDb(async (req, res, db) => {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [req.body.email]);
    if (rows.length > 0) {
        const u = rows[0];
        const [addrs] = await db.query('SELECT * FROM user_addresses WHERE user_id = ?', [u.id]);
        res.json({ success: true, user: { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, isBlocked: Boolean(u.is_blocked), marketingConsent: Boolean(u.marketing_consent), passwordHash: u.password_hash, deliveryAddresses: addrs.filter(a => a.type === 'delivery'), billingAddresses: addrs.filter(a => a.type === 'billing') } });
    } else { res.json({ success: false, message: 'User not found' }); }
}));

// PASSWORD RESET
router.post('/reset-password', withDb(async (req, res, db) => {
    const { email } = req.body;
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    
    // Quick SMTP transporter for just this call if not globally cached, but generally handled by initEmail
    // Here we reuse logic from email service ideally, but for simplicity keeping inline with guard
    if (rows.length > 0 && process.env.SMTP_HOST) {
        const token = Buffer.from(`${email}-${Date.now()}`).toString('base64');
        const link = `${process.env.VITE_APP_URL || 'https://eshop.4gracie.cz'}/#/reset-password?token=${token}`;
        
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 465,
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            tls: { rejectUnauthorized: false }
        });

        await transporter.sendMail({ 
            from: process.env.EMAIL_FROM,
            to: email, 
            subject: 'Obnova hesla', 
            html: `<a href="${link}">Resetovat heslo</a>` 
        }).catch(err => console.error("Email send fail:", err));
    }
    res.json({ success: true, message: 'Email odeslán.' });
}));

router.post('/reset-password-confirm', withDb(async (req, res, db) => {
    const { token, newPasswordHash } = req.body;
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const email = decoded.substring(0, decoded.lastIndexOf('-'));
        await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [newPasswordHash, email]);
        res.json({ success: true, message: 'Heslo změněno.' });
    } catch (e) { res.status(400).json({ success: false }); }
}));

export default router;
