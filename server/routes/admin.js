
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
        // Add more tables as needed for full import logic
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
