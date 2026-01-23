
import { describe, it, expect } from 'vitest';
import { getAvailableEventDatesLogic, calculateDiscountAmountLogic } from './orderLogic';
import { Product, GlobalSettings, Order, OrderStatus, DiscountCode, DiscountType, CartItem } from '../types';

describe('Event Logic', () => {
    // Mock Data
    const today = '2025-01-20';
    const settings: GlobalSettings = {
        eventSlots: [
            { date: '2025-01-25', capacityOverrides: { 'cat1': 10 } },
            { date: '2025-01-26', capacityOverrides: { 'cat1': 0 } } // Full/Closed
        ],
        categories: [], defaultCapacities: {}, companyDetails: {} as any, paymentMethods: [], deliveryRegions: [], pickupLocations: [], packaging: { types: [], freeFrom: 0 }
    };
    const product: Product = {
        id: 'p1', name: 'Event Prod', description: 'Test Description', category: 'cat1', isEventProduct: true, leadTimeDays: 2,
        price: 100, unit: 'ks', images: [], allergens: [], shelfLifeDays: 1, workload: 1, workloadOverhead: 0, volume: 0, 
        minOrderQuantity: 1, visibility: {online:true, store:true, stand:true}, commentsAllowed: false, vatRateInner: 12, vatRateTakeaway: 12
    };
    const orders: Order[] = []; // Empty orders = full capacity

    it('should return available dates based on lead time and capacity', () => {
        // Lead time 2 days -> Earliest 2025-01-22.
        // Slots: 25 (Open), 26 (Closed)
        // Should return [2025-01-25]
        
        const dates = getAvailableEventDatesLogic(product, settings, orders, [product], today);
        expect(dates).toEqual(['2025-01-25']);
    });

    it('should exclude dates with 0 capacity or overloaded', () => {
        const existingProduct = { ...product, id: 'p2' };
        // Simulate load if needed, but here 0 capacity slot is tested directly
        // Ensure all products are passed so p1 is recognized
        const dates = getAvailableEventDatesLogic(product, settings, orders, [product, existingProduct], today);
        expect(dates).toEqual(['2025-01-25']);
    });
});

describe('Discount Logic - Event Only', () => {
    const orders: Order[] = []; // No previous orders needed for this test
    const discountCode: DiscountCode = {
        id: '1', code: 'EVENT50', type: DiscountType.PERCENTAGE, value: 50,
        validFrom: '', validTo: '', minOrderValue: 0, isStackable: false, 
        maxUsage: 0, usageCount: 0, totalSaved: 0, enabled: true,
        isEventOnly: true // TARGET FEATURE
    };

    const stdItem: CartItem = { 
        id: 'std', name: 'Standard', description: 'Standard Item', price: 100, quantity: 1, 
        category: 'warm', unit: 'ks', images: [], allergens: [], leadTimeDays: 1, shelfLifeDays: 1, volume: 0, 
        visibility: {online:true, store:true, stand:true}, commentsAllowed: false, vatRateInner: 12, vatRateTakeaway: 12,
        isEventProduct: false, workload: 10, workloadOverhead: 5, minOrderQuantity: 1
    };

    const evtItem: CartItem = { 
        ...stdItem, id: 'evt', name: 'Event Item', 
        isEventProduct: true 
    };

    it('should fail if cart has no event items', () => {
        const cart = [stdItem];
        const res = calculateDiscountAmountLogic(discountCode.code, cart, [discountCode], orders);
        expect(res.success).toBe(false);
        expect(res.error).toContain('akční zboží');
    });

    it('should apply discount ONLY to event items in mixed cart', () => {
        // Cart total: 100 (std) + 100 (evt) = 200
        // Discount 50% on Event Only -> 50% of 100 = 50.
        // Wrong result would be 50% of 200 = 100.
        const cart = [stdItem, evtItem];
        const res = calculateDiscountAmountLogic(discountCode.code, cart, [discountCode], orders);
        
        expect(res.success).toBe(true);
        expect(res.amount).toBe(50);
    });

    it('should pass if cart has event items only', () => {
        const cart = [evtItem];
        const res = calculateDiscountAmountLogic(discountCode.code, cart, [discountCode], orders);
        expect(res.success).toBe(true);
        expect(res.amount).toBe(50);
    });
});
