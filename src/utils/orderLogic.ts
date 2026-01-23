import { CartItem, Product, GlobalSettings, Order, OrderStatus, DiscountCode, DiscountType, PackagingType } from '../types';

export const calculateDiscountAmountLogic = (
    code: string, 
    currentCart: CartItem[], 
    discountCodes: DiscountCode[], 
    orders: Order[]
): { success: boolean, discount?: DiscountCode, amount?: number, error?: string } => {
    
    const dc = discountCodes.find(d => d.code.toUpperCase() === code.toUpperCase());
    if (!dc) return { success: false, error: 'Neplatný kód.' };
    if (!dc.enabled) return { success: false, error: 'Tento kód je již neaktivní.' };
    
    const actualUsage = orders.filter(o => o.status !== OrderStatus.CANCELLED && o.appliedDiscounts?.some(ad => ad.code === dc.code)).length;
    if (dc.maxUsage > 0 && actualUsage >= dc.maxUsage) return { success: false, error: 'Kód již byl vyčerpán.' };
    
    const now = new Date().toISOString().split('T')[0];
    if (dc.validFrom && now < dc.validFrom) return { success: false, error: 'Kód ještě není platný.' };
    if (dc.validTo && now > dc.validTo) return { success: false, error: 'Platnost kódu vypršela.' };
    
    const cartTotal = currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    let applicableItems = dc.applicableCategories && dc.applicableCategories.length > 0 
        ? currentCart.filter(item => dc.applicableCategories!.includes(item.category)) 
        : currentCart;

    if (dc.isEventOnly) {
        applicableItems = applicableItems.filter(item => item.isEventProduct);
        
        if (applicableItems.length === 0) {
            return { success: false, error: 'Kód platí pouze pro akční zboží.' };
        }
    }
        
    const applicableTotal = applicableItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (applicableTotal === 0) {
        if (dc.applicableCategories && dc.applicableCategories.length > 0) {
             return { success: false, error: 'Sleva se nevztahuje na položky v košíku.' };
        }
        return { success: false, error: 'Nelze uplatnit na položky v košíku.' };
    }
    
    const valueToCheck = ((dc.applicableCategories && dc.applicableCategories.length > 0) || dc.isEventOnly) 
        ? applicableTotal 
        : cartTotal;
    
    if (valueToCheck < dc.minOrderValue) 
        return { success: false, error: `Minimální hodnota relevantního zboží: ${dc.minOrderValue} Kč` };

    let calculatedAmount = 0;
    if (dc.type === DiscountType.PERCENTAGE) calculatedAmount = Math.floor(applicableTotal * (dc.value / 100));
    else calculatedAmount = Math.min(dc.value, applicableTotal);
    
    return { success: true, discount: dc, amount: calculatedAmount };
};

export const calculatePackagingFeeLogic = (items: CartItem[], packagingTypes: PackagingType[], freeFrom: number): number => {
    const chargeableItems = items.filter(item => !item.noPackaging);
    
    const totalVolume = chargeableItems.reduce((sum, item) => sum + (item.volume || 0) * item.quantity, 0);
    const cartPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    if (cartPrice >= freeFrom) return 0;
    
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

export interface DailyLoadResult {
    load: Record<string, number>;
    eventLoad: Record<string, number>;
}

export const calculateDailyLoad = (orders: Order[], products: Product[], settings: GlobalSettings): DailyLoadResult => {
    const load: Record<string, number> = {};
    const eventLoad: Record<string, number> = {};
    
    (settings.categories || []).forEach(cat => {
        load[cat.id] = 0;
        eventLoad[cat.id] = 0;
    });

    const usedProductIds = new Set<string>();

    orders.forEach(order => {
        if (!order.items) return;
        order.items.forEach(item => {
            const productDef = products.find(p => String(p.id) === String(item.id));
            const itemWorkload = Number(productDef?.workload) || Number(item.workload) || 0;
            const itemOverhead = Number(productDef?.workloadOverhead) || Number(item.workloadOverhead) || 0;
            const cat = item.category || productDef?.category;
            const isEvent = !!(item.isEventProduct || productDef?.isEventProduct);
            
            let overheadToAdd = 0;
            if (productDef?.capacityCategoryId) {
                const overheadKey = productDef.capacityCategoryId || String(item.id);
                if (!usedProductIds.has(overheadKey)) {
                    overheadToAdd = itemOverhead;
                    usedProductIds.add(overheadKey);
                }
            } else {
                if (!usedProductIds.has(String(item.id))) {
                    overheadToAdd = itemOverhead;
                    usedProductIds.add(String(item.id));
                }
            }

            if (cat) {
                if (isEvent) {
                    if (eventLoad[cat] === undefined) eventLoad[cat] = 0;
                    eventLoad[cat] += (itemWorkload * item.quantity) + overheadToAdd;
                } else {
                    if (load[cat] === undefined) load[cat] = 0;
                    load[cat] += (itemWorkload * item.quantity) + overheadToAdd;
                }
            }
        });
    });
    
    return { load, eventLoad };
};

export const getAvailableEventDatesLogic = (
    product: Product, 
    settings: GlobalSettings, 
    orders: Order[],
    products: Product[],
    todayDate?: string
): string[] => {
    if (!product.isEventProduct) return [];
    
    const today = todayDate ? new Date(todayDate) : new Date();
    today.setHours(0,0,0,0);
    
    const leadTime = product.leadTimeDays || 0;
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() + leadTime);
    const minDateStr = minDate.toISOString().split('T')[0];

    const validSlots = (settings.eventSlots || [])
        .filter(slot => slot.date >= minDateStr)
        .sort((a, b) => a.date.localeCompare(b.date));

    return validSlots.filter(slot => {
        const relevantOrders = orders.filter(o => 
            o.deliveryDate === slot.date && 
            o.status !== OrderStatus.CANCELLED &&
            o.status !== OrderStatus.DELIVERED &&
            o.status !== OrderStatus.NOT_PICKED_UP
        );
        
        const { eventLoad } = calculateDailyLoad(relevantOrders, products, settings);
        
        const catId = product.category;
        const limit = slot.capacityOverrides?.[catId] ?? 0;
        const currentLoad = eventLoad[catId] || 0;
        
        return limit > currentLoad;
    }).map(s => s.date);
};

export const calculatePackageCountLogic = (items: CartItem[], packagingTypes: PackagingType[]): number => {
    const itemsToPack = items.filter(i => !i.noPackaging);
    
    if (itemsToPack.length === 0) return 0;
    if (packagingTypes.length === 0) return 1;

    const totalVolume = itemsToPack.reduce((sum, item) => sum + (item.volume || 0) * item.quantity, 0);
    const sortedBoxes = [...packagingTypes].sort((a, b) => b.volume - a.volume);
    const largestBox = sortedBoxes[0];

    if (largestBox.volume <= 0) return 1;
    
    return Math.ceil(totalVolume / largestBox.volume) || 1;
};