
import { CartItem, PackagingType, DiscountCode, DiscountType, OrderStatus, Order, Product, GlobalSettings, ProductCategory } from '../types';

export const calculatePackagingFeeLogic = (
    items: CartItem[], 
    packagingTypes: PackagingType[], 
    freeFromLimit: number
): number => {
    // Volume logic: Sum only items that REQUIRE packaging
    const totalVolume = items.reduce((sum, item) => {
        if (item.noPackaging) return sum; // Skip items marked as "Nebalí se"
        return sum + (item.volume || 0) * item.quantity;
    }, 0);

    const cartPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    // If cart total price exceeds limit, packaging is free regardless of volume
    if (cartPrice >= freeFromLimit) return 0;
    
    // If volume is 0 (e.g. only noPackaging items), fee is 0
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
    if (!dc.enabled) return { success: false, error: 'Neplatný kód' }; // Same generic error for user
    
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
    // Initialize loads
    const load: Record<string, number> = {};      // Standard Load
    const eventLoad: Record<string, number> = {}; // Event Load
    
    // Init keys based on settings categories + hardcoded enum to be safe
    const allCategories = new Set([...settings.categories.map(c => c.id), ...Object.values(ProductCategory)]);
    allCategories.forEach(c => {
        load[c] = 0;
        eventLoad[c] = 0;
    });
    
    // Global Trackers for the entire day
    // 1. Independent products: Counted once per ProductID per day
    // 2. Capacity Groups: Aggregated by Capacity Category ID (max overhead)
    const usedProductIds = new Set<string>(); 
    const ccGroups = new Map<string, { maxOverhead: number, maxOverheadCategory: string, hasEvent: boolean }>();

    // FIRST PASS: Aggregate Everything
    orders.forEach(order => {
        if (!order.items) return;

        order.items.forEach(item => {
            const productDef = products.find(p => String(p.id) === String(item.id));
            
            // Workload (Variable) - always add
            const workload = Number(productDef?.workload) || Number(item.workload) || 0;
            const quantity = item.quantity || 0;
            
            // Overhead (Fixed per day/group)
            const overhead = Number(productDef?.workloadOverhead) || Number(item.workloadOverhead) || 0;
            
            const cat = item.category || productDef?.category || 'unknown';
            const isEvent = !!productDef?.isEventProduct;
            const capCatId = productDef?.capacityCategoryId;

            // 1. Variable Workload
            if (isEvent) {
                eventLoad[cat] = (eventLoad[cat] || 0) + (workload * quantity);
            } else {
                load[cat] = (load[cat] || 0) + (workload * quantity);
            }

            // 2. Prepare Overhead Calculation (Global Scope)
            if (capCatId) {
                // Group Logic
                const group = ccGroups.get(capCatId) || { maxOverhead: 0, maxOverheadCategory: cat, hasEvent: false };
                if (overhead > group.maxOverhead) {
                    group.maxOverhead = overhead;
                    group.maxOverheadCategory = cat; // Attributed to the category of the item with max overhead
                }
                if (isEvent) {
                    group.hasEvent = true; // Mark group as containing event product
                }
                ccGroups.set(capCatId, group);
            } else {
                // Independent Product Logic
                // We assume independent products overheads are separated by standard vs event purely by the item type
                // But counted ONCE per day per product ID.
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

    // SECOND PASS: Distribute Capacity Group Overheads
    ccGroups.forEach((group) => {
        // RULE: If group contains ANY event product, the overhead goes to Event Capacity
        const targetMap = group.hasEvent ? eventLoad : load;
        const cat = group.maxOverheadCategory;
        targetMap[cat] = (targetMap[cat] || 0) + group.maxOverhead;
    });

    return { load, eventLoad, usedProductIds };
};
