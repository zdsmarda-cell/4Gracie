export type DataSourceMode = 'local' | 'api';

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
  phone: string;
  ic?: string;
  dic?: string;
  type?: 'billing' | 'delivery';
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
  deliveryTimeStart?: string;
  deliveryTimeEnd?: string;
  exceptions?: RegionException[];
}

export interface OpeningHoursDay {
  isOpen: boolean;
  start: string;
  end: string;
}

export interface PickupLocation {
  id: string;
  name: string;
  street: string;
  city: string;
  zip: string;
  enabled: boolean;
  openingHours: { [key: number]: OpeningHoursDay };
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
  applicableCategories?: string[];
  isEventOnly?: boolean;
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
  translations?: Translations;
}

export interface Subcategory {
  id: string;
  name: string;
  order: number;
  enabled: boolean;
}

export interface Translations {
  en?: Record<string, string>;
  de?: Record<string, string>;
  [key: string]: any;
}

export interface Category {
  id: string;
  name: string;
  order: number;
  enabled: boolean;
  subcategories?: (Subcategory | string)[]; // string for legacy support
  translations?: Translations;
}

export interface CapacityCategory {
  id: string;
  name: string;
  translations?: Translations;
}

export interface ProductIngredient {
  ingredientId: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: 'ks' | 'kg';
  category: string;
  subcategory?: string;
  images: string[];
  allergens: number[];
  leadTimeDays: number;
  shelfLifeDays: number;
  workload: number;
  workloadOverhead: number;
  capacityCategoryId?: string;
  volume: number;
  minOrderQuantity: number;
  visibility: {
    online: boolean;
    store: boolean;
    stand: boolean;
  };
  commentsAllowed?: boolean;
  vatRateInner: number;
  vatRateTakeaway: number;
  isEventProduct?: boolean;
  noPackaging?: boolean;
  composition?: ProductIngredient[];
  translations?: Translations;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  imageUrl?: string;
  isHidden?: boolean;
  full_json?: any;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'customer' | 'admin' | 'driver';
  billingAddresses: Address[];
  deliveryAddresses: Address[];
  isBlocked?: boolean;
  passwordHash?: string;
  marketingConsent?: boolean;
  hasPushSubscription?: boolean;
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
  
  // Structured Address Data
  deliveryName?: string;
  deliveryStreet?: string;
  deliveryCity?: string;
  deliveryZip?: string;
  deliveryPhone?: string;
  
  billingName?: string;
  billingStreet?: string;
  billingCity?: string;
  billingZip?: string;
  billingIc?: string;
  billingDic?: string;

  // Legacy blob address (kept for compatibility)
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
  deliveryCompanyDetailsSnapshot?: CompanyDetails;
  language: Language;
  pickupLocationId?: string;
  
  finalInvoiceDate?: string;
}

export type CategoryCapacities = Record<string, number>;

export interface PaymentMethodConfig {
  id: PaymentMethod;
  label: string;
  description: string;
  enabled: boolean;
  translations?: Translations;
}

export interface DayConfig {
  date: string;
  isOpen: boolean;
  capacityOverrides?: Partial<CategoryCapacities>;
}

export interface EventSlot {
  date: string;
  capacityOverrides?: Partial<CategoryCapacities>;
}

export interface LogisticsSettings {
  stopTimeMinutes: number;
  loadingSecondsPerItem: number;
  unloadingPaidSeconds: number;
  unloadingUnpaidSeconds: number;
}

export interface ServerSettings {
  consoleLogging: boolean;
}

export interface GlobalSettings {
  categories: Category[];
  capacityCategories?: CapacityCategory[];
  defaultCapacities: CategoryCapacities;
  eventSlots?: EventSlot[];
  companyDetails: CompanyDetails;
  paymentMethods: PaymentMethodConfig[];
  deliveryRegions: DeliveryRegion[];
  pickupLocations: PickupLocation[];
  packaging: {
    types: PackagingType[];
    freeFrom: number;
  };
  logistics?: LogisticsSettings;
  enabledLanguages?: Language[];
  enableAiTranslation?: boolean;
  sqlDebug?: boolean;
  server?: ServerSettings;
}

export interface BackupData {
  users?: User[];
  orders?: Order[];
  products?: Product[];
  discountCodes?: DiscountCode[];
  dayConfigs?: DayConfig[];
  settings?: GlobalSettings;
  rides?: Ride[];
  ingredients?: Ingredient[];
}

export interface RideStep {
  orderId: string;
  type: 'pickup' | 'delivery';
  address: string;
  arrivalTime: string;
  departureTime: string;
  distanceKm?: number;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  isPaid?: boolean;
  itemsCount?: number;
  error?: string;
}

export interface Ride {
  id: string;
  date: string;
  driverId: string;
  status: 'planned' | 'active' | 'completed';
  departureTime: string;
  orderIds: string[];
  steps?: RideStep[];
}

export interface EmailLog {
  id: number;
  type: string;
  recipient_email: string;
  subject: string;
  status: 'pending' | 'processing' | 'sent' | 'error';
  error_message?: string;
  created_at: string;
  processed_at?: string;
  payload: any;
}

export interface CookieSettings {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

export interface OrdersSearchResult {
  orders: Order[];
  total: number;
  page: number;
  pages: number;
}