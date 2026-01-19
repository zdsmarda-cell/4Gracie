
import { describe, it, expect } from 'vitest';
import { calculatePackagingFeeLogic, calculateDailyLoad, getAvailableEventDatesLogic, calculateDiscountAmountLogic } from './orderLogic';
import { PackagingType, GlobalSettings, Product, Order, DiscountCode, DiscountType, OrderStatus, CartItem, ProductCategory } from '../types';
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
        // 1200 vol: > 1000 (Big, 20) -> 200 remain (Small, 10) -> Total 30
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
        expect(result.load['warm']).toBe(60); // 10 workload + 50 overhead
        expect(result.eventLoad['warm']).toBe(60); // 10 workload + 50 overhead
    });
});

describe('Event Dates Logic', () => {
    const settings: GlobalSettings = {
        ...DEFAULT_SETTINGS,
        eventSlots: [
            { date: '2025-01-20', capacityOverrides: { 'warm': 100 } },
            { date: '2025-01-25', capacityOverrides: { 'warm': 100 } }
        ]
    };
    
    // Mock today = 2025-01-15
    const today = new Date('2025-01-15');

    it('should exclude dates with full capacity', () => {
        const product = { 
            id: 'new_p',
            category: 'warm', 
            isEventProduct: true, 
            leadTimeDays: 1, 
            workload: 50,
            minOrderQuantity: 1
        } as Product;

        const existingProduct = {
            id: 'p1',
            category: 'warm',
            isEventProduct: true,
            workload: 50 // High workload to force limit breach
        } as Product;

        // Mock existing orders filling the 20th
        // Existing load: 2 items * 50 = 100.
        // Limit: 100.
        // Remaining: 0.
        // New Product needs 50.
        // Total 150 > 100 -> Should fail.
        const orders: any[] = [
            { 
                id: 'o1',
                deliveryDate: '2025-01-20', 
                status: OrderStatus.CONFIRMED, 
                items: [{ id: 'p1', quantity: 2, category: 'warm' }] 
            } 
        ];

        // Ensure all products are passed so p1 is recognized
        const dates = getAvailableEventDatesLogic(product, settings, orders, [product, existingProduct], today);
        expect(dates).toEqual(['2025-01-25']);
    });
});
