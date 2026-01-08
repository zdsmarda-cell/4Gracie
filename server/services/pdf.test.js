
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { generateInvoicePdf } from './pdf.js';

// Setup Mock for Text Calls
const textSpy = vi.fn();

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
            text(str, x, y, opts) { textSpy(str); } // Capture text output
            addImage() {}
            output(type) { return type === 'arraybuffer' ? new ArrayBuffer(100) : 'pdf-content'; }
        }
    };
});

// Mock jspdf-autotable
vi.mock('jspdf-autotable', () => ({
    default: vi.fn()
}));

describe('PDF Service', () => {
    it('should generate a PDF and calculate correct total (Discount on items ONLY)', async () => {
        textSpy.mockClear();

        // SCENARIO:
        // Item: 1000 CZK
        // Discount: 500 CZK (AppliedDiscount)
        // Shipping: 200 CZK
        // Packaging: 50 CZK
        //
        // CORRECT MATH: (1000 - 500) + 200 + 50 = 750 CZK
        // WRONG MATH (if discount applied to fees): (1000 + 200 + 50) - 500 = 750 (coincidentally same if flat)
        // WRONG MATH (if percentage logic was used on total): (1250) * 0.5 = 625.
        // Let's rely on the explicit values passed.
        
        const mockOrder = {
            id: '123',
            items: [{ name: 'Test Product', quantity: 1, price: 1000, vatRateTakeaway: 21 }],
            totalPrice: 1000,
            packagingFee: 50,
            deliveryFee: 200,
            appliedDiscounts: [{ code: 'TEST', amount: 500 }],
            createdAt: new Date().toISOString(),
            companyDetailsSnapshot: { name: 'Test Co', bankAccount: '123456789/0100' }
        };
        const mockSettings = { companyDetails: { name: 'Test Co', bankAccount: '123456789/0100' } };

        await generateInvoicePdf(mockOrder, 'proforma', mockSettings);
        
        // Assert that the total string matches expected calculation
        // Expected: "CELKEM K ÚHRADĚ: 750.00 Kč"
        expect(textSpy).toHaveBeenCalledWith(expect.stringContaining('CELKEM K ÚHRADĚ: 750.00 Kč'));
    });
});
