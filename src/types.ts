
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

// Support for translations in data objects
export interface LocalizedContent {
  [key: string]: string | undefined; 
}

export interface Translations {
  en?: LocalizedContent;
  de?: LocalizedContent;
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
  translations?: Translations; // Added translations
}

export interface OpeningHoursDay {
  isOpen: boolean;
  start: string; // HH:MM
  end: string;   // HH:MM
}

export interface PickupLocation {
  id: string;
  name: string;
  street: string;
  city: string;
  zip: string;
  enabled: boolean;
  openingHours: { [key: number]: OpeningHoursDay }; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  exceptions?: RegionException[];
  translations?: Translations; // Added translations
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
  applicableCategories?: string[]; 
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
  translations?: Translations; // Added translations
}

export interface Category {
  id: string; // slug, e.g. 'warm', 'burgers'
  name: string; // Display name
  order: number;
  enabled: boolean;
  translations?: Translations; // Added translations
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: 'ks' | 'kg';
  category: string; 
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
  translations?: Translations; // Added translations
}

export interface CartItem extends Product {
  quantity: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string; // NEW FIELD
  role: 'customer' | 'admin' | 'driver';
  billingAddresses: Address[];
  deliveryAddresses: Address[];
  isBlocked?: boolean;
  passwordHash?: string;
  marketingConsent?: boolean;
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
  pickupLocationId?: string; 
}

export type CategoryCapacities = Record<string, number>; 

export interface PaymentMethodConfig {
  id: PaymentMethod;
  label: string;
  description: string;
  enabled: boolean;
  translations?: Translations; // Added translations
}

export interface DayConfig {
  date: string;
  isOpen: boolean;
  capacityOverrides?: Partial<CategoryCapacities>;
}

export interface GlobalSettings {
  categories: Category[]; 
  defaultCapacities: CategoryCapacities;
  companyDetails: CompanyDetails;
  paymentMethods: PaymentMethodConfig[];
  deliveryRegions: DeliveryRegion[];
  pickupLocations: PickupLocation[]; 
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
