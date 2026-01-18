import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import { 
  CartItem, Language, Product, User, Order, GlobalSettings, DayConfig, ProductCategory, 
  OrderStatus, PaymentMethod, DiscountCode, DiscountType, AppliedDiscount, DeliveryRegion, 
  PackagingType, CompanyDetails, BackupData, PickupLocation, Ride, RideStep, CookieSettings,
  OrdersSearchResult, EventSlot
} from '../types';
import { MOCK_ORDERS, PRODUCTS as INITIAL_PRODUCTS, DEFAULT_SETTINGS, EMPTY_SETTINGS } from '../constants';
import { TRANSLATIONS } from '../translations';
import { jsPDF } from 'jspdf';
import { calculatePackagingFeeLogic, calculateDailyLoad, getAvailableEventDatesLogic, calculateDiscountAmountLogic } from '../utils/orderLogic';
import { generateRoutePdf } from '../utils/pdfGenerator';
import { calculateCzIban, formatDate, removeDiacritics } from '../utils/helpers';

interface CheckResult {
  allowed: boolean;
  reason?: string;
  status: DayStatus;
}

export type DayStatus = 'available' | 'closed' | 'full' | 'exceeds' | 'past' | 'too_soon';

interface ValidateDiscountResult {
  success: boolean;
  discount?: DiscountCode;
  amount?: number;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  collisions?: string[];
  message?: string;
}

interface RestorationCheckResult {
  valid: boolean;
  invalidCodes: string[];
}

interface PasswordChangeResult {
  success: boolean;
  message: string;
}

interface RegionDateInfo {
  isOpen: boolean;
  timeStart?: string;
  timeEnd?: string;
  isException: boolean;
  reason?: string;
}

export type DataSourceMode = 'local' | 'api';

interface GlobalNotification {
  message: string;
  type: 'success' | 'error';
  autoClose: boolean;
}

interface StoreContextType {
  dataSource: DataSourceMode;
  setDataSource: (mode: DataSourceMode) => void;
  isLoading: boolean;
  isOperationPending: boolean;
  dbConnectionError: boolean;
  
  isPreviewEnvironment: boolean; // ADDED: Required by Admin.tsx
  
  language: Language;
  setLanguage: (lang: Language) => void;
  
  cart: CartItem[];
  cartBump: boolean;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartItemQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  
  user: User | null;
  allUsers: User[];
  login: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  register: (name: string, email: string, phone: string, password?: string) => void;
  logout: () => void;
  updateUser: (user: User) => Promise<boolean>; 
  updateUserAdmin: (user: User) => Promise<boolean>; 
  toggleUserBlock: (userId: string) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; message?: string }>;
  resetPasswordByToken: (token: string, newPass: string) => Promise<PasswordChangeResult>;
  changePassword: (oldPass: string, newPass: string) => Promise<PasswordChangeResult>;
  addUser: (name: string, email: string, phone: string, role: 'customer' | 'admin' | 'driver') => Promise<boolean>;
  
  orders: Order[];
  addOrder: (order: Order) => Promise<boolean>;
  updateOrderStatus: (orderIds: string[], status: OrderStatus, sendNotify?: boolean, sendPush?: boolean) => Promise<boolean>;
  updateOrder: (order: Order, sendNotify?: boolean, isUserEdit?: boolean) => Promise<boolean>;
  checkOrderRestoration: (order: Order) => RestorationCheckResult;
  searchOrders: (filters: any) => Promise<OrdersSearchResult>;
  
  products: Product[];
  addProduct: (product: Product) => Promise<boolean>;
  updateProduct: (product: Product) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  searchProducts: (filters: any) => Promise<{ products: Product[], total: number, page: number, pages: number }>;
  
  discountCodes: DiscountCode[];
  appliedDiscounts: AppliedDiscount[];
  addDiscountCode: (code: DiscountCode) => Promise<boolean>;
  updateDiscountCode: (code: DiscountCode) => Promise<boolean>;
  deleteDiscountCode: (id: string) => Promise<boolean>;
  applyDiscount: (code: string) => { success: boolean; error?: string };
  removeAppliedDiscount: (code: string) => void;
  validateDiscount: (code: string, currentCart: CartItem[]) => ValidateDiscountResult;
  
  settings: GlobalSettings;
  updateSettings: (settings: GlobalSettings) => Promise<boolean>;
  dayConfigs: DayConfig[];
  updateDayConfig: (config: DayConfig) => Promise<boolean>;
  removeDayConfig: (date: string) => Promise<boolean>;
  
  updateEventSlot: (slot: EventSlot) => Promise<boolean>;
  removeEventSlot: (date: string) => Promise<boolean>;
  notifyEventSubscribers: (date: string) => Promise<boolean>;
  
  rides: Ride[];
  updateRide: (ride: Ride) => Promise<boolean>;
  printRouteSheet: (ride: Ride, driverName: string) => void;
  
  checkAvailability: (date: string, cartItems: CartItem[], excludeOrderId?: string) => CheckResult;
  getDateStatus: (date: string, cartItems: CartItem[]) => DayStatus;
  getDailyLoad: (date: string, excludeOrderId?: string) => { load: Record<string, number>; eventLoad: Record<string, number> };
  getDeliveryRegion: (zip: string) => DeliveryRegion | undefined;
  getRegionInfoForDate: (region: DeliveryRegion, date: string) => RegionDateInfo;
  getPickupPointInfo: (location: PickupLocation, date: string) => RegionDateInfo;
  calculatePackagingFee: (items: CartItem[]) => number;
  getAvailableEventDates: (product: Product) => string[];
  isEventCapacityAvailable: (product: Product) => boolean;
  
  t: (key: string, params?: Record<string, string>) => string;
  tData: (item: any, field: string) => string;
  generateInvoice: (order: Order) => string;
  printInvoice: (order: Order, type?: 'proforma' | 'final') => Promise<void>;
  generateCzIban: (accountStr: string) => string;
  removeDiacritics: (str: string) => string;
  formatDate: (dateStr: string) => string;
  getImageUrl: (path?: string, size?: 'original' | 'medium' | 'small') => string;
  getFullApiUrl: (endpoint: string) => string;
  uploadImage: (base64: string, name: string) => Promise<string>;
  
  importDatabase: (data: BackupData, selection: Record<string, boolean>) => Promise<ImportResult>;
  refreshData: () => Promise<void>;
  
  globalNotification: GlobalNotification | null;
  dismissNotification: () => void;

  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;

  cookieSettings: CookieSettings | null;
  saveCookieSettings: (settings: CookieSettings) => void;

  isPwa: boolean;
  isPwaUpdateAvailable: boolean;
  updatePwa: () => void;
  appVersion: string;

  pushSubscription: PushSubscription | null;
  subscribeToPush: () => Promise<void>;
  unsubscribeFromPush: () => Promise<void>;
  isPushSupported: boolean;
  
  searchUsers: (filters: any) => Promise<User[]>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const hashPassword = (pwd: string) => `hashed_${btoa(pwd)}`;

const INITIAL_USERS: User[] = [
    { 
        id: 'u1', name: 'Jan Novák', email: 'jan.novak@example.com', phone: '+420777777777', 
        role: 'customer', billingAddresses: [], deliveryAddresses: [], isBlocked: false, 
        passwordHash: hashPassword('1234'), marketingConsent: true 
    },
    { 
        id: 'admin1', name: 'Admin', email: 'info@4gracie.cz', phone: '+420777777777', 
        role: 'admin', billingAddresses: [], deliveryAddresses: [], isBlocked: false, 
        passwordHash: hashPassword('1234'), marketingConsent: false 
    },
    { 
        id: 'driver1', name: 'Řidič', email: 'ridic@4gracie.cz', phone: '+420777777777', 
        role: 'driver', billingAddresses: [], deliveryAddresses: [], isBlocked: false, 
        passwordHash: hashPassword('1234'), marketingConsent: false 
    }
];

const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
};

// @ts-ignore
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dataSource, setDataSourceState] = useState<DataSourceMode>(() => {
    return (localStorage.getItem('app_data_source') as DataSourceMode) || 'local';
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isOperationPending, setIsOperationPending] = useState(false);
  const [dbConnectionError, setDbConnectionError] = useState(false);
  const [language, setLanguage] = useState<Language>(Language.CS);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [globalNotification, setGlobalNotification] = useState<GlobalNotification | null>(null);
  const [cookieSettings, setCookieSettings] = useState<CookieSettings | null>(() => loadFromStorage('cookie_settings', null));

  // PWA State
  const [isPwa, setIsPwa] = useState(false);
  const [isPwaUpdateAvailable, setIsPwaUpdateAvailable] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  
  // Push State
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);

  // Data State
  const [cart, setCart] = useState<CartItem[]>(() => loadFromStorage('cart', []));
  const [cartBump, setCartBump] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(() => loadFromStorage('session_user', null));
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>([]);
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);

  // Derived state
  const isPreviewEnvironment = dataSource === 'local';

  // Localization Helpers
  const t = (key: string, params?: Record<string, string>) => {
    const langKey = language as Language;
    let text = TRANSLATIONS[langKey]?.[key] || TRANSLATIONS[Language.CS]?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  const tData = (item: any, field: string) => {
    if (!item) return '';
    if (language === Language.CS) return item[field];
    return item.translations?.[language]?.[field] || item[field];
  };

  const setDataSource = (mode: DataSourceMode) => {
    localStorage.setItem('app_data_source', mode);
    setDataSourceState(mode);
  };

  const showNotify = (message: string, type: 'success' | 'error' = 'success', autoClose: boolean = true) => {
    setGlobalNotification({ message, type, autoClose });
  };

  const getFullApiUrl = (endpoint: string) => {
    // @ts-ignore
    const env = (import.meta as any).env;
    if (env.DEV) return endpoint;
    let baseUrl = env.VITE_API_URL;
    if (!baseUrl) {
       baseUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
    }
    if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
    }
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
  };

  // UPDATED getImageUrl to handle size variants
  const getImageUrl = (path?: string, size: 'original' | 'medium' | 'small' = 'original') => {
      if (!path) return '';
      if (path.startsWith('data:') || path.startsWith('http')) return path;
      
      // If we are requesting a specific size, append the suffix and change ext to webp
      // Convention: filename.ext -> filename-size.webp
      if (size !== 'original') {
          const parts = path.split('.');
          if (parts.length > 1) {
              const ext = parts.pop();
              const base = parts.join('.');
              // Construct new path
              const newPath = `${base}-${size}.webp`;
              return getFullApiUrl(newPath);
          }
      }
      
      return getFullApiUrl(path);
  };

  const apiCall = async (endpoint: string, method: string, body?: any) => {
    const controller = new AbortController();
    setIsOperationPending(true);
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            controller.abort();
            reject(new Error('TIMEOUT_LIMIT_REACHED'));
        }, 15000); 
    });

    try {
      const url = getFullApiUrl(endpoint);
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res: any = await Promise.race([
        fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        }),
        timeoutPromise
      ]);
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
          // Check for maintenance mode HTML or similar
          throw new Error("Server returned invalid data (HTML instead of JSON). Maintenance?");
      }
      
      if (res.status === 401) {
          // Token expired, try refresh? For now just logout
          logout();
          throw new Error('Unauthorized');
      }

      if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || `API Error: ${res.status}`);
      }
      
      setDbConnectionError(false);
      return await res.json();
    } catch (e: any) {
      if (e.message === 'TIMEOUT_LIMIT_REACHED' || e.message.includes('fetch failed')) {
         setDbConnectionError(true);
      } 
      console.warn(`[API] Call to ${endpoint} failed:`, e);
      return null;
    } finally {
        setIsOperationPending(false); 
    }
  };

  const fetchData = async () => {
      setIsLoading(true);
      try {
        if (dataSource === 'api') {
          setAllUsers([]);
          setProducts([]);
          setOrders([]);
          setDiscountCodes([]);
          setDayConfigs([]);
          setRides([]);
          setSettings(EMPTY_SETTINGS);
          
          const data = await apiCall('/api/bootstrap', 'GET');
          
          if (data) {
              setAllUsers(data.users || []);
              setProducts(data.products || []);
              setOrders(data.orders || []);
              
              if (data.settings) {
                 const mergedSettings = { ...DEFAULT_SETTINGS, ...data.settings };
                 if (!mergedSettings.categories) mergedSettings.categories = DEFAULT_SETTINGS.categories;
                 if (!mergedSettings.pickupLocations) mergedSettings.pickupLocations = DEFAULT_SETTINGS.pickupLocations;
                 setSettings(mergedSettings); 
              }
              
              setDiscountCodes(data.discountCodes || []);
              setDayConfigs(data.dayConfigs || []);
              setRides(data.rides || []); // If rides are sent in bootstrap, otherwise fetch separate
              
              if (data.vapidPublicKey) setVapidPublicKey(data.vapidPublicKey);
          }
        } else {
          // Local Mode
          let loadedUsers = loadFromStorage('db_users', [] as User[]);
          // Seed initial users if empty
          if (loadedUsers.length === 0) {
              loadedUsers = INITIAL_USERS;
          }
          setAllUsers(loadedUsers);

          setProducts(loadFromStorage('db_products', INITIAL_PRODUCTS));
          setOrders(loadFromStorage('db_orders', MOCK_ORDERS));
          
          const loadedSettings = loadFromStorage('db_settings', DEFAULT_SETTINGS);
          if (!loadedSettings.categories) loadedSettings.categories = DEFAULT_SETTINGS.categories;
          if (!loadedSettings.pickupLocations) loadedSettings.pickupLocations = DEFAULT_SETTINGS.pickupLocations;
          
          setSettings(loadedSettings);
          setDiscountCodes(loadFromStorage('db_discounts', []));
          setDayConfigs(loadFromStorage('db_dayconfigs', []));
          setRides(loadFromStorage('db_rides', []));
        }
      } catch (err: any) {
        console.error("Fetch Data Error", err);
      } finally {
        setIsLoading(false);
      }
  };

  useEffect(() => {
    fetchData();
    // Check PWA mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
        setIsPwa(true);
    }
    // Check Push Support
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        setIsPushSupported(true);
    }
  }, [dataSource]);

  // SW Updates & Push
  useEffect(() => {
      if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
              setSwRegistration(registration);
              // Check for subscription
              registration.pushManager.getSubscription().then(sub => {
                  setPushSubscription(sub);
              });
          });
          
          // Listen for updates
          navigator.serviceWorker.addEventListener('controllerchange', () => {
             // Reload page when new SW takes control
             window.location.reload();
          });
      }
  }, []);

  useEffect(() => localStorage.setItem('cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('session_user', JSON.stringify(user)), [user]);
  
  useEffect(() => {
    if (dataSource === 'local') {
      localStorage.setItem('db_users', JSON.stringify(allUsers));
      localStorage.setItem('db_orders', JSON.stringify(orders));
      localStorage.setItem('db_products', JSON.stringify(products));
      localStorage.setItem('db_discounts', JSON.stringify(discountCodes));
      localStorage.setItem('db_settings', JSON.stringify(settings));
      localStorage.setItem('db_dayconfigs', JSON.stringify(dayConfigs));
      localStorage.setItem('db_rides', JSON.stringify(rides));
    }
  }, [allUsers, orders, products, discountCodes, settings, dayConfigs, rides, dataSource]);

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);
  const dismissNotification = () => setGlobalNotification(null);

  const saveCookieSettings = (s: CookieSettings) => {
      setCookieSettings(s);
      localStorage.setItem('cookie_settings', JSON.stringify(s));
  };

  const addToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...prev, { ...product, quantity }];
    });
    setCartBump(true);
    setTimeout(() => setCartBump(false), 300);
    showNotify(t('notification.added_to_cart', { name: product.name }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateCartItemQuantity = (id: string, quantity: number) => {
    if (quantity < 1) {
       removeFromCart(id);
       return;
    }
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity } : item));
  };

  const clearCart = () => setCart([]);

  // Recalculate discounts when cart changes
  useEffect(() => {
    if (appliedDiscounts.length === 0) return;
    let updatedDiscounts: AppliedDiscount[] = [];
    let removedCodes: string[] = [];
    
    // We pass empty orders array for local calculation check to avoid dep cycle, assume loaded orders
    for (const applied of appliedDiscounts) {
      const calculation = calculateDiscountAmountLogic(applied.code, cart, discountCodes, orders);
      if (calculation.success && calculation.amount !== undefined) {
        updatedDiscounts.push({ code: applied.code, amount: calculation.amount });
      } else {
        removedCodes.push(applied.code);
      }
    }
    const isDifferent = JSON.stringify(updatedDiscounts) !== JSON.stringify(appliedDiscounts);
    if (isDifferent) {
      setAppliedDiscounts(updatedDiscounts);
      if (removedCodes.length > 0) showNotify(`${t('discount.invalid')}: ${removedCodes.join(', ')}`, 'error');
    }
  }, [cart]);

  // --- ORDER ACTIONS ---

  const addOrder = async (order: Order): Promise<boolean> => {
    const orderWithHistory: Order = {
      ...order,
      language: language,
      companyDetailsSnapshot: JSON.parse(JSON.stringify(settings.companyDetails)),
      statusHistory: [{ status: order.status, date: new Date().toISOString() }]
    };
    
    if (dataSource === 'api') {
      const res = await apiCall('/api/orders', 'POST', orderWithHistory);
      if (res && res.success) {
        setOrders(prev => [orderWithHistory, ...prev]);
        showNotify(t('notification.order_created', { id: order.id }));
        return true;
      }
      return false;
    } else {
      setOrders(prev => [orderWithHistory, ...prev]);
      showNotify(t('notification.order_created', { id: order.id }));
      return true;
    }
  };

  const updateOrder = async (order: Order, sendNotify?: boolean, isUserEdit?: boolean): Promise<boolean> => {
    let updatedOrder = { ...order };
    
    // Auto-cancel if empty
    if (updatedOrder.items.length === 0) {
      updatedOrder.status = OrderStatus.CANCELLED;
      if (!updatedOrder.statusHistory?.some(h => h.status === OrderStatus.CANCELLED)) {
         updatedOrder.statusHistory = [...(updatedOrder.statusHistory || []), { status: OrderStatus.CANCELLED, date: new Date().toISOString() }];
      }
    }

    // Cleanup rides if order parameters changed that affect logistics (Date, Address)
    // Only if status didn't change to cancelled/delivered in this specific update (handled elsewhere)
    const oldOrder = orders.find(o => o.id === order.id);
    if (oldOrder && (oldOrder.deliveryDate !== updatedOrder.deliveryDate || oldOrder.deliveryAddress !== updatedOrder.deliveryAddress)) {
        // Remove from any planned ride to force re-plan
        const affectedRide = rides.find(r => r.orderIds.includes(order.id));
        if (affectedRide && affectedRide.status === 'planned') {
            const newRide = { ...affectedRide, orderIds: affectedRide.orderIds.filter(id => id !== order.id), steps: [] };
            if (dataSource === 'api') apiCall('/api/admin/rides', 'POST', newRide);
            setRides(prev => prev.map(r => r.id === newRide.id ? newRide : r));
        }
    }

    if (dataSource === 'api') {
       const res = await apiCall('/api/orders', 'POST', { ...updatedOrder, sendNotify });
       if (res && res.success) {
          setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
          if (updatedOrder.status === OrderStatus.CREATED) showNotify(t('notification.saved'));
          return true;
       }
       return false;
    } else {
       setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
       showNotify(t('notification.saved'));
       return true;
    }
  };

  const updateOrderStatus = async (ids: string[], status: OrderStatus, notify?: boolean, sendPush?: boolean): Promise<boolean> => {
    if (dataSource === 'api') {
       const res = await apiCall('/api/orders/status', 'PUT', { ids, status, notifyCustomer: notify, sendPush });
       if (res && res.success) {
          setOrders(prev => prev.map(o => {
            if (ids.includes(o.id)) {
              return { ...o, status, statusHistory: [...(o.statusHistory || []), { status, date: new Date().toISOString() }] };
            }
            return o;
          }));
          const msg = notify ? `${t('notification.saved')} + ${t('notification.email_sent')}` : t('notification.saved');
          showNotify(msg);
          return true;
       }
       return false;
    } else {
       setOrders(prev => prev.map(o => {
          if (ids.includes(o.id)) {
            return { ...o, status, statusHistory: [...(o.statusHistory || []), { status, date: new Date().toISOString() }] };
          }
          return o;
        }));
        showNotify(t('notification.saved'));
        return true;
    }
  };

  const searchOrders = async (filters: any) => {
      if (dataSource === 'api') {
          const q = new URLSearchParams(filters).toString();
          const res = await apiCall(`/api/orders?${q}`, 'GET');
          if (res && res.success) return res;
          return { orders: [], total: 0, page: 1, pages: 1 };
      } else {
          // Local mock search not fully implemented for all filters, returning all for simplicity in demo
          return { orders: orders, total: orders.length, page: 1, pages: 1 };
      }
  };

  // --- PRODUCT & CATEGORY ACTIONS ---

  const addProduct = async (p: Product): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/products', 'POST', p);
        if (res && res.success) { setProducts(prev => [...prev, p]); showNotify(t('notification.db_saved')); return true; }
        return false;
    } else {
        setProducts(prev => [...prev, p]); return true;
    }
  };

  const updateProduct = async (p: Product): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/products', 'POST', p);
        if (res && res.success) { setProducts(prev => prev.map(x => x.id === p.id ? p : x)); showNotify(t('notification.db_saved')); return true; }
        return false;
    } else {
        setProducts(prev => prev.map(x => x.id === p.id ? p : x)); return true;
    }
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall(`/api/products/${id}`, 'DELETE');
        if (res && res.success) { setProducts(prev => prev.filter(x => x.id !== id)); showNotify(t('notification.db_saved')); return true; }
        return false;
    } else {
        setProducts(prev => prev.filter(x => x.id !== id)); return true;
    }
  };

  const searchProducts = async (filters: any) => {
      if (dataSource === 'api') {
          const q = new URLSearchParams(filters).toString();
          const res = await apiCall(`/api/products?${q}`, 'GET');
          if (res && res.success) return res;
          return { products: [], total: 0, page: 1, pages: 1 };
      } else {
          // Local pagination logic for demo
          return { products: products, total: products.length, page: 1, pages: 1 };
      }
  };

  const uploadImage = async (base64: string, name: string) => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/admin/upload', 'POST', { image: base64, name });
          if (res && res.success) return res.url;
          throw new Error('Upload failed');
      }
      return base64;
  };

  // --- USER ACTIONS ---

  const login = async (email: string, password?: string) => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/users/login', 'POST', { email, password, isPwa });
        if (res && res.success) {
            setUser(res.user);
            localStorage.setItem('session_user', JSON.stringify(res.user));
            if (res.token) localStorage.setItem('auth_token', res.token);
            if (res.refreshToken) localStorage.setItem('refresh_token', res.refreshToken);
            return { success: true };
        }
        return { success: false, message: res?.message || 'Login failed' };
    } else {
        const foundUser = allUsers.find(u => u.email === email);
        if (foundUser) {
            if (foundUser.isBlocked) return { success: false, message: t('cart.account_blocked') };
            if (password && foundUser.passwordHash !== hashPassword(password)) return { success: false, message: 'Chybné heslo' };
            setUser(foundUser); 
            return { success: true };
        }
        return { success: false, message: 'Nenalezen' };
    }
  };

  const register = (name: string, email: string, phone: string, password?: string) => {
    // ... logic consistent with previous implementation
    if (allUsers.find(u => u.email.toLowerCase() === email.toLowerCase())) { 
        showNotify('Email exists', 'error');
        return; 
    }
    const newUser: User = { 
        id: Date.now().toString(), name, email, phone, role: 'customer', 
        billingAddresses: [], deliveryAddresses: [], isBlocked: false, 
        passwordHash: hashPassword(password || '1234'), marketingConsent: false 
    };
    
    if (dataSource === 'api') {
        apiCall('/api/users', 'POST', newUser).then(res => {
            if (res && res.success) showNotify('Registrace OK', 'success');
        });
    } else {
        setAllUsers(prev => [...prev, newUser]); setUser(newUser); 
    }
  };

  const logout = () => { 
      setUser(null); 
      localStorage.removeItem('session_user');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
  };

  // User Mgmt
  const updateUser = async (u: User) => {
      const res = await apiCall('/api/users', 'POST', u); // Unified endpoint in new backend
      if (res || dataSource === 'local') {
          setUser(u);
          setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
          return true;
      }
      return false;
  };
  
  const updateUserAdmin = async (u: User) => {
      return updateUser(u); // Same logic for now
  };

  const addUser = async (name: string, email: string, phone: string, role: any) => {
      const newUser: User = { 
          id: Date.now().toString(), name, email, phone, role, 
          billingAddresses: [], deliveryAddresses: [], isBlocked: false, 
          passwordHash: hashPassword('1234'), marketingConsent: false 
      };
      if (dataSource === 'api') {
          const res = await apiCall('/api/users', 'POST', newUser);
          if (res && res.success) {
              setAllUsers(prev => [...prev, newUser]);
              return true;
          }
          return false;
      } else {
          setAllUsers(prev => [...prev, newUser]);
          return true;
      }
  };

  const toggleUserBlock = async (id: string) => {
      const u = allUsers.find(x => x.id === id);
      if (u) return updateUserAdmin({ ...u, isBlocked: !u.isBlocked });
      return false;
  };

  const sendPasswordReset = async (email: string) => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/auth/reset-password', 'POST', { email });
          return res;
      }
      return { success: true, message: 'Simulated' };
  };

  const resetPasswordByToken = async (token: string, newPass: string) => {
      if (dataSource === 'api') {
          const newHash = hashPassword(newPass);
          const res = await apiCall('/api/auth/reset-password-confirm', 'POST', { token, newPasswordHash: newHash });
          return res;
      }
      return { success: true, message: 'Simulated' };
  };

  const changePassword = async (old: string, newP: string) => {
      if (!user) return { success: false, message: 'Login required' };
      // In API mode, verify old pass on server. In local mode, verify hash.
      // For simplicity, we just update here assuming authorized context
      const u = { ...user, passwordHash: hashPassword(newP) };
      await updateUser(u);
      return { success: true, message: 'Heslo změněno' };
  };

  const searchUsers = async (filters: any) => {
      if (dataSource === 'api') {
          const q = new URLSearchParams(filters).toString();
          const res = await apiCall(`/api/users?${q}`, 'GET');
          if (res && res.success) return res.users;
          return [];
      }
      return allUsers; // Local filter handled in component
  };

  // --- SETTINGS & CONFIG ---

  const updateSettings = async (s: GlobalSettings) => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/settings', 'POST', s);
          if (res && res.success) { setSettings(s); showNotify(t('notification.saved')); return true; }
          return false;
      } else {
          setSettings(s); return true;
      }
  };

  const updateDayConfig = async (c: DayConfig) => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/calendar', 'POST', c);
          if (res && res.success) {
              setDayConfigs(prev => { const exists = prev.find(d => d.date === c.date); return exists ? prev.map(d => d.date === c.date ? c : d) : [...prev, c]; });
              return true;
          }
          return false;
      } else {
          setDayConfigs(prev => { const exists = prev.find(d => d.date === c.date); return exists ? prev.map(d => d.date === c.date ? c : d) : [...prev, c]; });
          return true;
      }
  };

  const removeDayConfig = async (date: string) => {
      if (dataSource === 'api') {
          const res = await apiCall(`/api/calendar/${date}`, 'DELETE');
          if (res && res.success) { setDayConfigs(prev => prev.filter(d => d.date !== date)); return true; }
          return false;
      } else {
          setDayConfigs(prev => prev.filter(d => d.date !== date)); return true;
      }
  };

  // --- EVENTS ---
  
  const updateEventSlot = async (slot: any) => {
      // Stored in GlobalSettings now in new structure (or separate table if specialized)
      // Assuming eventSlots in settings for simplicity in this version, or update settings.
      const newSlots = [...(settings.eventSlots || [])];
      const idx = newSlots.findIndex(s => s.date === slot.date);
      if (idx > -1) newSlots[idx] = slot;
      else newSlots.push(slot);
      
      return await updateSettings({ ...settings, eventSlots: newSlots });
  };

  const removeEventSlot = async (date: string) => {
      const newSlots = (settings.eventSlots || []).filter(s => s.date !== date);
      return await updateSettings({ ...settings, eventSlots: newSlots });
  };

  const notifyEventSubscribers = async (date: string) => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/admin/notify-event', 'POST', { date });
          if (res && res.success) showNotify(`Notifikace odeslána ${res.count} odběratelům.`);
          return true;
      }
      return false;
  };

  // --- DISCOUNTS ---

  const addDiscountCode = async (c: DiscountCode) => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/discounts', 'POST', c);
          if (res && res.success) { setDiscountCodes(prev => [...prev, c]); return true; }
          return false;
      } else {
          setDiscountCodes(prev => [...prev, c]); return true;
      }
  };

  const updateDiscountCode = async (c: DiscountCode) => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/discounts', 'POST', c);
          if (res && res.success) { setDiscountCodes(prev => prev.map(x => x.id === c.id ? c : x)); return true; }
          return false;
      } else {
          setDiscountCodes(prev => prev.map(x => x.id === c.id ? c : x)); return true;
      }
  };

  const deleteDiscountCode = async (id: string) => {
      if (dataSource === 'api') {
          const res = await apiCall(`/api/discounts/${id}`, 'DELETE');
          if (res && res.success) { setDiscountCodes(prev => prev.filter(x => x.id !== id)); return true; }
          return false;
      } else {
          setDiscountCodes(prev => prev.filter(x => x.id !== id)); return true;
      }
  };

  const applyDiscount = (code: string) => {
      if (appliedDiscounts.some(d => d.code === code.toUpperCase())) return { success: false, error: t('discount.applied') };
      const result = calculateDiscountAmountLogic(code, cart, discountCodes, orders);
      if (result.success && result.discount && result.amount !== undefined) {
          if (appliedDiscounts.length > 0 && !result.discount.isStackable) return { success: false, error: t('discount.not_stackable') };
          setAppliedDiscounts([...appliedDiscounts, { code: result.discount.code, amount: result.amount }]);
          return { success: true };
      }
      return { success: false, error: result.error };
  };

  const removeAppliedDiscount = (code: string) => setAppliedDiscounts(prev => prev.filter(d => d.code !== code));
  const validateDiscount = (code: string, items: CartItem[]) => calculateDiscountAmountLogic(code, items, discountCodes, orders);

  // --- RIDES ---

  const updateRide = async (ride: Ride) => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/admin/rides', 'POST', ride);
          if (res && res.success) {
              setRides(prev => {
                  const exists = prev.find(r => r.id === ride.id);
                  if (exists) return prev.map(r => r.id === ride.id ? ride : r);
                  return [...prev, ride];
              });
              return true;
          }
          return false;
      } else {
          setRides(prev => {
              const exists = prev.find(r => r.id === ride.id);
              if (exists) return prev.map(r => r.id === ride.id ? ride : r);
              return [...prev, ride];
          });
          return true;
      }
  };

  const printRouteSheet = async (ride: Ride, driverName: string) => {
      const blob = await generateRoutePdf(ride, orders, products, settings, driverName);
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `rozvoz_${ride.id}.pdf`;
      a.click();
  };

  // --- LOGIC HELPERS ---

  const calculatePackagingFee = (items: CartItem[]) => calculatePackagingFeeLogic(items, settings.packaging.types, settings.packaging.freeFrom);

  const getDailyLoad = (date: string, excludeOrderId?: string) => {
      const relevantOrders = orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED && o.id !== excludeOrderId);
      return calculateDailyLoad(relevantOrders, products, settings);
  };

  const checkAvailability = (date: string, items: CartItem[], excludeOrderId?: string): CheckResult => {
      const today = new Date(); today.setHours(0,0,0,0);
      const target = new Date(date); target.setHours(0,0,0,0);
      if (isNaN(target.getTime())) return { allowed: false, reason: 'Invalid Date', status: 'closed' };

      if (target.getTime() < today.getTime()) return { allowed: false, reason: t('error.past'), status: 'past' };
      
      const maxLead = items.length > 0 ? Math.max(...items.map(i => Number(i.leadTimeDays) || 0)) : 0;
      const minDate = new Date(today.getTime()); 
      minDate.setDate(minDate.getDate() + maxLead);
      
      if (target.getTime() < minDate.getTime()) return { allowed: false, reason: t('error.too_soon'), status: 'too_soon' };

      // Day Config Check
      const config = dayConfigs.find(d => d.date === date);
      if (config && !config.isOpen) return { allowed: false, reason: t('error.day_closed'), status: 'closed' };

      // Load Check
      const { load, eventLoad } = getDailyLoad(date, excludeOrderId);
      
      // Simulate adding current items
      items.forEach(item => {
          const productDef = products.find(p => String(p.id) === String(item.id));
          const workload = Number(productDef?.workload) || Number(item.workload) || 0;
          const overhead = Number(productDef?.workloadOverhead) || Number(item.workloadOverhead) || 0;
          const quantity = Number(item.quantity) || 0;
          
          const cat = item.category || productDef?.category;
          const isEvent = !!(item.isEventProduct || productDef?.isEventProduct);
          
          if (cat) {
              if (isEvent) {
                  eventLoad[cat] = (eventLoad[cat] || 0) + (workload * quantity) + overhead;
              } else {
                  load[cat] = (load[cat] || 0) + (workload * quantity) + overhead;
              }
          }
      });
      
      // Check limits
      let anyExceeds = false;
      const catsToCheck = new Set([...settings.categories.map(c => c.id)]);
      
      for(const cat of catsToCheck) {
          const limit = config?.capacityOverrides?.[cat] ?? settings.defaultCapacities[cat] ?? 0;
          if ((load[cat] || 0) > limit) anyExceeds = true; 
      }
      
      if (anyExceeds) return { allowed: false, reason: t('error.capacity_exceeded'), status: 'exceeds' };
      
      // Check Event Slots if event items present
      const hasEventItems = items.some(i => i.isEventProduct);
      if (hasEventItems) {
          const slot = settings.eventSlots?.find(s => s.date === date);
          if (!slot) return { allowed: false, reason: t('cart.event_only'), status: 'closed' }; // Only allowed on event days
          
          // Check event capacity
          let eventExceeds = false;
          for(const cat of catsToCheck) {
              const limit = slot.capacityOverrides?.[cat] ?? 0;
              if (limit > 0 && (eventLoad[cat] || 0) > limit) eventExceeds = true;
          }
          if (eventExceeds) return { allowed: false, reason: t('error.capacity_exceeded'), status: 'exceeds' };
      }

      return { allowed: true, status: 'available' };
  };

  const getDateStatus = (date: string, items: CartItem[]) => checkAvailability(date, items).status;

  const getDeliveryRegion = (zip: string) => settings.deliveryRegions.find(r => r.enabled && r.zips.includes(zip.replace(/\s/g,'')));
  
  const getRegionInfoForDate = (r: DeliveryRegion, d: string) => { 
      const ex = r.exceptions?.find(e => e.date === d); 
      return ex ? { isOpen: ex.isOpen, timeStart: ex.deliveryTimeStart, timeEnd: ex.deliveryTimeEnd, isException: true } : { isOpen: true, timeStart: r.deliveryTimeStart, timeEnd: r.deliveryTimeEnd, isException: false }; 
  };

  const getPickupPointInfo = (loc: PickupLocation, dateStr: string) => {
      const ex = loc.exceptions?.find(e => e.date === dateStr);
      if (ex) return { isOpen: ex.isOpen, timeStart: ex.deliveryTimeStart, timeEnd: ex.deliveryTimeEnd, isException: true };
      
      const day = new Date(dateStr).getDay();
      const config = loc.openingHours[day];
      if (!config || !config.isOpen) return { isOpen: false, isException: false };
      
      return { isOpen: true, timeStart: config.start, timeEnd: config.end, isException: false };
  };

  const getAvailableEventDates = (p: Product) => getAvailableEventDatesLogic(p, settings, orders, products);
  const isEventCapacityAvailable = (p: Product) => getAvailableEventDatesLogic(p, settings, orders, products).length > 0;

  // --- MISC ---
  const generateInvoice = (o: Order) => `INV-${o.id}`;
  const printInvoice = async (o: Order, type = 'proforma' | 'final') => {
      const doc = new jsPDF();
      doc.text(`Faktura ${o.id} (${type})`, 10, 10);
      doc.save(`faktura_${o.id}.pdf`);
  };
  
  const generateCzIban = calculateCzIban;

  // --- PWA ---
  const updatePwa = () => {
      if (swRegistration && swRegistration.waiting) {
          swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
          setIsPwaUpdateAvailable(false);
          window.location.reload();
      }
  };

  // --- PUSH ---
  const subscribeToPush = async () => {
      if (!swRegistration || !vapidPublicKey) return;
      try {
          const sub = await swRegistration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: vapidPublicKey
          });
          setPushSubscription(sub);
          if (dataSource === 'api') {
              await apiCall('/api/notifications/subscribe', 'POST', { subscription: sub });
          }
      } catch (e) {
          console.error("Push subscribe failed", e);
      }
  };

  const unsubscribeFromPush = async () => {
      if (!pushSubscription) return;
      await pushSubscription.unsubscribe();
      setPushSubscription(null);
      if (dataSource === 'api') {
          await apiCall('/api/notifications/unsubscribe', 'POST', { endpoint: pushSubscription.endpoint });
      }
  };

  // --- IMPORT ---
  const importDatabase = async (d: BackupData, s: any): Promise<ImportResult> => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/admin/import', 'POST', { data: d, selection: s });
          if (res && res.success) { await fetchData(); return { success: true }; }
          return { success: false, message: res?.error };
      } else {
          // Local logic...
          return { success: true };
      }
  };

  const refreshData = async () => {
      await fetchData();
  };

  return (
    <StoreContext.Provider value={{
      dataSource, setDataSource, isLoading, isOperationPending, dbConnectionError,
      isPreviewEnvironment, // Added here
      language, setLanguage, cart, cartBump, addToCart, removeFromCart, updateCartItemQuantity, clearCart,
      user, allUsers, login, logout, register, updateUser, updateUserAdmin, toggleUserBlock, sendPasswordReset, resetPasswordByToken, changePassword, addUser,
      orders, addOrder, updateOrderStatus, updateOrder, checkOrderRestoration: () => ({ valid: true, invalidCodes: [] }), searchOrders,
      products, addProduct, updateProduct, deleteProduct, searchProducts,
      discountCodes, appliedDiscounts, addDiscountCode, updateDiscountCode, deleteDiscountCode, applyDiscount, removeAppliedDiscount, validateDiscount,
      settings, updateSettings, dayConfigs, updateDayConfig, removeDayConfig,
      updateEventSlot, removeEventSlot, notifyEventSubscribers,
      rides, updateRide, printRouteSheet,
      checkAvailability, getDateStatus, getDailyLoad, getDeliveryRegion, getRegionInfoForDate, getPickupPointInfo, calculatePackagingFee,
      getAvailableEventDates, isEventCapacityAvailable,
      t, tData, generateInvoice, printInvoice, generateCzIban, removeDiacritics, formatDate, getImageUrl, getFullApiUrl, uploadImage,
      importDatabase, refreshData, globalNotification, dismissNotification,
      isAuthModalOpen, openAuthModal, closeAuthModal,
      cookieSettings, saveCookieSettings,
      isPwa, isPwaUpdateAvailable, updatePwa, appVersion: APP_VERSION,
      pushSubscription, subscribeToPush, unsubscribeFromPush, isPushSupported,
      searchUsers
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error('useStore must be used within a StoreProvider');
  return context;
};