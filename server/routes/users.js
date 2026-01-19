
import express from 'express';
import { withDb } from '../db.js';
import nodemailer from 'nodemailer';
import jwt from '../services/jwt.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET || 'dev_secret_key_change_in_prod';
const REFRESH_SECRET_KEY = process.env.JWT_REFRESH_SECRET || (SECRET_KEY + '_refresh');

const hashPassword = (pwd) => `hashed_${Buffer.from(pwd).toString('base64')}`;

// GET USERS (Protected - Admin)
router.get('/', withDb(async (req, res, db) => {
    const { search, hasPush, zip } = req.query;
    
    // Base query
    let query = `
        SELECT DISTINCT u.*, 
        (SELECT COUNT(*) FROM push_subscriptions ps WHERE ps.user_id = u.id) > 0 as has_push 
        FROM users u 
    `;
    
    // Join with addresses if filtering by ZIP to ensure we only get relevant users
    if (zip) {
        query += ` JOIN user_addresses ua ON u.id = ua.user_id `;
    }

    query += ` WHERE 1=1 `;
    
    const params = [];
    if (search) { query += ' AND (u.email LIKE ? OR u.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    
    // Filter only users with active push subscription if requested
    if (hasPush === 'true') {
        query += ' AND (SELECT COUNT(*) FROM push_subscriptions ps WHERE ps.user_id = u.id) > 0';
    }

    // Filter by ZIP
    if (zip) {
        // Remove spaces for loose matching
        const cleanZip = zip.replace(/\s/g, '');
        query += ' AND REPLACE(ua.zip, " ", "") LIKE ?';
        params.push(`%${cleanZip}%`);
    }

    query += ' LIMIT 200'; // Limit results
    
    const [rows] = await db.query(query, params);
    const users = [];
    for (const row of rows) {
        const [addrs] = await db.query('SELECT * FROM user_addresses WHERE user_id = ?', [row.id]);
        users.push({
            id: row.id, email: row.email, name: row.name, phone: row.phone, role: row.role,
            isBlocked: Boolean(row.is_blocked), marketingConsent: Boolean(row.marketing_consent),
            hasPushSubscription: Boolean(row.has_push),
            deliveryAddresses: addrs.filter(a => a.type === 'delivery'),
            billingAddresses: addrs.filter(a => a.type === 'billing')
        });
    }
    res.json({ success: true, users });
}));

// GET CURRENT USER (Fresh Data)
router.get('/me', authenticateToken, withDb(async (req, res, db) => {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    
    if (rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    const u = rows[0];
    const [addrs] = await db.query('SELECT * FROM user_addresses WHERE user_id = ?', [u.id]);
    
    // Check push status
    const [push] = await db.query('SELECT COUNT(*) as c FROM push_subscriptions WHERE user_id = ?', [u.id]);

    const userData = {
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        role: u.role,
        isBlocked: Boolean(u.is_blocked),
        marketingConsent: Boolean(u.marketing_consent),
        hasPushSubscription: push[0].c > 0,
        deliveryAddresses: addrs.filter(a => a.type === 'delivery'),
        billingAddresses: addrs.filter(a => a.type === 'billing')
    };

    res.json({ success: true, user: userData });
}));

// CREATE/UPDATE USER
router.post('/', withDb(async (req, res, db) => {
    const u = req.body;
    
    await db.query(
        `INSERT INTO users (id, email, password_hash, name, phone, role, is_blocked, marketing_consent) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE 
         email=?, 
         password_hash=COALESCE(?, password_hash), 
         name=?, 
         phone=?, 
         role=?, 
         is_blocked=?, 
         marketing_consent=?`, 
        [
            u.id, u.email, u.passwordHash, u.name, u.phone, u.role, u.isBlocked, u.marketingConsent, 
            // Update params:
            u.email, 
            u.passwordHash || null, 
            u.name, 
            u.phone, 
            u.role, 
            u.isBlocked, 
            u.marketingConsent
        ]
    );

    await db.query('DELETE FROM user_addresses WHERE user_id = ?', [u.id]);
    const addresses = [...(u.deliveryAddresses||[]).map(a=>({...a,type:'delivery'})), ...(u.billingAddresses||[]).map(a=>({...a,type:'billing'}))];
    if (addresses.length > 0) {
        const values = addresses.map(a => [a.id || Date.now()+Math.random(), u.id, a.type, a.name, a.street, a.city, a.zip, a.phone, a.ic||null, a.dic||null]);
        await db.query('INSERT INTO user_addresses (id, user_id, type, name, street, city, zip, phone, ic, dic) VALUES ?', [values]);
    }
    res.json({ success: true });
}));

// AUTH LOGIN - Generates Tokens
router.post('/login', withDb(async (req, res, db) => {
    const { email, password, isPwa } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (rows.length > 0) {
        const u = rows[0];
        
        if (!u.password_hash) {
            return res.json({ success: false, message: 'Účet nemá nastavené heslo. Kontaktujte podporu nebo proveďte reset hesla.' });
        }

        const reqHash = hashPassword(password || '');
        if (u.password_hash !== reqHash) {
            return res.json({ success: false, message: 'Chybné heslo.' });
        }

        if (Boolean(u.is_blocked)) {
            return res.json({ success: false, message: 'Účet je zablokován.' });
        }

        const refreshExp = isPwa ? (365 * 24 * 60 * 60) : (24 * 60 * 60);

        const token = jwt.sign(
            { id: u.id, email: u.email, role: u.role }, 
            SECRET_KEY, 
            { expiresIn: '15m' } 
        );

        const refreshToken = jwt.sign(
            { id: u.id, email: u.email, role: u.role, type: 'refresh' },
            REFRESH_SECRET_KEY,
            { expiresIn: refreshExp }
        );

        const [addrs] = await db.query('SELECT * FROM user_addresses WHERE user_id = ?', [u.id]);
        
        // Check push status
        const [push] = await db.query('SELECT COUNT(*) as c FROM push_subscriptions WHERE user_id = ?', [u.id]);

        res.json({ 
            success: true, 
            token, 
            refreshToken,
            user: { 
                id: u.id, 
                email: u.email, 
                name: u.name, 
                phone: u.phone, 
                role: u.role, 
                isBlocked: Boolean(u.is_blocked), 
                marketingConsent: Boolean(u.marketing_consent), 
                hasPushSubscription: push[0].c > 0,
                deliveryAddresses: addrs.filter(a => a.type === 'delivery'), 
                billingAddresses: addrs.filter(a => a.type === 'billing') 
            } 
        });
    } else { 
        res.json({ success: false, message: 'Uživatel nenalezen.' }); 
    }
}));

// REFRESH TOKEN ENDPOINT
router.post('/refresh-token', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ success: false, message: 'No token' });

    jwt.verify(refreshToken, REFRESH_SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Invalid refresh token' });
        
        const newAccessToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            SECRET_KEY,
            { expiresIn: '15m' } 
        );

        res.json({ success: true, token: newAccessToken });
    });
});

// PASSWORD RESET
router.post('/reset-password', withDb(async (req, res, db) => {
    const { email } = req.body;
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    
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
