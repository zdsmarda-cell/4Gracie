import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { 
  CartItem, Language, Product, User, Order, GlobalSettings, DayConfig, 
  OrderStatus, DiscountCode, AppliedDiscount, DeliveryRegion, 
  PackagingType, CompanyDetails, BackupData, PickupLocation, Ride, CookieSettings,
  OrdersSearchResult, EventSlot
} from '../types';
import { MOCK_ORDERS, PRODUCTS as INITIAL_PRODUCTS, DEFAULT_SETTINGS, EMPTY_SETTINGS } from '../constants';
import { TRANSLATIONS } from '../translations';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculatePackagingFeeLogic, calculateDailyLoad, getAvailableEventDatesLogic, calculateDiscountAmountLogic } from '../utils/orderLogic';
import { calculateCzIban, formatDate, removeDiacritics } from '../utils/helpers';

// IMPORT NEW LOGIC HOOKS
import { useRideLogic } from './slices/rideLogic';
import { useOrderLogic } from './slices/orderLogic';

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
  
  isPreviewEnvironment: boolean; 
  
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
    // Determine if we are in Production Build Environment
    let isProdBuild = false;
    try {
        // @ts-ignore
        if (import.meta && import.meta.env && import.meta.env.PROD) {
            isProdBuild = true;
        }
    } catch (e) {
        // Ignore errors if import.meta is undefined
    }

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isProdBuild && !isLocalhost) {
        return 'api';
    }
    
    return (localStorage.getItem('app_data_source') as DataSourceMode) || 'local';
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isOperationPending, setIsOperationPending] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
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
  const t = useCallback((key: string, params?: Record<string, string>) => {
    const langKey = language as Language;
    let text = TRANSLATIONS[langKey]?.[key] || TRANSLATIONS[Language.CS]?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  }, [language]);

  const tData = (item: any, field: string) => {
    if (!item) return '';
    if (language === Language.CS) return item[field];
    return item.translations?.[language]?.[field] || item[field];
  };

  const setDataSource = (mode: DataSourceMode) => {
    localStorage.setItem('app_data_source', mode);
    setDataSourceState(mode);
    setIsInitialized(false);
  };

  const showNotify = (message: string, type: 'success' | 'error' = 'success', autoClose: boolean = true) => {
    setGlobalNotification({ message, type, autoClose });
  };

  const getFullApiUrl = useCallback((endpoint: string) => {
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
  }, []);

  const getImageUrl = (path?: string, size: 'original' | 'medium' | 'small' = 'original') => {
      if (!path) return '';
      if (path.startsWith('data:') || path.startsWith('http')) return path;
      if (size !== 'original') {
          const parts = path.split('.');
          if (parts.length > 1) {
              const ext = parts.pop();
              const base = parts.join('.');
              const newPath = `${base}-${size}.webp`;
              return getFullApiUrl(newPath);
          }
      }
      return getFullApiUrl(path);
  };

  const logout = useCallback(() => { 
      setUser(null); 
      localStorage.removeItem('session_user');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
  }, []);

  const apiCall = useCallback(async (endpoint: string, method: string, body?: any) => {
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
          throw new Error("Server returned invalid data (HTML instead of JSON). Maintenance?");
      }
      
      if (res.status === 401) {
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
      // Force error in PROD env only if NOT localhost (preview)
      // @ts-ignore
      const isProd = import.meta?.env?.PROD;
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if ((isProd && !isLocalhost) || e.message === 'TIMEOUT_LIMIT_REACHED' || e.message.includes('fetch failed')) {
         setDbConnectionError(true);
      } 
      console.warn(`[API] Call to ${endpoint} failed:`, e);
      return null;
    } finally {
        setIsOperationPending(false); 
    }
  }, [getFullApiUrl, logout]);

  // --- USE EXTRACTED LOGIC HOOKS ---
  const { updateRide, printRouteSheet } = useRideLogic({ 
    dataSource, apiCall, setRides, orders, products, settings, showNotify 
  });

  const { addOrder, updateOrder, updateOrderStatus, searchOrders } = useOrderLogic({
    dataSource, apiCall, setOrders, setRides, rides, language, settings, showNotify, t
  });

  const fetchData = async () => {
      setIsLoading(true);
      try {
        if (dataSource === 'api') {
          // Reset data
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
              setRides(data.rides || []);
              
              if (data.vapidPublicKey) setVapidPublicKey(data.vapidPublicKey);
          }
        } else {
          // Local Mode
          // @ts-ignore
          const isProd = import.meta?.env?.PROD;
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

          if (isProd && !isLocalhost) {
              // In Real Production, we should NOT fall back to local storage if API fails.
              setDbConnectionError(true);
              return;
          }

          let loadedUsers = loadFromStorage('db_users', [] as User[]);
          if (!loadedUsers || loadedUsers.length === 0) loadedUsers = INITIAL_USERS;
          setAllUsers(loadedUsers);

          let loadedProducts = loadFromStorage('db_products', [] as Product[]);
          if (!loadedProducts || loadedProducts.length === 0) loadedProducts = INITIAL_PRODUCTS;
          setProducts(loadedProducts);
          
          let loadedOrders = loadFromStorage('db_orders', [] as Order[]);
          if (!loadedOrders || loadedOrders.length === 0) loadedOrders = MOCK_ORDERS;
          setOrders(loadedOrders);
          
          const loadedSettings = loadFromStorage('db_settings', DEFAULT_SETTINGS);
          if (!loadedSettings.categories) loadedSettings.categories = DEFAULT_SETTINGS.categories;
          if (!loadedSettings.pickupLocations) loadedSettings.pickupLocations = DEFAULT_SETTINGS.pickupLocations;
          
          setSettings(loadedSettings);
          setDiscountCodes(loadFromStorage('db_discounts', []));
          setDayConfigs(loadFromStorage('db_dayconfigs', []));
          setRides(loadFromStorage('db_rides', []));
          
          showNotify("Přepnuto na lokální paměť (Mock Data).", 'success');
        }
      } catch (err: any) {
        console.error("Fetch Data Error", err);
        // @ts-ignore
        const isProd = import.meta?.env?.PROD;
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isProd && !isLocalhost) setDbConnectionError(true);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
  };

  useEffect(() => {
    fetchData();
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
        setIsPwa(true);
    }
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        setIsPushSupported(true);
    }
  }, [dataSource]);

  useEffect(() => {
      if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
              setSwRegistration(registration);
              registration.pushManager.getSubscription().then(sub => {
                  setPushSubscription(sub);
              });
          });
          
          navigator.serviceWorker.addEventListener('controllerchange', () => {
             window.location.reload();
          });
      }
  }, []);

  useEffect(() => localStorage.setItem('cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('session_user', JSON.stringify(user)), [user]);
  
  useEffect(() => {
    if (dataSource === 'local' && isInitialized) {
      localStorage.setItem('db_users', JSON.stringify(allUsers));
      localStorage.setItem('db_orders', JSON.stringify(orders));
      localStorage.setItem('db_products', JSON.stringify(products));
      localStorage.setItem('db_discounts', JSON.stringify(discountCodes));
      localStorage.setItem('db_settings', JSON.stringify(settings));
      localStorage.setItem('db_dayconfigs', JSON.stringify(dayConfigs));
      localStorage.setItem('db_rides', JSON.stringify(rides));
    }
  }, [allUsers, orders, products, discountCodes, settings, dayConfigs, rides, dataSource, isInitialized]);

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

  useEffect(() => {
    if (appliedDiscounts.length === 0) return;
    let updatedDiscounts: AppliedDiscount[] = [];
    let removedCodes: string[] = [];
    
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

  const searchProducts = useCallback(async (filters: any) => {
      if (dataSource === 'api') {
          const q = new URLSearchParams(filters).toString();
          const res = await apiCall(`/api/products?${q}`, 'GET');
          if (res && res.success) return res;
          return { products: [], total: 0, page: 1, pages: 1 };
      } else {
          return { products: products, total: products.length, page: 1, pages: 1 };
      }
  }, [dataSource, apiCall, products]);

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

  const updateUser = async (u: User) => {
      const res = await apiCall('/api/users', 'POST', u); 
      if (res || dataSource === 'local') {
          setUser(u);
          setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
          return true;
      }
      return false;
  };
  
  const updateUserAdmin = async (u: User) => {
      return updateUser(u); 
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
      const u = { ...user, passwordHash: hashPassword(newP) };
      await updateUser(u);
      return { success: true, message: 'Heslo změněno' };
  };

  const searchUsers = useCallback(async (filters: any) => {
      if (dataSource === 'api') {
          const q = new URLSearchParams(filters).toString();
          const res = await apiCall(`/api/users?${q}`, 'GET');
          if (res && res.success) return res.users;
          return [];
      }
      return allUsers; 
  }, [dataSource, apiCall, allUsers]);

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
          if (!slot) return { allowed: false, reason: t('cart.event_only'), status: 'closed' }; 
          
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
  
  // Helper to fetch font buffer for PDF
  const fetchFont = async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load font: ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      // Browser-safe base64 conversion
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
  };

  const printInvoice = async (o: Order, type: 'proforma' | 'final' = 'proforma') => {
      const doc = new jsPDF();
      
      // 1. LOAD FONT (Roboto)
      try {
          const regularBase64 = await fetchFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf');
          const mediumBase64 = await fetchFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf');
          
          doc.addFileToVFS("Roboto-Regular.ttf", regularBase64);
          doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
          
          doc.addFileToVFS("Roboto-Medium.ttf", mediumBase64);
          doc.addFont("Roboto-Medium.ttf", "Roboto", "bold");
          
          doc.setFont("Roboto");
      } catch (e) {
          console.error("Font loading failed", e);
      }
      
      // DATA SNAPSHOT
      const comp = (type === 'final' ? o.deliveryCompanyDetailsSnapshot : o.companyDetailsSnapshot) || settings.companyDetails;
      const dateToUse = type === 'final' ? (o.finalInvoiceDate || o.createdAt) : o.createdAt;
      const isVatPayer = !!comp.dic && comp.dic.length > 0;
      // FIX: Explicit typing for Color tuple
      const brandColor: [number, number, number] = [147, 51, 234]; // Purple #9333ea
      
      // HEADER
      doc.setFontSize(20);
      doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
      doc.setFont("Roboto", "bold");
      doc.text(type === 'final' ? (isVatPayer ? "FAKTURA - DAŇOVÝ DOKLAD" : "FAKTURA") : "ZÁLOHOVÁ FAKTURA", 105, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.setFont("Roboto", "normal");
      doc.text(`Číslo: ${o.id}`, 105, 28, { align: "center" });
      doc.text(`Datum vystavení: ${formatDate(dateToUse)}`, 105, 34, { align: "center" });
      if (isVatPayer && type === 'final') doc.text(`Datum zdan. plnění: ${formatDate(dateToUse)}`, 105, 40, { align: "center" });

      // PARTIES
      doc.setFontSize(11);
      doc.setFont("Roboto", "bold");
      doc.text("DODAVATEL:", 14, 55);
      doc.text("ODBĚRATEL:", 110, 55);
      doc.setFontSize(10);
      doc.setFont("Roboto", "normal");
      
      let y = 60;
      doc.text(comp.name, 14, y); y+=5;
      doc.text(comp.street, 14, y); y+=5;
      doc.text(`${comp.zip} ${comp.city}`, 14, y); y+=5;
      doc.text(`IČ: ${comp.ic}`, 14, y); y+=5;
      if(comp.dic) { doc.text(`DIČ: ${comp.dic}`, 14, y); y+=5; }
      if(comp.bankAccount) { doc.text(`Účet: ${comp.bankAccount}`, 14, y); y+=5; }
      const vs = o.id.replace(/\D/g, '');
      if(vs) { doc.text(`VS: ${vs}`, 14, y); y+=5; }
      
      y = 60;
      doc.text(o.billingName || o.userName || 'Zákazník', 110, y); y+=5;
      doc.text(o.billingStreet || '', 110, y); y+=5;
      doc.text(`${o.billingZip || ''} ${o.billingCity || ''}`, 110, y); y+=5;
      if (o.billingIc) { doc.text(`IČ: ${o.billingIc}`, 110, y); y+=5; }
      if (o.billingDic) { doc.text(`DIČ: ${o.billingDic}`, 110, y); y+=5; }

      // --- CALCULATIONS START ---
      const getBase = (priceWithVat: number, rate: number) => priceWithVat / (1 + rate / 100);
      const getVat = (priceWithVat: number, rate: number) => priceWithVat - getBase(priceWithVat, rate);

      const grossTotalsByRate: Record<number, number> = {};
      
      // 1. ITEMS VAT
      let maxVatRate = 0;
      o.items.forEach(item => {
          const rate = Number(item.vatRateTakeaway || 0);
          const lineTotal = item.price * item.quantity;
          grossTotalsByRate[rate] = (grossTotalsByRate[rate] || 0) + lineTotal;
          if (rate > maxVatRate) maxVatRate = rate;
      });

      // 2. FEES VAT (Inherit max rate)
      const feeVatRate = maxVatRate;
      if (o.packagingFee > 0) grossTotalsByRate[feeVatRate] = (grossTotalsByRate[feeVatRate] || 0) + o.packagingFee;
      if (o.deliveryFee > 0) grossTotalsByRate[feeVatRate] = (grossTotalsByRate[feeVatRate] || 0) + o.deliveryFee;

      const grandGrossTotal = Object.values(grossTotalsByRate).reduce((a, b) => a + b, 0);
      const totalDiscount = o.appliedDiscounts?.reduce((a, b) => a + b.amount, 0) || 0;
      
      // Proportional Discount Ratio
      const discountRatio = grandGrossTotal > 0 ? (totalDiscount / grandGrossTotal) : 0;

      // Tax Summary Calculation
      const taxSummary: any = {};
      Object.keys(grossTotalsByRate).forEach(k => {
          const r = Number(k);
          const gross = grossTotalsByRate[r];
          const netAtRate = gross * (1 - discountRatio); // Reduce by discount ratio
          
          taxSummary[r] = {
              total: netAtRate,
              base: getBase(netAtRate, r),
              vat: netAtRate - getBase(netAtRate, r)
          };
      });

      // --- TABLE GENERATION ---
      const rows: any[] = [];
      
      // Items
      o.items.forEach(item => {
          const lineTotal = item.price * item.quantity;
          const rate = Number(item.vatRateTakeaway || 0);
          
          const row = [
              item.name,
              item.quantity,
              isVatPayer ? getBase(item.price, rate).toFixed(2) : item.price.toFixed(2)
          ];
          if (isVatPayer) { 
              row.push(`${rate}%`); 
              row.push(getVat(lineTotal, rate).toFixed(2)); 
          }
          row.push(lineTotal.toFixed(2));
          rows.push(row);
      });

      // Fees rows
      if (o.packagingFee > 0) {
          const row = ['Balné', '1', isVatPayer ? getBase(o.packagingFee, feeVatRate).toFixed(2) : o.packagingFee.toFixed(2)];
          if (isVatPayer) { row.push(`${feeVatRate}%`); row.push(getVat(o.packagingFee, feeVatRate).toFixed(2)); }
          row.push(o.packagingFee.toFixed(2));
          rows.push(row);
      }
      if (o.deliveryFee > 0) {
          const row = ['Doprava', '1', isVatPayer ? getBase(o.deliveryFee, feeVatRate).toFixed(2) : o.deliveryFee.toFixed(2)];
          if (isVatPayer) { row.push(`${feeVatRate}%`); row.push(getVat(o.deliveryFee, feeVatRate).toFixed(2)); }
          row.push(o.deliveryFee.toFixed(2));
          rows.push(row);
      }

      // Discount rows (display only, math handled via ratio)
      o.appliedDiscounts?.forEach(d => {
          const row = [`Sleva ${d.code}`, '1', `-${d.amount.toFixed(2)}`];
          if (isVatPayer) { row.push(''); row.push(''); }
          row.push(`-${d.amount.toFixed(2)}`);
          rows.push(row);
      });

      autoTable(doc, {
          startY: 100,
          head: [isVatPayer ? ['Položka', 'Ks', 'Základ/ks', 'DPH %', 'DPH Celkem', 'Celkem'] : ['Položka', 'Ks', 'Cena/ks', 'Celkem']],
          body: rows,
          theme: 'grid',
          styles: { font: 'Roboto', fontSize: 9, lineColor: [200, 200, 200] },
          headStyles: { fillColor: brandColor, textColor: [255, 255, 255], fontStyle: 'bold' },
          columnStyles: isVatPayer ? {
              0: { cellWidth: 'auto' }, 1: { halign: 'center' }, 2: { halign: 'right' },
              3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' }
          } : {
              0: { cellWidth: 'auto' }, 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' }
          }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 10;

      // VAT RECAP (If Payer)
      if (isVatPayer) {
          doc.text("Rekapitulace DPH", 14, finalY);
          
          const vatRows = Object.keys(taxSummary).map(rate => {
              const r = Number(rate);
              const s = taxSummary[r];
              if (Math.abs(s.total) < 0.01) return null;
              return [`${r}%`, s.base.toFixed(2), s.vat.toFixed(2), s.total.toFixed(2)];
          }).filter(Boolean);

          autoTable(doc, {
              startY: finalY + 5,
              head: [['Sazba', 'Základ', 'Daň', 'Celkem']],
              body: vatRows,
              theme: 'striped',
              styles: { font: 'Roboto', fontSize: 8 },
              headStyles: { fillColor: [100, 100, 100] },
              margin: { left: 14, right: 100 }
          });
          finalY = (doc as any).lastAutoTable.finalY + 10;
      }

      // TOTAL
      const grandTotal = Math.max(0, grandGrossTotal - totalDiscount);
      
      doc.setFontSize(14);
      doc.setFont("Roboto", "bold");
      doc.setTextColor(brandColor[0], brandColor[1], brandColor[2]);
      doc.text(`CELKEM K ÚHRADĚ: ${grandTotal.toFixed(2)} Kč`, 190, finalY, { align: "right" });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont("Roboto", "normal");

      if (type === 'final') {
          doc.text("NEPLATIT - Již uhrazeno zálohovou fakturou.", 190, finalY + 7, { align: "right" });
      } else {
        // QR Code without text details
        try {
            if (comp.bankAccount) {
              const vs = o.id.replace(/\D/g, '');
              const iban = calculateCzIban(comp.bankAccount);
              const bic = comp.bic ? `+${comp.bic}` : '';
              const qrString = `SPD*1.0*ACC:${iban}${bic}*AM:${grandTotal.toFixed(2)}*CC:CZK*X-VS:${vs}*MSG:OBJ${o.id}`;
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrString)}`;
              const qrResp = await fetch(qrUrl);
              const qrBuf = await qrResp.arrayBuffer();
              
              let binary = '';
              const bytes = new Uint8Array(qrBuf);
              const len = bytes.byteLength;
              for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const qrBase64 = window.btoa(binary);
              
              doc.addImage(qrBase64, "PNG", 160, finalY + 10, 30, 30);
              doc.setFontSize(8);
              doc.text("QR Platba", 175, finalY + 44, { align: "center" });
            }
        } catch (e) { console.error("QR Code generation failed:", e); }
    }
    doc.save(`${type === 'final' ? 'Faktura' : 'Zaloha'}_${o.id}.pdf`);
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
          return { success: true };
      }
  };

  const refreshData = async () => {
      await fetchData();
  };
  
  const uploadImage = async (base64: string, name: string): Promise<string> => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/admin/upload', 'POST', { image: base64, name });
          if (res && res.success) return res.url;
          throw new Error(res?.error || 'Upload failed');
      }
      return base64;
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