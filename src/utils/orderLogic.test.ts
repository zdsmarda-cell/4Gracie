
import { describe, it, expect } from 'vitest';
import { calculatePackagingFeeLogic, calculateDiscountAmountLogic, calculateDailyLoad, getAvailableEventDatesLogic } from './orderLogic';
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

describe('Event Product Availability (getAvailableEventDatesLogic)', () => {
    const mockSettings: GlobalSettings = {
        ...DEFAULT_SETTINGS,
        categories: [{ id: 'warm', name: 'Teplý', order: 1, enabled: true }],
        eventSlots: [
            { date: '2025-01-10', capacityOverrides: { 'warm': 100 } }, // Valid Slot
            { date: '2025-01-11', capacityOverrides: { 'warm': 10 } },  // Low Capacity Slot
            { date: '2025-01-01', capacityOverrides: { 'warm': 100 } }  // Past Slot
        ]
    };

    const products: Product[] = [
        {
            id: 'evt_prod',
            name: 'Event Product',
            category: 'warm',
            isEventProduct: true,
            workload: 10,
            workloadOverhead: 5,
            leadTimeDays: 2,
            minOrderQuantity: 1,
            description: '', price: 100, unit: 'ks', images: [], allergens: [], shelfLifeDays: 1, volume: 0,
            visibility: { online: true, store: true, stand: true }, commentsAllowed: false, vatRateInner: 12, vatRateTakeaway: 12
        }
    ];

    // Mock Date: 2025-01-05
    const today = new Date('2025-01-05T10:00:00Z');

    it('should return future event dates where capacity is sufficient', () => {
        // No orders yet
        const dates = getAvailableEventDatesLogic(products[0], mockSettings, [], products, today);
        
        // 2025-01-01 is past (Lead time 2 days -> min date 2025-01-07)
        // 2025-01-10 is valid
        // 2025-01-11 is valid (Capacity 10 >= 10+5? No, wait. 10 workload + 5 overhead = 15 required. Limit 10. So it should fail!)
        
        // Wait, logic says: (currentLoad + productWorkload + productOverhead) <= limit
        // Slot 11: 0 + 10 + 5 = 15. Limit 10. Should fail.
        
        expect(dates).toContain('2025-01-10');
        expect(dates).not.toContain('2025-01-11');
        expect(dates).not.toContain('2025-01-01');
    });

    it('should exclude dates where orders fill the capacity', () => {
        // Create an order that fills the 2025-01-10 slot
        // Limit 100.
        // Existing Order: 90 workload.
        // New Product needs 15.
        // 90 + 15 = 105 > 100. Should be excluded.
        
        const existingOrder: any = {
            id: 'o1',
            deliveryDate: '2025-01-10',
            status: 'confirmed',
            items: [{ id: 'evt_prod', quantity: 9, category: 'warm' }] // 9 * 10 = 90 workload. + 5 overhead = 95 total used.
        };

        // Recalculate usage:
        // Item: 9 qty * 10 workload = 90.
        // Overhead: 5.
        // Total Used: 95.
        // Remaining: 5.
        // Needed for new: 10 + 5 = 15.
        // 95 + 15 = 110 > 100. Fail.

        const dates = getAvailableEventDatesLogic(products[0], mockSettings, [existingOrder], products, today);
        expect(dates).not.toContain('2025-01-10');
    });

    it('should respect lead time', () => {
        const p = { ...products[0], leadTimeDays: 10 }; // Min date = Jan 15
        const dates = getAvailableEventDatesLogic(p, mockSettings, [], products, today);
        expect(dates).toHaveLength(0); // 10th and 11th are too soon
    });
});
