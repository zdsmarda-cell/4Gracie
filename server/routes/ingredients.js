
import express from 'express';
import { withDb, parseJsonCol } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET All Ingredients
router.get('/', withDb(async (req, res, db) => {
    const [rows] = await db.query('SELECT * FROM ingredients ORDER BY name ASC');
    const ingredients = rows.map(r => parseJsonCol(r, 'full_json'));
    res.json({ success: true, ingredients });
}));

// POST Create/Update Ingredient
router.post('/', requireAdmin, withDb(async (req, res, db) => {
    const ingredient = req.body;
    
    if (!ingredient.id || !ingredient.name || !ingredient.unit) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const jsonStr = JSON.stringify(ingredient);
    
    // Check existence
    const [exists] = await db.query('SELECT id FROM ingredients WHERE id = ?', [ingredient.id]);
    
    if (exists.length > 0) {
        await db.query(
            'UPDATE ingredients SET name=?, unit=?, image_url=?, is_hidden=?, full_json=? WHERE id=?',
            [ingredient.name, ingredient.unit, ingredient.imageUrl || null, ingredient.isHidden || false, jsonStr, ingredient.id]
        );
    } else {
        await db.query(
            'INSERT INTO ingredients (id, name, unit, image_url, is_hidden, full_json) VALUES (?, ?, ?, ?, ?, ?)',
            [ingredient.id, ingredient.name, ingredient.unit, ingredient.imageUrl || null, ingredient.isHidden || false, jsonStr]
        );
    }
    
    res.json({ success: true });
}));

// DELETE Ingredient
router.delete('/:id', requireAdmin, withDb(async (req, res, db) => {
    // Check if used in products (optional logic, but good practice. For now simpler: allow delete, frontend handles logic)
    await db.query('DELETE FROM ingredients WHERE id = ?', [req.params.id]);
    res.json({ success: true });
}));

export default router;
