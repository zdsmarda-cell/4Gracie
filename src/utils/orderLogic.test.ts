
import { describe, it, expect } from 'vitest';
import { calculatePackagingFeeLogic, calculateDiscountAmountLogic } from './orderLogic';
import { PackagingType, CartItem, DiscountCode, DiscountType, Order } from '../types';

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
        // Need 1200ml volume. Should take 1 Big (1000) + 1 Small (500) = 30 CZK
        // Or 2 Big? Algorithm takes largest first.
        // 1200 > 1000 (Big - 20kc) -> Rem: 200.
        // 200 fits in Small (10kc). Total 30kc.
        const items: any[] = [{ price: 100, quantity: 1, volume: 1200 }];
        const fee = calculatePackagingFeeLogic(items, boxes, 5000);
        expect(fee).toBe(30);
    });

    it('should ignore items with noPackaging attribute', () => {
        const items: any[] = [
            { price: 100, quantity: 1, volume: 1200 }, // Should cost 30kc
            { price: 100, quantity: 5, volume: 1000, noPackaging: true } // Should be ignored (5000ml ignored)
        ];
        const fee = calculatePackagingFeeLogic(items, boxes, 50000); // High free limit so logic applies
        expect(fee).toBe(30);
    });
});

describe('Discount Logic', () => {
    const codes: DiscountCode[] = [
        { id: '1', code: 'TEST10', type: DiscountType.PERCENTAGE, value: 10, enabled: true, minOrderValue: 0, maxUsage: 0, usageCount: 0, totalSaved: 0, validFrom: '', validTo: '', isStackable: false, applicableCategories: [] },
        { id: '2', code: 'FIX100', type: DiscountType.FIXED, value: 100, enabled: true, minOrderValue: 200, maxUsage: 0, usageCount: 0, totalSaved: 0, validFrom: '', validTo: '', isStackable: false, applicableCategories: [] }
    ];
    const cart: any[] = [{ price: 100, quantity: 5, category: 'food' }]; // Total 500

    it('should calculate percentage discount', () => {
        const res = calculateDiscountAmountLogic('TEST10', cart, codes, []);
        expect(res.success).toBe(true);
        expect(res.amount).toBe(50); // 10% of 500
    });

    it('should fail if min order value not met', () => {
        const smallCart: any[] = [{ price: 10, quantity: 1, category: 'food' }];
        const res = calculateDiscountAmountLogic('FIX100', smallCart, codes, []);
        expect(res.success).toBe(false);
    });
});
