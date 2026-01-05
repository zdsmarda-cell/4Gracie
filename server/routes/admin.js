
import express from 'express';
import { withDb } from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', 'uploads');
const UPLOAD_IMAGES_DIR = path.join(UPLOAD_ROOT, 'images');

// Ensure dirs
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
if (!fs.existsSync(UPLOAD_IMAGES_DIR)) fs.mkdirSync(UPLOAD_IMAGES_DIR, { recursive: true });

// TRANSLATE
router.post('/translate', async (req, res) => {
    const { sourceData } = req.body;
    if (!sourceData) return res.status(400).json({ error: 'Missing sourceData' });
    if (!process.env.API_KEY) return res.json({ translations: { en: {}, de: {} } });

    try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Translate to EN/DE JSON: ${JSON.stringify(sourceData)}`;
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        res.json(JSON.parse(cleanText));
    } catch (e) {
        console.error("Translation Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// UPLOAD
router.post('/upload', async (req, res) => {
    const { image, name } = req.body;
    if (!image) return res.status(400).json({ error: 'No image' });
    const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid format' });
    let ext = matches[1]; if(ext==='jpeg')ext='jpg'; if(ext==='svg+xml')ext='svg';
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `${Date.now()}_${(name||'img').replace(/[^a-z0-9]/gi,'_')}.${ext}`;
    const fullPath = path.join(UPLOAD_IMAGES_DIR, fileName);
    
    try { 
        fs.writeFileSync(fullPath, buffer);
        console.log(`✅ Image saved: ${fullPath}`);
        res.json({ success: true, url: `/api/uploads/images/${fileName}` }); 
    } catch (err) { 
        console.error("❌ Save failed:", err);
        res.status(500).json({ error: 'Save failed' }); 
    }
});

// STATS
router.get('/stats/load', withDb(async (req, res, db) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Missing date" });
    
    const summaryQuery = `
        SELECT 
            COALESCE(p.category, JSON_UNQUOTE(JSON_EXTRACT(p.full_json, '$.category')), oi.category, 'unknown') as category,
            SUM(oi.quantity * COALESCE(p.workload, oi.workload, 0)) as total_workload, 
            SUM(DISTINCT COALESCE(p.workload_overhead, oi.workload_overhead, 0)) as total_overhead,
            COUNT(DISTINCT order_id) as order_count
        FROM order_items oi 
        JOIN orders o ON o.id = oi.order_id 
        LEFT JOIN products p ON oi.product_id = p.id 
        WHERE o.delivery_date = ? AND o.status != 'cancelled'
        GROUP BY category
    `;

    const detailQuery = `
        SELECT 
            COALESCE(p.category, JSON_UNQUOTE(JSON_EXTRACT(p.full_json, '$.category')), oi.category, 'unknown') as category, 
            oi.product_id, 
            COALESCE(p.name, oi.name) as name, 
            COALESCE(p.unit, JSON_UNQUOTE(JSON_EXTRACT(p.full_json, '$.unit')), oi.unit) as unit, 
            SUM(oi.quantity) as total_quantity, 
            SUM(oi.quantity * COALESCE(p.workload, oi.workload, 0)) as product_workload,
            MAX(COALESCE(p.workload_overhead, oi.workload_overhead, 0)) as unit_overhead
        FROM order_items oi 
        JOIN orders o ON o.id = oi.order_id 
        LEFT JOIN products p ON oi.product_id = p.id 
        WHERE o.delivery_date = ? AND o.status != 'cancelled'
        GROUP BY category, oi.product_id, name, unit
    `;

    const [summary] = await db.query(summaryQuery, [date]);
    const [details] = await db.query(detailQuery, [date]);
    res.json({ success: true, summary, details });
}));

// IMPORT
router.post('/import', withDb(async (req, res, db) => {
    const { data } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        if (data.products) {
            await conn.query('DELETE FROM products');
            for(const p of data.products) await conn.query('INSERT INTO products (id, name, full_json) VALUES (?,?,?)', [p.id, p.name, JSON.stringify(p)]);
        }
        await conn.commit();
        res.json({ success: true });
    } catch(e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally {
        conn.release();
    }
}));

export default router;
