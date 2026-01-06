
import { describe, it, expect } from 'vitest';
import { calculatePackagingFeeLogic, calculateDiscountAmountLogic, calculateDailyLoad } from './orderLogic';
import { PackagingType, CartItem, DiscountCode, DiscountType, Order, OrderStatus, Product, ProductCategory, GlobalSettings } from '../types';
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

describe('Capacity & Load Logic (calculateDailyLoad)', () => {
    // Setup Mock Data
    const mockSettings: GlobalSettings = {
        ...DEFAULT_SETTINGS,
        categories: [
            { id: 'warm', name: 'Teplý', order: 1, enabled: true }
        ]
    };

    // Helper to create product
    const createProduct = (id: string, isEvent: boolean, capCat?: string, workload = 10, overhead = 100): Product => ({
        id,
        name: `Prod ${id}`,
        category: 'warm',
        isEventProduct: isEvent,
        capacityCategoryId: capCat,
        workload,
        workloadOverhead: overhead,
        description: '', price: 100, unit: 'ks', images: [], allergens: [], leadTimeDays: 1, shelfLifeDays: 1, volume: 0,
        visibility: { online: true, store: true, stand: true }, commentsAllowed: false, vatRateInner: 12, vatRateTakeaway: 12
    });

    const products: Product[] = [
        createProduct('p_std_indep', false, undefined, 10, 50),
        createProduct('p_evt_indep', true, undefined, 10, 50),
        
        createProduct('p_std_group1', false, 'GRP1', 10, 100),
        createProduct('p_std_group2', false, 'GRP1', 10, 200), // Higher overhead in same group
        
        createProduct('p_mix_std', false, 'GRP_MIX', 10, 100),
        createProduct('p_mix_evt', true, 'GRP_MIX', 10, 200), // Event product in same group
    ];

    it('should calculate independent products correctly (Event vs Standard)', () => {
        const orders: any[] = [
            { items: [{ id: 'p_std_indep', quantity: 1, category: 'warm' }] },
            { items: [{ id: 'p_evt_indep', quantity: 1, category: 'warm' }] }
        ];

        const result = calculateDailyLoad(orders, products, mockSettings);

        // Standard: 10 (workload) + 50 (overhead) = 60
        expect(result.load['warm']).toBe(60);
        
        // Event: 10 (workload) + 50 (overhead) = 60
        expect(result.eventLoad['warm']).toBe(60);
    });

    it('should handle shared overhead in Standard group (MAX overhead wins)', () => {
        const orders: any[] = [
            { items: [{ id: 'p_std_group1', quantity: 1, category: 'warm' }] },
            { items: [{ id: 'p_std_group2', quantity: 1, category: 'warm' }] }
        ];

        const result = calculateDailyLoad(orders, products, mockSettings);

        // Variable Workload: 10 (p1) + 10 (p2) = 20
        // Overhead: MAX(100, 200) = 200 (Single charge for the group per day)
        // Total Standard: 220
        expect(result.load['warm']).toBe(220);
        expect(result.eventLoad['warm']).toBe(0);
    });

    it('should apply overhead to EVENT load if ANY product in group is Event', () => {
        const orders: any[] = [
            { items: [{ id: 'p_mix_std', quantity: 1, category: 'warm' }] }, // Standard Item
            { items: [{ id: 'p_mix_evt', quantity: 1, category: 'warm' }] }  // Event Item
        ];

        const result = calculateDailyLoad(orders, products, mockSettings);

        // Variable Workload:
        // Standard: 10
        // Event: 10
        
        // Overhead: 
        // Group GRP_MIX has max overhead 200.
        // Since it contains an Event product, overhead goes to Event Load.
        
        // Total Standard: 10
        expect(result.load['warm']).toBe(10);
        
        // Total Event: 10 (variable) + 200 (overhead) = 210
        expect(result.eventLoad['warm']).toBe(210);
    });
});
