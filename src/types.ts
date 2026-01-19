
export interface RideStep {
  orderId: string;
  type: 'pickup' | 'delivery';
  arrivalTime: string; // HH:MM
  departureTime: string; // HH:MM
  address: string;
  distanceKm?: number;
  note?: string;
  isPaid?: boolean;
  itemsCount?: number;
  customerName?: string;
  customerPhone?: string;
  error?: string; // NEW: Error message for invalid address
  
  // Frontend calculated breakdown for debugging
  breakdown?: {
    prevDeparture: string;
    travelTimeMinutes: number;
    baseStopMinutes: number;
    itemsMinutes: number;
    paymentMinutes: number;
    totalServiceMinutes: number;
    calcDeparture: string;
  };
}

export interface Ride {
  id: string;
  date: string;
  driverId: string;
  orderIds: string[];
  departureTime: string; // HH:MM
  status: 'planned' | 'active' | 'completed';
  steps?: RideStep[]; // Calculated route
}

export interface GlobalSettings {
  categories: Category[]; 
  capacityCategories: CapacityCategory[]; 
  defaultCapacities: CategoryCapacities;
  eventSlots: EventSlot[]; 
  companyDetails: CompanyDetails;
  paymentMethods: PaymentMethodConfig[];
  deliveryRegions: DeliveryRegion[];
  pickupLocations: PickupLocation[]; 
  packaging: {
    types: PackagingType[];
    freeFrom: number;
  };
  logistics: LogisticsSettings; // NEW FIELD
  enabledLanguages: Language[]; 
  enableAiTranslation: boolean;
  sqlDebug: boolean;
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
  ingredients?: Ingredient[]; // NEW
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

export type DataSourceMode = 'local' | 'api';

export interface ImportResult {
  success: boolean;
  collisions?: string[];
  message?: string;
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
    payload?: any; // Added payload for inspection
}

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
  phone: string; 
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
  translations?: Translations; 
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
  translations?: Translations; 
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
  translations?: Translations;
}

export interface Subcategory {
  id: string; // Slug/ID
  name: string;
  order: number;
  enabled: boolean;
}

export interface Category {
  id: string; // slug, e.g. 'warm', 'burgers'
  name: string; // Display name
  order: number;
  enabled: boolean;
  translations?: Translations;
  subcategories?: Subcategory[]; // CHANGED: Now an array of objects
}

export interface CapacityCategory {
  id: string;
  name: string;
  translations?: Translations;
}

// NEW: Ingredient Interface
export interface Ingredient {
  id: string;
  name: string;
  unit: string; // 'ks' | 'g' | 'ml' etc.
  imageUrl?: string;
  isHidden: boolean;
}

// NEW: Link between Product and Ingredient
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
  subcategory?: string; // Stores the Subcategory ID (slug)
  capacityCategoryId?: string; // LINK TO CAPACITY GROUP
  images: string[];
  allergens: number[];
  leadTimeDays: number;
  shelfLifeDays: number;
  workload: number;
  workloadOverhead?: number;
  volume: number;
  noPackaging?: boolean;
  isEventProduct?: boolean; // NEW: Flag for event products
  minOrderQuantity?: number;
  visibility: {
    online: boolean;
    store: boolean;
    stand: boolean;
  };
  commentsAllowed: boolean;
  vatRateInner: number;
  vatRateTakeaway: number;
  translations?: Translations;
  composition?: ProductIngredient[]; // NEW: List of ingredients
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
  hasPushSubscription?: boolean; // NEW FIELD
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
  
  deliveryName?: string;
  deliveryStreet?: string;
  deliveryCity?: string;
  deliveryZip?: string;
  deliveryPhone?: string;
  deliveryAddress?: string;

  billingName?: string;
  billingStreet?: string;
  billingCity?: string;
  billingZip?: string;
  billingIc?: string;
  billingDic?: string;

  status: OrderStatus;
  statusHistory?: OrderStatusHistory[];
  isPaid: boolean;
  paymentMethod: PaymentMethod;
  createdAt: string;
  note?: string;
  invoiceUrl?: string;
  companyDetailsSnapshot?: CompanyDetails; // Snapshot at creation (Proforma)
  deliveryCompanyDetailsSnapshot?: CompanyDetails; // Snapshot at delivery (Final Invoice)
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
  date: string; // YYYY-MM-DD
  capacityOverrides: CategoryCapacities; // Specific capacities for this event day
}

export interface ServerSettings {
  consoleLogging: boolean;
}

export interface LogisticsSettings {
  stopTimeMinutes: number;
  loadingSecondsPerItem: number;
  unloadingPaidSeconds: number; // For already paid orders (fast drop)
  unloadingUnpaidSeconds: number; // For cash/collect orders (slow drop)
}
