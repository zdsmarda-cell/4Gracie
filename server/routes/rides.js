
import express from 'express';
import { withDb } from '../db.js';
import { requireAdmin, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get Rides - Protected (Admin or Driver)
router.get('/', authenticateToken, withDb(async (req, res, db) => {
    // If not admin, maybe filter by driver ID? For now admin gets all, driver logic handled in UI or separate query.
    // Let's return all rides for now as the driver might need to see history.
    // Ideally filter by date range to optimize.
    const { date } = req.query;
    
    let query = 'SELECT * FROM rides WHERE 1=1';
    const params = [];
    
    if (date) {
        query += ' AND date = ?';
        params.push(date);
    } else {
        // Default to recent rides (last 30 days and future) if no date specified to avoid huge payload
        query += ' AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }
    
    query += ' ORDER BY date DESC';

    const [rows] = await db.query(query, params);
    
    // Parse JSON columns
    const rides = rows.map(r => ({
        id: r.id,
        date: r.date,
        driverId: r.driver_id,
        status: r.status,
        departureTime: r.departure_time,
        orderIds: typeof r.order_ids === 'string' ? JSON.parse(r.order_ids) : r.order_ids,
        steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps
    }));
    
    res.json({ success: true, rides });
}));

// Create/Update Ride - Admin Only (or Driver if allowed, here limited to Admin/Drivers who plan?)
// Usually only Admin plans rides.
router.post('/', authenticateToken, withDb(async (req, res, db) => {
    const ride = req.body;
    
    if (!ride.id || !ride.driverId || !ride.date) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const orderIdsJson = JSON.stringify(ride.orderIds || []);
    const stepsJson = JSON.stringify(ride.steps || []);

    // Check existence
    const [exists] = await db.query('SELECT id FROM rides WHERE id = ?', [ride.id]);
    
    if (exists.length > 0) {
        await db.query(
            'UPDATE rides SET date=?, driver_id=?, status=?, departure_time=?, order_ids=?, steps=? WHERE id=?',
            [ride.date, ride.driverId, ride.status, ride.departureTime, orderIdsJson, stepsJson, ride.id]
        );
    } else {
        await db.query(
            'INSERT INTO rides (id, date, driver_id, status, departure_time, order_ids, steps) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [ride.id, ride.date, ride.driverId, ride.status, ride.departureTime, orderIdsJson, stepsJson]
        );
    }
    
    res.json({ success: true });
}));

// Delete Ride - Admin Only
router.delete('/:id', requireAdmin, withDb(async (req, res, db) => {
    await db.query('DELETE FROM rides WHERE id = ?', [req.params.id]);
    res.json({ success: true });
}));

export default router;
