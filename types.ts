
export enum Language {
  CS = 'cs',
  EN = 'en',
  DE = 'de'
}

export enum ProductCategory {
  WARM = 'warm',
  COLD = 'cold',
  DESSERT = 'dessert',
  DRINK = 'drink'
}

export enum OrderStatus {
  CREATED = 'created',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  ON_WAY = 'on_way',
  DELIVERED = 'delivered',
  NOT_PICKED_UP = 'not_picked_up',
  CANCELLED = 'cancelled'
}

export enum DeliveryType {
  PICKUP = 'pickup',
  DELIVERY = 'delivery'
}

export enum PaymentMethod {
  GATEWAY = 'gateway',
  QR = 'qr',
  CASH = 'cash'
}

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed'
}

export interface Address {
  id: string;
  name: string;
  street: string;
  city: string;
  zip: string;
  phone: string; // Added mandatory phone
  ic?: string;
  dic?: string;
}

export interface RegionException {
  date: string; // YYYY-MM-DD
  isOpen: boolean;
  deliveryTimeStart?: string;
  deliveryTimeEnd?: string;
}

export interface DeliveryRegion {
  id: string;
  name: string;
  zips: string[];
  price: number;
  freeFrom: number;
  enabled: boolean;
  deliveryTimeStart?: string; // Format HH:MM
  deliveryTimeEnd?: string;   // Format HH:MM
  exceptions?: RegionException[];
}

export interface DiscountCode {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  validFrom: string;
  validTo: string;
  minOrderValue: number;
  isStackable: boolean;
  maxUsage: number;
  usageCount: number;
  totalSaved: number;
  enabled: boolean;
  applicableCategories?: ProductCategory[];
}

export interface AppliedDiscount {
  code: string;
  amount: number;
}

export interface Allergen {
  id: number;
  code: string;
  name: string;
  }

export interface PackagingType {
  id: string;
  name: string;
  volume: number;
  price: number;
  enabled?: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: 'ks' | 'kg';
  category: ProductCategory;
  images: string[];
  allergens: number[];
  leadTimeDays: number;
  shelfLifeDays: number;
  workload: number;
  workloadOverhead?: number;
  volume: number;
  minOrderQuantity?: number;
  visibility: {
    online: boolean;
    store: boolean;
    stand: boolean;
  };
  commentsAllowed: boolean;
  vatRateInner: number;
  vatRateTakeaway: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin' | 'driver';
  billingAddresses: Address[];
  deliveryAddresses: Address[];
  isBlocked?: boolean;
  passwordHash?: string;
}

export interface OrderStatusHistory {
  status: OrderStatus;
  date: string;
}

export interface CompanyDetails {
  name: string;
  ic: string;
  dic: string;
  street: string;
  city: string;
  zip: string;
  email: string;
  phone: string;
  bankAccount: string;
  bic: string;
}

export interface Order {
  id: string;
  userId: string;
  userName?: string;
  items: CartItem[];
  totalPrice: number;
  packagingFee: number;
  deliveryFee: number;
  appliedDiscounts?: AppliedDiscount[];
  deliveryType: DeliveryType;
  deliveryDate: string;
  deliveryAddress?: string;
  billingAddress?: string;
  status: OrderStatus;
  statusHistory?: OrderStatusHistory[];
  isPaid: boolean;
  paymentMethod: PaymentMethod;
  createdAt: string;
  note?: string;
  invoiceUrl?: string;
  companyDetailsSnapshot?: CompanyDetails;
  language: Language;
}

export type CategoryCapacities = Record<ProductCategory, number>;

export interface PaymentMethodConfig {
  id: PaymentMethod;
  label: string;
  description: string;
  enabled: boolean;
}

export interface DayConfig {
  date: string;
  isOpen: boolean;
  capacityOverrides?: Partial<CategoryCapacities>;
}

export interface GlobalSettings {
  defaultCapacities: CategoryCapacities;
  companyDetails: CompanyDetails;
  paymentMethods: PaymentMethodConfig[];
  deliveryRegions: DeliveryRegion[];
  packaging: {
    types: PackagingType[];
    freeFrom: number;
  };
}

export interface BackupData {
  users?: User[];
  orders?: Order[];
  products?: Product[];
  discountCodes?: DiscountCode[];
  dayConfigs?: DayConfig[];
  settings?: GlobalSettings;
}
