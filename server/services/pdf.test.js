
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { generateInvoicePdf } from './pdf.js';

// Polyfills for Node environment
beforeAll(() => {
    global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
    global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
    
    // Mock Fetch
    global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
        statusText: 'OK'
    }));
});

// Mock jsPDF
vi.mock('jspdf', () => {
    return {
        jsPDF: class {
            constructor() {}
            addFileToVFS() {}
            addFont() {}
            setFont() {}
            setTextColor() {}
            setFontSize() {}
            text() {}
            addImage() {}
            output(type) { return type === 'arraybuffer' ? new ArrayBuffer(100) : 'pdf-content'; }
        }
    };
});

// Mock jspdf-autotable (it attaches itself to jsPDF usually, but we mock the import)
vi.mock('jspdf-autotable', () => ({
    default: vi.fn()
}));

describe('PDF Service', () => {
    it('should generate a PDF buffer for an order', async () => {
        const mockOrder = {
            id: '123',
            items: [{ name: 'Test Product', quantity: 2, price: 100, vatRateTakeaway: 21 }],
            totalPrice: 200,
            packagingFee: 0,
            deliveryFee: 0,
            createdAt: new Date().toISOString(),
            companyDetailsSnapshot: { name: 'Test Co', bankAccount: '123456789/0100' }
        };
        const mockSettings = { companyDetails: { name: 'Test Co', bankAccount: '123456789/0100' } };

        const buffer = await generateInvoicePdf(mockOrder, 'proforma', mockSettings);
        
        expect(buffer).toBeDefined();
        // Since we mocked output to return ArrayBuffer(100) and convert to Buffer
        expect(Buffer.isBuffer(buffer)).toBe(true);
    });
});
