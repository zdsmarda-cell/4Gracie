
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendOrderEmail, initEmail } from './email.js';

// Mock Nodemailer
const sendMailMock = vi.fn();
vi.mock('nodemailer', () => ({
    default: {
        createTransport: vi.fn(() => ({
            verify: vi.fn().mockResolvedValue(true),
            sendMail: sendMailMock
        }))
    }
}));

// Mock Database
vi.mock('../db.js', () => ({
    getDb: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue([[{ email: 'customer@test.com' }]])
    })
}));

// Mock PDF generation to avoid complex dependencies in email test
vi.mock('./pdf.js', () => ({
    generateInvoicePdf: vi.fn().mockResolvedValue(Buffer.from('mock-pdf'))
}));

describe('Email Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.SMTP_HOST = 'smtp.test.com';
        process.env.EMAIL_FROM = 'noreply@test.com';
        initEmail(); // Initialize transporter
    });

    it('should send created order email with attachments', async () => {
        const order = {
            id: '123',
            userId: 'u1',
            status: 'created',
            items: [],
            totalPrice: 100,
            packagingFee: 0,
            deliveryFee: 0,
            language: 'cs'
        };
        const settings = { companyDetails: { email: 'admin@test.com' } };

        await sendOrderEmail(order, 'created', settings);

        // Expect 2 calls: 1 to customer, 1 to admin
        expect(sendMailMock).toHaveBeenCalledTimes(2);
        
        // Check customer email
        const customerCall = sendMailMock.calls.find(call => call[0].to === 'customer@test.com');
        expect(customerCall).toBeDefined();
        expect(customerCall[0].subject).toContain('Potvrzení objednávky');
        expect(customerCall[0].attachments).toHaveLength(1); // Invoice PDF
    });

    it('should send status update email', async () => {
        const order = {
            id: '123',
            userId: 'u1',
            status: 'confirmed', // changed status
            items: [],
            totalPrice: 100,
            packagingFee: 0,
            deliveryFee: 0,
            language: 'en'
        };
        const settings = {};

        await sendOrderEmail(order, 'status', settings, 'confirmed');

        expect(sendMailMock).toHaveBeenCalledTimes(1);
        const call = sendMailMock.calls[0][0];
        expect(call.to).toBe('customer@test.com');
        expect(call.subject).toContain('Order Status Update');
    });
});
