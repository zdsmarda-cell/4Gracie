
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import ordersRoutes from '../routes/orders.js';

// --- MOCKS ---

// 1. Mock WebPush
vi.mock('web-push', () => ({
    default: {
        setVapidDetails: vi.fn(),
        sendNotification: vi.fn().mockResolvedValue({})
    }
}));

// 2. Mock Email Service
vi.mock('../services/email.js', () => ({
    queueOrderEmail: vi.fn().mockResolvedValue(true)
}));

// 3. Mock Authentication Middleware (Bypass checks, act as Driver)
vi.mock('../middleware/auth.js', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'driver-123', role: 'driver' }; // Simulate logged in driver
        next();
    },
    requireAdmin: (req, res, next) => next()
}));

// 4. Mock Database
const mockQuery = vi.fn();
vi.mock('../db.js', () => ({
    withDb: (handler) => (req, res) => handler(req, res, { query: mockQuery }),
    parseJsonCol: (row, col) => typeof row[col] === 'string' ? JSON.parse(row[col]) : row[col]
}));

// --- APP SETUP ---
const app = express();
app.use(express.json());
app.use('/api/orders', ordersRoutes);

describe('Server Notifications (Driver Actions)', () => {
    
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup env vars required for Push to activate
        process.env.VAPID_PUBLIC_KEY = 'mock_public_key';
        process.env.VAPID_PRIVATE_KEY = 'mock_private_key';
        process.env.EMAIL_FROM = 'info@4gracie.cz';
    });

    afterEach(() => {
        delete process.env.VAPID_PUBLIC_KEY;
        delete process.env.VAPID_PRIVATE_KEY;
    });

    it('should send Push Notification and Email when status changes to DELIVERED', async () => {
        // --- DATA MOCKING ---
        const mockOrder = {
            id: 'ord-123',
            user_id: 'user-1',
            final_invoice_date: null,
            full_json: JSON.stringify({
                id: 'ord-123',
                userId: 'user-1',
                status: 'on_way',
                language: 'cs'
            })
        };

        const mockSubscription = {
            endpoint: 'https://fcm.googleapis.com/fcm/send/test',
            p256dh: 'test-key',
            auth: 'test-auth',
            user_id: 'user-1'
        };

        // Sequence of DB calls in the route handler:
        // 1. UPDATE orders SET status...
        mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); 
        
        // 2. UPDATE orders SET final_invoice_date... (because status is 'delivered')
        mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

        // 3. SELECT id, user_id... FROM orders...
        mockQuery.mockResolvedValueOnce([[mockOrder]]);

        // 4. UPDATE orders SET full_json... (saving history)
        mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

        // 5. SELECT * FROM push_subscriptions... (Checking if user has push)
        mockQuery.mockResolvedValueOnce([[mockSubscription]]);

        // 6. INSERT INTO push_logs... (Log success)
        mockQuery.mockResolvedValueOnce([{ insertId: 1 }]);

        // 7. SELECT data FROM app_settings... (For email settings)
        mockQuery.mockResolvedValueOnce([[{ data: JSON.stringify({ companyDetails: {} }) }]]);


        // --- ACTION ---
        const response = await request(app)
            .put('/api/orders/status')
            .send({
                ids: ['ord-123'],
                status: 'delivered',
                notifyCustomer: true, // Driver checkboxes these
                sendPush: true        // Driver checkboxes these
            });

        // --- ASSERTIONS ---
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        // Verify Push Sent
        const webpush = await import('web-push');
        expect(webpush.default.sendNotification).toHaveBeenCalledTimes(1);
        expect(webpush.default.sendNotification).toHaveBeenCalledWith(
            expect.objectContaining({ endpoint: mockSubscription.endpoint }),
            expect.stringContaining('delivered') // Should contain translated status or similar logic
        );

        // Verify Email Queued
        const emailService = await import('../services/email.js');
        expect(emailService.queueOrderEmail).toHaveBeenCalledTimes(1);
        expect(emailService.queueOrderEmail).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'ord-123', status: 'delivered' }), // Order object
            'status', // Type
            expect.anything(), // Settings
            'delivered' // Custom status
        );
    });

    it('should NOT send Push if sendPush is false', async () => {
        // Mock DB calls for simple update without push lookups
        mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); // Update Status
        // Skip final date update for non-delivered status test case (e.g. cancelled)
        mockQuery.mockResolvedValueOnce([[ { ...mockOrderData('cancelled') } ]]); // Select Order
        mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); // Update JSON
        // Should NOT query subscriptions
        mockQuery.mockResolvedValueOnce([[{ data: '{}' }]]); // Settings for email

        const response = await request(app)
            .put('/api/orders/status')
            .send({
                ids: ['ord-123'],
                status: 'cancelled',
                notifyCustomer: true,
                sendPush: false // DISABLED
            });

        expect(response.status).toBe(200);

        const webpush = await import('web-push');
        expect(webpush.default.sendNotification).not.toHaveBeenCalled();
        
        const emailService = await import('../services/email.js');
        expect(emailService.queueOrderEmail).toHaveBeenCalled();
    });
});

function mockOrderData(status) {
    return {
        id: 'ord-123',
        user_id: 'user-1',
        full_json: JSON.stringify({ id: 'ord-123', userId: 'user-1', status, language: 'cs' })
    };
}
