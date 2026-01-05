
import { Product, ProductCategory, Allergen, OrderStatus, Order, DeliveryType, PaymentMethod, GlobalSettings, Language, PickupLocation } from './types';

export const ALLERGENS: Allergen[] = [
  { id: 1, code: '1', name: 'Obiloviny obsahující lepek' },
  { id: 2, code: '2', name: 'Korýši a výrobky z nich' },
  { id: 3, code: '3', name: 'Vejce a výrobky z nich' },
  { id: 4, code: '4', name: 'Ryby a výrobky z nich' },
  { id: 5, code: '5', name: 'Jádra podzemnice olejné (arašídy) a výrobky z nich' },
  { id: 6, code: '6', name: 'Sójové boby (sója) a výrobky z nich' },
  { id: 7, code: '7', name: 'Mléko a výrobky z něj' },
  { id: 8, code: '8', name: 'Skořápkové plody a výrobky z nich' },
  { id: 9, code: '9', name: 'Celer a výrobky z něj' },
  { id: 10, code: '10', name: 'Hořčice a výrobky z ní' },
  { id: 11, code: '11', name: 'Sezamová semena (sezam) a výrobky z nich' },
  { id: 12, code: '12', name: 'Oxid siřičitý a siřičitany' },
  { id: 13, code: '13', name: 'Vlčí bob (lupina) a výrobky z něj' },
  { id: 14, code: '14', name: 'Měkkýši a výrobky z nich' },
];

export const PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Mini Řízečky (Vepřové)',
    description: 'Šťavnaté vepřové mini řízečky v trojobalu. Ideální na raut.',
    price: 650,
    unit: 'kg',
    category: ProductCategory.WARM,
    images: ['https://picsum.photos/400/300?random=1'],
    allergens: [1, 3, 7],
    leadTimeDays: 2,
    shelfLifeDays: 2,
    workload: 50,
    workloadOverhead: 100, // Overhead for setting up frying station
    volume: 500,
    minOrderQuantity: 1,
    visibility: { online: true, store: true, stand: true },
    commentsAllowed: true,
    vatRateInner: 12,
    vatRateTakeaway: 12
  },
  {
    id: 'p2',
    name: 'Kanapky s lososem',
    description: 'Jemné pečivo s uzeným lososem a koprovým dipem.',
    price: 45,
    unit: 'ks',
    category: ProductCategory.COLD,
    images: ['https://picsum.photos/400/300?random=2'],
    allergens: [1, 4, 7],
    leadTimeDays: 3,
    shelfLifeDays: 1,
    workload: 5,
    workloadOverhead: 20,
    volume: 20,
    minOrderQuantity: 10,
    visibility: { online: true, store: true, stand: false },
    commentsAllowed: true,
    vatRateInner: 12,
    vatRateTakeaway: 12
  },
  {
    id: 'p3',
    name: 'Čokoládový Royal Dort',
    description: 'Luxusní čokoládový dort z belgické čokolády.',
    price: 890,
    unit: 'ks',
    category: ProductCategory.DESSERT,
    images: ['https://picsum.photos/400/300?random=3'],
    allergens: [1, 3, 7, 8],
    leadTimeDays: 3,
    shelfLifeDays: 3,
    workload: 100,
    workloadOverhead: 50,
    volume: 1000,
    minOrderQuantity: 1,
    visibility: { online: true, store: true, stand: true },
    commentsAllowed: true,
    vatRateInner: 12,
    vatRateTakeaway: 12
  },
];

const DEFAULT_OPENING_HOURS = {
  1: { isOpen: true, start: '08:00', end: '18:00' }, // Mon
  2: { isOpen: true, start: '08:00', end: '18:00' }, // Tue
  3: { isOpen: true, start: '08:00', end: '18:00' }, // Wed
  4: { isOpen: true, start: '08:00', end: '18:00' }, // Thu
  5: { isOpen: true, start: '08:00', end: '18:00' }, // Fri
  6: { isOpen: false, start: '09:00', end: '12:00' }, // Sat
  0: { isOpen: false, start: '09:00', end: '12:00' }, // Sun
};

export const DEFAULT_SETTINGS: GlobalSettings = {
  categories: [
    { id: ProductCategory.WARM, name: 'Teplý catering', order: 1, enabled: true },
    { id: ProductCategory.COLD, name: 'Studený catering', order: 2, enabled: true },
    { id: ProductCategory.DESSERT, name: 'Zákusky', order: 3, enabled: true },
    { id: ProductCategory.DRINK, name: 'Nápoje', order: 4, enabled: true }
  ],
  defaultCapacities: {
    [ProductCategory.WARM]: 1000,
    [ProductCategory.COLD]: 2000,
    [ProductCategory.DESSERT]: 500,
    [ProductCategory.DRINK]: 5000
  },
  companyDetails: {
    name: '4Gracie s.r.o.',
    ic: '12345678',
    dic: 'CZ12345678',
    street: 'Václavské náměstí 1',
    city: 'Praha 1',
    zip: '110 00',
    email: 'info@4gracie.cz',
    phone: '+420 123 456 789',
    bankAccount: '2701000000/2010',
    bic: 'RZBCCZPP' 
  },
  paymentMethods: [
    { id: PaymentMethod.GATEWAY, label: 'Online karta / Apple Pay', description: 'Rychlá a bezpečná platba kartou přes platební bránu.', enabled: true },
    { id: PaymentMethod.QR, label: 'QR Platba', description: 'Okamžitý převod z vaší bankovní aplikace pomocí QR kódu.', enabled: true },
    { id: PaymentMethod.CASH, label: 'Hotovost / Karta na místě', description: 'Platba při převzetí na prodejně.', enabled: true }
  ],
  deliveryRegions: [
    { id: '1', name: 'Praha Centrum', zips: ['11000', '12000'], price: 150, freeFrom: 2000, enabled: true, deliveryTimeStart: '10:00', deliveryTimeEnd: '14:00' },
  ],
  pickupLocations: [
    {
      id: 'store-1',
      name: 'Prodejna 4Gracie',
      street: 'Václavské náměstí 1',
      city: 'Praha 1',
      zip: '110 00',
      enabled: true,
      openingHours: DEFAULT_OPENING_HOURS,
      exceptions: []
    }
  ],
  packaging: {
    types: [
      { id: 'box-small', name: 'Malá krabice', volume: 500, price: 15 },
      { id: 'box-medium', name: 'Střední krabice', volume: 1500, price: 35 },
      { id: 'box-large', name: 'Velká krabice', volume: 3000, price: 60 }
    ],
    freeFrom: 5000
  },
  enabledLanguages: [Language.CS, Language.EN, Language.DE],
  enableAiTranslation: true,
  sqlDebug: false,
  server: {
    consoleLogging: false,
    baseUrl: 'http://localhost:3000'
  }
};

export const EMPTY_SETTINGS: GlobalSettings = {
  categories: [],
  defaultCapacities: {},
  companyDetails: {
    name: '',
    ic: '',
    dic: '',
    street: '',
    city: '',
    zip: '',
    email: '',
    phone: '',
    bankAccount: '',
    bic: '' 
  },
  paymentMethods: [],
  deliveryRegions: [],
  pickupLocations: [],
  packaging: {
    types: [],
    freeFrom: 0
  },
  enabledLanguages: [],
  enableAiTranslation: false,
  sqlDebug: false,
  server: { consoleLogging: false }
};

export const MOCK_ORDERS: Order[] = [
  {
    id: 'ord-12345',
    userId: 'u1',
    userName: 'Jan Novák',
    items: [
      { ...PRODUCTS[0], quantity: 2 },
      { ...PRODUCTS[2], quantity: 1 }
    ],
    totalPrice: 2190,
    packagingFee: 50,
    deliveryFee: 150,
    deliveryType: DeliveryType.DELIVERY,
    deliveryDate: '2025-11-15',
    deliveryName: 'Jan Novák',
    deliveryStreet: 'Václavské náměstí 1',
    deliveryCity: 'Praha 1',
    deliveryZip: '11000',
    deliveryPhone: '+420 123 456 789',
    billingName: 'Jan Novák',
    billingStreet: 'Václavské náměstí 1',
    billingCity: 'Praha 1',
    billingZip: '11000',
    status: OrderStatus.CONFIRMED,
    isPaid: true,
    paymentMethod: PaymentMethod.GATEWAY,
    createdAt: '2025-01-10T10:00:00Z',
    language: Language.CS,
    note: 'Prosím doručit do 12:00'
  },
];
