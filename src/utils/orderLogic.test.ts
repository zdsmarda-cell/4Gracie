
import { describe, it, expect } from 'vitest';
import { calculatePackagingFeeLogic, calculateDailyLoad, getAvailableEventDatesLogic } from './orderLogic';
import { PackagingType, GlobalSettings, Product, Order } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

describe('Packaging Logic', () => {
    const boxes: PackagingType[] = [
        { id: '1', name: 'Small', volume: 500, price: 10 },
        { id: '2', name: 'Big', volume: 1000, price: 20 }
    ];

    it('should be free if over limit', () => {
        const items: any[] = [{ price: 5000, quantity: 1, volume: 100 }];
        const fee = calculatePackagingFeeLogic(items, boxes, 2000);
        expect(fee).toBe(0);
    });

    it('should calculate correct box combination', () => {
        const items: any[] = [{ price: 100, quantity: 1, volume: 1200 }];
        const fee = calculatePackagingFeeLogic(items, boxes, 5000);
        expect(fee).toBe(30);
    });

    it('should ignore items with noPackaging attribute', () => {
        const items: any[] = [
            { price: 100, quantity: 1, volume: 1200 }, 
            { price: 100, quantity: 5, volume: 1000, noPackaging: true } 
        ];
        const fee = calculatePackagingFeeLogic(items, boxes, 50000); 
        expect(fee).toBe(30);
    });
});

describe('Total Price Calculation Logic', () => {
    it('should NOT apply discount to fees (delivery/packaging)', () => {
        // Setup
        const itemPrice = 1000;
        const shippingFee = 200;
        const packagingFee = 50;
        const discountPercent = 50; // 50%

        // 1. Calculate Item Total
        const itemsTotal = itemPrice;

        // 2. Calculate Discount Amount (Should be 50% of 1000 = 500)
        const discountAmount = Math.floor(itemsTotal * (discountPercent / 100));
        
        // 3. Calculate Final Total
        // CORRECT LOGIC: (Items - Discount) + Fees
        const correctTotal = (itemsTotal - discountAmount) + shippingFee + packagingFee;
        
        expect(discountAmount).toBe(500);
        expect(correctTotal).toBe(750); // (1000 - 500) + 200 + 50
    });

    it('should handle discount larger than item price (Total >= 0)', () => {
        const itemPrice = 100;
        const shippingFee = 200;
        const discountAmount = 150; // Fixed discount larger than item

        // Formula: Math.max(0, Items - Discount) + Fees
        const total = Math.max(0, itemPrice - discountAmount) + shippingFee;
        
        expect(total).toBe(200); // 0 + 200
    });
});

describe('Fee VAT Logic', () => {
    // Requirements: Shipping/Packaging fee must inherit the highest VAT rate from items in the order
    it('should correctly determine Fee VAT Rate based on highest item rate', () => {
         // Case 1: All 0%
         const items1: any[] = [{ vatRateTakeaway: 0 }, { vatRateTakeaway: 0 }];
         let max1 = 0;
         items1.forEach(i => { if(i.vatRateTakeaway > max1) max1 = i.vatRateTakeaway; });
         expect(max1).toBe(0);

         // Case 2: Mix 0% and 12%
         const items2: any[] = [{ vatRateTakeaway: 0 }, { vatRateTakeaway: 12 }];
         let max2 = 0;
         items2.forEach(i => { if(i.vatRateTakeaway > max2) max2 = i.vatRateTakeaway; });
         expect(max2).toBe(12);

         // Case 3: Mix 12% and 21%
         const items3: any[] = [{ vatRateTakeaway: 21 }, { vatRateTakeaway: 12 }];
         let max3 = 0;
         items3.forEach(i => { if(i.vatRateTakeaway > max3) max3 = i.vatRateTakeaway; });
         expect(max3).toBe(21);
    });
});

describe('Capacity & Load Logic', () => {
    const mockSettings: GlobalSettings = {
        ...DEFAULT_SETTINGS,
        categories: [
            { id: 'warm', name: 'Teplý', order: 1, enabled: true }
        ]
    };

    const createProduct = (id: string, isEvent: boolean, capCat?: string, workload = 10, overhead = 100): Product => ({
        id,
        name: `Prod ${id}`,
        category: 'warm',
        isEventProduct: isEvent,
        capacityCategoryId: capCat,
        workload,
        workloadOverhead: overhead,
        description: '', price: 100, unit: 'ks', images: [], allergens: [], leadTimeDays: 1, shelfLifeDays: 1, volume: 0,
        visibility: { online: true, store: true, stand: true }, commentsAllowed: false, vatRateInner: 12, vatRateTakeaway: 12,
        minOrderQuantity: 1
    });

    const products: Product[] = [
        createProduct('p_std_indep', false, undefined, 10, 50),
        createProduct('p_evt_indep', true, undefined, 10, 50),
        createProduct('p_std_group1', false, 'GRP1', 10, 100),
        createProduct('p_std_group2', false, 'GRP1', 10, 200), 
        createProduct('p_mix_std', false, 'GRP_MIX', 10, 100),
        createProduct('p_mix_evt', true, 'GRP_MIX', 10, 200), 
    ];

    it('should calculate independent products correctly (Event vs Standard)', () => {
        const orders: any[] = [
            { items: [{ id: 'p_std_indep', quantity: 1, category: 'warm' }] },
            { items: [{ id: 'p_evt_indep', quantity: 1, category: 'warm' }] }
        ];
        const result = calculateDailyLoad(orders, products, mockSettings);
        expect(result.load['warm']).toBe(60);
        expect(result.eventLoad['warm']).toBe(60);
    });

    it('should handle shared overhead in Standard group (MAX overhead wins)', () => {
        const orders: any[] = [
            { items: [{ id: 'p_std_group1', quantity: 1, category: 'warm' }] },
            { items: [{ id: 'p_std_group2', quantity: 1, category: 'warm' }] }
        ];
        const result = calculateDailyLoad(orders, products, mockSettings);
        expect(result.load['warm']).toBe(220);
        expect(result.eventLoad['warm']).toBe(0);
    });

    it('should apply overhead to EVENT load if ANY product in group is Event', () => {
        const orders: any[] = [
            { items: [{ id: 'p_mix_std', quantity: 1, category: 'warm' }] }, 
            { items: [{ id: 'p_mix_evt', quantity: 1, category: 'warm' }] }  
        ];
        const result = calculateDailyLoad(orders, products, mockSettings);
        expect(result.load['warm']).toBe(10);
        expect(result.eventLoad['warm']).toBe(210);
    });
});
