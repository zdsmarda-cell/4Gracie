
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.SMTP_HOST = 'smtp.test.com';
        process.env.SMTP_USER = 'test-user';
        process.env.EMAIL_FROM = 'noreply@test.com';
        initEmail(); // Initialize transporter
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
});
