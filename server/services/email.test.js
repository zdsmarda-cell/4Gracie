
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processCustomerEmail, processOperatorEmail, initEmail } from './email.js';

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
    const originalEnv = process.env;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env = { ...originalEnv }; // Clone env
        process.env.SMTP_HOST = 'smtp.test.com';
        process.env.SMTP_USER = 'test-user';
        process.env.EMAIL_FROM = 'noreply@test.com';
        process.env.APP_URL = 'https://myshop.com';
        process.env.PORT = '3000';
        initEmail(); // Initialize transporter
    });

    afterEach(() => {
        process.env = originalEnv; // Restore env
    });

    it('should send created order email with attachments (Customer)', async () => {
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

        // Test customer processing directly
        await processCustomerEmail('customer@test.com', order, 'created', settings);

        expect(sendMailMock).toHaveBeenCalledTimes(1);
        
        // Check customer email arguments
        const customerCall = sendMailMock.mock.calls[0][0];
        expect(customerCall.to).toBe('customer@test.com');
        expect(customerCall.subject).toContain('Potvrzení objednávky');
        expect(customerCall.attachments).toHaveLength(1); // Invoice PDF
    });

    it('should send created order email to Operator', async () => {
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

        // Test operator processing directly
        await processOperatorEmail('admin@test.com', order, 'created', settings);

        expect(sendMailMock).toHaveBeenCalledTimes(1);
        
        const operatorCall = sendMailMock.mock.calls[0][0];
        expect(operatorCall.to).toBe('admin@test.com');
        expect(operatorCall.subject).toContain('Nová objednávka');
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

        // Test customer status update logic
        await processCustomerEmail('customer@test.com', order, 'status', settings, 'confirmed');

        expect(sendMailMock).toHaveBeenCalledTimes(1);
        const call = sendMailMock.mock.calls[0][0];
        expect(call.to).toBe('customer@test.com');
        expect(call.subject).toContain('Order Status Update');
    });

    it('should ensure email body is Base64 encoded and contains absolute URLs', async () => {
        const order = {
            id: '123',
            userId: 'u1',
            status: 'created',
            items: [
                { name: 'Test Product', quantity: 1, price: 100, images: ['product.jpg'] }
            ],
            totalPrice: 100,
            packagingFee: 0,
            deliveryFee: 0,
            language: 'cs'
        };
        const settings = { companyDetails: {} };

        await processCustomerEmail('test@test.com', order, 'created', settings);

        const callArgs = sendMailMock.mock.calls[0][0];

        // 1. Verify Base64 encoding setting
        expect(callArgs.encoding).toBe('base64');

        // 2. Verify Absolute URLs in HTML
        const html = callArgs.html;
        
        // Logo URL check (matches getWebUrl logic)
        expect(html).toContain('https://myshop.com/logo.png');
        
        // Product Image URL check (matches getApiUrl logic which adds port for backend)
        // Logic: `https://${domain}:${port}/api/uploads/...`
        expect(html).toContain('https://myshop.com:3000/api/uploads/product.jpg');
    });
});
