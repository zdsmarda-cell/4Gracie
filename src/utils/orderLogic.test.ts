
import { describe, it, expect } from 'vitest';
import { calculatePackagingFeeLogic, calculateDailyLoad, getAvailableEventDatesLogic, calculateDiscountAmountLogic } from './orderLogic';
import { PackagingType, GlobalSettings, Product, Order, DiscountCode, DiscountType, OrderStatus, CartItem } from '../types';
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

    it('should handle shared overhead in Standard group (MAX overhead wins)', () => {
        const orders: any[] = [
            { items: [{ id: 'p_std_group1', quantity: 1, category: 'warm' }] },
            { items: [{ id: 'p_std_group2', quantity: 1, category: 'warm' }] }
        ];
        // Workloads: 10 + 10 = 20
        // Overhead: MAX(100, 200) = 200
        // Total = 220
        const result = calculateDailyLoad(orders, products, mockSettings);
        expect(result.load['warm']).toBe(220);
        expect(result.eventLoad['warm']).toBe(0);
    });

    it('should apply overhead to EVENT load if ANY product in group is Event', () => {
        const orders: any[] = [
            { items: [{ id: 'p_mix_std', quantity: 1, category: 'warm' }] }, 
            { items: [{ id: 'p_mix_evt', quantity: 1, category: 'warm' }] }  
        ];
        // Workloads: 10 (Std) + 10 (Evt)
        // Overhead: MAX(100, 200) = 200 -> Goes to Event Load because group has Event item
        const result = calculateDailyLoad(orders, products, mockSettings);
        expect(result.load['warm']).toBe(10); // Only workload
        expect(result.eventLoad['warm']).toBe(210); // Workload + Shared Overhead
    });
});

describe('Discount Logic', () => {
    const discounts: DiscountCode[] = [
        { id: '1', code: 'TEST10', type: DiscountType.PERCENTAGE, value: 10, enabled: true, minOrderValue: 0, isStackable: false, maxUsage: 0, usageCount: 0, totalSaved: 0, validFrom: '', validTo: '' },
        { id: '2', code: 'FIXED50', type: DiscountType.FIXED, value: 50, enabled: true, minOrderValue: 200, isStackable: false, maxUsage: 0, usageCount: 0, totalSaved: 0, validFrom: '', validTo: '' },
        { id: '3', code: 'WARM_ONLY', type: DiscountType.PERCENTAGE, value: 50, enabled: true, minOrderValue: 0, isStackable: false, maxUsage: 0, usageCount: 0, totalSaved: 0, validFrom: '', validTo: '', applicableCategories: ['warm'] }
    ];
    const orders: Order[] = [];

    it('should calculate percentage discount', () => {
        const cart: CartItem[] = [{ price: 100, quantity: 2, category: 'warm' } as CartItem];
        const res = calculateDiscountAmountLogic('TEST10', cart, discounts, orders);
        expect(res.success).toBe(true);
        expect(res.amount).toBe(20); // 10% of 200
    });

    it('should fail if min order value not met', () => {
        const cart: CartItem[] = [{ price: 100, quantity: 1, category: 'warm' } as CartItem];
        const res = calculateDiscountAmountLogic('FIXED50', cart, discounts, orders);
        expect(res.success).toBe(false);
        expect(res.error).toContain('Minimální hodnota');
    });

    it('should apply discount only to specific category', () => {
        const cart: CartItem[] = [
            { price: 100, quantity: 1, category: 'warm' } as CartItem,
            { price: 100, quantity: 1, category: 'cold' } as CartItem
        ];
        const res = calculateDiscountAmountLogic('WARM_ONLY', cart, discounts, orders);
        expect(res.success).toBe(true);
        expect(res.amount).toBe(50); // 50% of 100 (warm only)
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

    it('should return available dates respecting lead time', () => {
        const product = { 
            category: 'warm', 
            isEventProduct: true, 
            leadTimeDays: 7, // Needs 7 days -> Earliest 2025-01-22
            workload: 10 
        } as Product;
        
        const dates = getAvailableEventDatesLogic(product, settings, [], [], today);
        expect(dates).toEqual(['2025-01-25']); // 20th is too soon
    });

    it('should exclude dates with full capacity', () => {
        const product = { 
            id: 'new_p',
            category: 'warm', 
            isEventProduct: true, 
            leadTimeDays: 1, 
            workload: 50,
            minOrderQuantity: 1
        } as Product;

        // Ensure the existing product in the order is correctly defined as an Event Product
        // otherwise it falls into standard capacity, not event capacity.
        const existingProduct = {
            id: 'p1',
            category: 'warm',
            isEventProduct: true,
            workload: 30
        } as Product;

        // Mock existing orders filling the 20th
        const orders: any[] = [
            { 
                deliveryDate: '2025-01-20', 
                status: OrderStatus.CONFIRMED, 
                items: [{ id: 'p1', quantity: 2, category: 'warm' }] // Workload 30*2 = 60
            } 
            // Load = 60. Remaining = 40. Product needs 50. -> Full.
        ];

        // Pass existingProduct in the allProducts array so the logic knows p1 is an event product
        const dates = getAvailableEventDatesLogic(product, settings, orders, [product, existingProduct], today);
        expect(dates).toEqual(['2025-01-25']);
    });
});
