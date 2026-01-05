
import { CartItem, PackagingType, DiscountCode, DiscountType, OrderStatus, Order } from '../types';

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
