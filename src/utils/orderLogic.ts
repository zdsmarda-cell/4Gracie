
import { CartItem, PackagingType, DiscountCode, DiscountType, OrderStatus, Order, Product, GlobalSettings, ProductCategory, EventSlot, DayConfig } from '../types';

export const calculatePackagingFeeLogic = (
    items: CartItem[], 
    packagingTypes: PackagingType[], 
    freeFromLimit: number
): number => {
    const totalVolume = items.reduce((sum, item) => {
        if (item.noPackaging) return sum; 
        return sum + (item.volume || 0) * item.quantity;
    }, 0);

    const cartPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    if (cartPrice >= freeFromLimit) return 0;
    
    if (totalVolume === 0) return 0;

    const availableTypes = [...packagingTypes].sort((a, b) => a.volume - b.volume);
    if (availableTypes.length === 0) return 0;
    
    const largestBox = availableTypes[availableTypes.length - 1];
    let remainingVolume = totalVolume;
    let totalFee = 0;
    
    while (remainingVolume > 0) {
      if (remainingVolume > largestBox.volume) { 
          totalFee += largestBox.price; 
          remainingVolume -= largestBox.volume; 
      } else {
        const bestFit = availableTypes.find(type => type.volume >= remainingVolume);
        if (bestFit) { 
            totalFee += bestFit.price; 
            remainingVolume = 0; 
        } else { 
            totalFee += largestBox.price; 
            remainingVolume -= largestBox.volume; 
        }
      }
    }
    return totalFee;
};

interface ValidateDiscountResult {
  success: boolean;
  discount?: DiscountCode;
  amount?: number;
  error?: string;
}

export const calculateDiscountAmountLogic = (
    code: string, 
    currentCart: CartItem[],
    discountCodes: DiscountCode[],
    allOrders: Order[]
): ValidateDiscountResult => {
    const dc = discountCodes.find(d => d.code.toUpperCase() === code.toUpperCase());
    
    if (!dc) return { success: false, error: 'Neplatný kód' };
    if (!dc.enabled) return { success: false, error: 'Neplatný kód' }; 
    
    const actualUsage = allOrders.filter(o => o.status !== OrderStatus.CANCELLED && o.appliedDiscounts?.some(ad => ad.code === dc.code)).length;
    if (dc.maxUsage > 0 && actualUsage >= dc.maxUsage) return { success: false, error: 'Kód již byl vyčerpán' };
    
    const now = new Date().toISOString().split('T')[0];
    if (dc.validFrom && now < dc.validFrom) return { success: false, error: 'Kód ještě není platný' };
    if (dc.validTo && now > dc.validTo) return { success: false, error: 'Platnost kódu vypršela' };
    
    const cartTotal = currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const applicableItems = dc.applicableCategories && dc.applicableCategories.length > 0 
        ? currentCart.filter(item => dc.applicableCategories!.includes(item.category)) 
        : currentCart;
        
    const applicableTotal = applicableItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (dc.applicableCategories && dc.applicableCategories.length > 0 && applicableTotal === 0) 
        return { success: false, error: 'Sleva se nevztahuje na položky v košíku.' };
    
    const valueToCheck = (dc.applicableCategories && dc.applicableCategories.length > 0) ? applicableTotal : cartTotal;
    
    if (valueToCheck < dc.minOrderValue) 
        return { success: false, error: `Minimální hodnota objednávky: ${dc.minOrderValue} Kč` };

    let calculatedAmount = 0;
    if (dc.type === DiscountType.PERCENTAGE) calculatedAmount = Math.floor(applicableTotal * (dc.value / 100));
    else calculatedAmount = Math.min(dc.value, applicableTotal);
    
    return { success: true, discount: dc, amount: calculatedAmount };
};

export interface DailyLoadResult {
    load: Record<string, number>;
    eventLoad: Record<string, number>;
    usedProductIds: Set<string>;
}

export const calculateDailyLoad = (
    orders: Order[],
    products: Product[],
    settings: GlobalSettings
): DailyLoadResult => {
    const load: Record<string, number> = {};      
    const eventLoad: Record<string, number> = {}; 
    
    const allCategories = new Set([...settings.categories.map(c => c.id), ...Object.values(ProductCategory)]);
    allCategories.forEach(c => {
        load[c] = 0;
        eventLoad[c] = 0;
    });
    
    const usedProductIds = new Set<string>(); 
    const ccGroups = new Map<string, { maxOverhead: number, maxOverheadCategory: string, hasEvent: boolean }>();

    orders.forEach(order => {
        if (!order.items) return;

        order.items.forEach(item => {
            const productDef = products.find(p => String(p.id) === String(item.id));
            
            const workload = Number(productDef?.workload) || Number(item.workload) || 0;
            const quantity = item.quantity || 0;
            const overhead = Number(productDef?.workloadOverhead) || Number(item.workloadOverhead) || 0;
            
            const cat = item.category || productDef?.category || 'unknown';
            const isEvent = !!productDef?.isEventProduct;
            const capCatId = productDef?.capacityCategoryId;

            if (isEvent) {
                eventLoad[cat] = (eventLoad[cat] || 0) + (workload * quantity);
            } else {
                load[cat] = (load[cat] || 0) + (workload * quantity);
            }

            if (capCatId) {
                const group = ccGroups.get(capCatId) || { maxOverhead: 0, maxOverheadCategory: cat, hasEvent: false };
                if (overhead > group.maxOverhead) {
                    group.maxOverhead = overhead;
                    group.maxOverheadCategory = cat; 
                }
                if (isEvent) {
                    group.hasEvent = true; 
                }
                ccGroups.set(capCatId, group);
            } else {
                if (!usedProductIds.has(String(item.id))) {
                    if (isEvent) {
                        eventLoad[cat] = (eventLoad[cat] || 0) + overhead;
                    } else {
                        load[cat] = (load[cat] || 0) + overhead;
                    }
                    usedProductIds.add(String(item.id));
                }
            }
        });
    });

    ccGroups.forEach((group) => {
        const targetMap = group.hasEvent ? eventLoad : load;
        const cat = group.maxOverheadCategory;
        targetMap[cat] = (targetMap[cat] || 0) + group.maxOverhead;
    });

    return { load, eventLoad, usedProductIds };
};

/**
 * Calculates available dates for a specific Event Product.
 * Returns valid dates ONLY if:
 * 1. Date is in the future (respecting lead time)
 * 2. Date is a valid Event Slot
 * 3. Adding the Minimum Order Quantity of this product does NOT exceed the Event Capacity for that slot.
 */
export const getAvailableEventDatesLogic = (
    product: Product,
    settings: GlobalSettings,
    orders: Order[],
    allProducts: Product[],
    todayDate: Date = new Date() // Allow injecting today for testing
): string[] => {
    if (!product.isEventProduct) return [];
    
    const slots = settings.eventSlots || [];
    
    // Normalize today to start of day
    const today = new Date(todayDate);
    today.setHours(0,0,0,0);
    
    const leadTime = product.leadTimeDays || 0;
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() + leadTime);

    return slots
      .filter(s => {
          // 1. Date Check (Future & Lead Time)
          const slotDate = new Date(s.date);
          slotDate.setHours(0,0,0,0);
          if (slotDate < minDate) return false;

          // 2. Capacity Check
          const catId = product.category;
          const limit = s.capacityOverrides?.[catId] ?? 0;
          
          // If limit is 0, category is closed for this event
          if (limit <= 0) return false;

          // Get current load for this specific date
          const relevantOrders = orders.filter(o => o.deliveryDate === s.date && o.status !== OrderStatus.CANCELLED);
          const { eventLoad } = calculateDailyLoad(relevantOrders, allProducts, settings);
          
          const currentLoad = eventLoad[catId] || 0;
          
          // Calculate potential impact of this product (Min Order Qty)
          // We must also account for Overhead if it's not already "paid" for by other items in the same group?
          // For simplicity in "Can I order?", we assume worst case: full workload + full overhead 
          // (unless sophisticated logic checks if overhead is shared with existing load, which is hard without cart context).
          // Here we check: Workload * MinQty. Overhead is harder to predict without cart context, so we check Variable Load primarily.
          
          const minQty = product.minOrderQuantity || 1;
          const productWorkload = (product.workload || 0) * minQty;
          
          // Note: Ideally we should also check overhead, but overhead depends on what's already in the cart or order.
          // For "Menu Display" logic, checking variable workload fit is usually sufficient proxy.
          // If strict: Add overhead.
          const productOverhead = product.workloadOverhead || 0;

          // Simplified check: Does (Current + New Variable + New Overhead) <= Limit?
          // This is conservative. It might return false if overhead is actually shared, but safe.
          return (currentLoad + productWorkload + productOverhead) <= limit;
      })
      .map(s => s.date)
      .sort();
};
