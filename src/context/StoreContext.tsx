import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import { CartItem, Language, Product, User, Order, GlobalSettings, DayConfig, ProductCategory, OrderStatus, PaymentMethod, DiscountCode, DiscountType, AppliedDiscount, DeliveryRegion, PackagingType, CompanyDetails, BackupData, PickupLocation, CookieSettings, EventSlot, OrdersSearchResult, EmailLog, DataSourceMode } from '../types';
import { PRODUCTS as INITIAL_PRODUCTS, DEFAULT_SETTINGS, EMPTY_SETTINGS, MOCK_ORDERS } from '../constants';
import { TRANSLATIONS } from '../translations';
import { calculatePackagingFeeLogic, calculateDiscountAmountLogic, getAvailableEventDatesLogic, calculateDailyLoad } from '../utils/orderLogic';
import { generateInvoicePdf } from '../utils/pdfGenerator';
import { removeDiacritics, formatDate, calculateCzIban } from '../utils/helpers';

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
  updateOrderStatus: (orderIds: string[], status: OrderStatus, sendNotify?: boolean) => Promise<boolean>;
  updateOrder: (order: Order, sendNotify?: boolean, isUserEdit?: boolean) => Promise<boolean>;
  checkOrderRestoration: (order: Order) => RestorationCheckResult;
  searchOrders: (params: any) => Promise<OrdersSearchResult>;
  searchUsers: (params: any) => Promise<User[]>;
  
  products: Product[];
  addProduct: (product: Product) => Promise<boolean>;
  updateProduct: (product: Product) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  uploadImage: (base64Data: string, fileName: string) => Promise<string>;
  
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
  
  checkAvailability: (date: string, cartItems: CartItem[], excludeOrderId?: string) => CheckResult;
  getDateStatus: (date: string, cartItems: CartItem[]) => DayStatus;
  getDailyLoad: (date: string, excludeOrderId?: string) => Record<string, any>;
  getDeliveryRegion: (zip: string) => DeliveryRegion | undefined;
  getRegionInfoForDate: (region: DeliveryRegion, date: string) => RegionDateInfo;
  getPickupPointInfo: (location: PickupLocation, date: string) => RegionDateInfo;
  calculatePackagingFee: (items: CartItem[]) => number;
  getAvailableEventDates: (product: Product) => string[];
  isEventCapacityAvailable: (product: Product) => boolean;
  getFullApiUrl: (endpoint: string) => string;
  
  t: (key: string, params?: Record<string, string>) => string;
  tData: (item: any, key: string) => string;
  generateInvoice: (order: Order) => string;
  printInvoice: (order: Order, type?: 'proforma' | 'final') => Promise<void>;
  generateCzIban: (accountStr: string) => string;
  removeDiacritics: (str: string) => string;
  formatDate: (dateStr: string) => string;
  getImageUrl: (url?: string) => string;
  
  importDatabase: (data: BackupData, selection: Record<string, boolean>) => Promise<ImportResult>;
  
  globalNotification: GlobalNotification | null;
  dismissNotification: () => void;

  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;

  cookieSettings: CookieSettings | null;
  saveCookieSettings: (settings: CookieSettings) => void;
  isPreviewEnvironment: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const hashPassword = (pwd: string) => `hashed_${btoa(pwd)}`;

const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
};

const INITIAL_USERS: User[] = [
  { id: 'admin1', name: 'Admin User', email: 'info@4gracie.cz', phone: '+420123456789', role: 'admin', billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword('1234') },
  { id: 'user1', name: 'Jan Novák', email: 'jan.novak@example.com', phone: '+420987654321', role: 'customer', billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword('1234'), marketingConsent: true }
];

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // @ts-ignore
  const safeEnv = (import.meta && import.meta.env) ? import.meta.env : {} as any;
  const isProduction = safeEnv.PROD || false;
  const isPreviewEnvironment = safeEnv.MODE !== 'production';

  const [dataSource, setDataSourceState] = useState<DataSourceMode>(() => {
    // Force API in production
    if (isProduction) {
        return 'api';
    }
    return (localStorage.getItem('app_data_source') as DataSourceMode) || 'local';
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isOperationPending, setIsOperationPending] = useState(false);
  const [dbConnectionError, setDbConnectionError] = useState(false);
  const [language, setLanguage] = useState<Language>(Language.CS);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [globalNotification, setGlobalNotification] = useState<GlobalNotification | null>(null);
  
  const [cookieSettings, setCookieSettings] = useState<CookieSettings | null>(() => loadFromStorage('cookie_settings', null));

  const t = (key: string, params?: Record<string, string>) => {
    let text = TRANSLATIONS[language]?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  const tData = (item: any, key: string): string => {
      if (!item) return '';
      // Try translation first
      if (item.translations && item.translations[language] && item.translations[language][key]) {
          return item.translations[language][key];
      }
      // Fallback to base
      return item[key] || '';
  };

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

  const setDataSource = (mode: DataSourceMode) => {
    if (isProduction && mode === 'local') {
        console.warn("Local mode is strictly forbidden in production.");
        return;
    }
    localStorage.setItem('app_data_source', mode);
    setDataSourceState(mode);
  };

  const showNotify = (message: string, type: 'success' | 'error' = 'success', autoClose: boolean = true) => {
    setGlobalNotification({ message, type, autoClose });
  };

  const getFullApiUrl = (endpoint: string) => {
    // @ts-ignore
    const env = (import.meta && import.meta.env) ? import.meta.env : {} as any;
    
    if (env.DEV) return endpoint;
    
    let baseUrl = env.VITE_API_URL;
    if (!baseUrl) {
       // Robust fallback for preview/production if env var is missing
       const proto = window.location.protocol.startsWith('http') ? window.location.protocol : 'http:';
       const host = window.location.hostname || 'localhost';
       baseUrl = `${proto}//${host}:3000`;
    }
    if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
    }
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
  };

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
      
      const res: any = await Promise.race([
        fetch(url, {
          method,
          headers: { 
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        }),
        timeoutPromise
      ]);
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
          if (res.status === 401 || res.status === 403) throw new Error("Neautorizovaný přístup.");
          throw new Error("Server vrátil neplatná data.");
      }
      
      if (!res.ok) {
          if (res.status === 401) localStorage.removeItem('auth_token');
          throw new Error(`API Chyba: ${res.status} ${res.statusText}`);
      }
      
      const json = await res.json();
      setDbConnectionError(false);
      return json;
    } catch (e: any) {
      console.warn(`[API] Call to ${endpoint} failed:`, e);
      if (e.message === 'TIMEOUT_LIMIT_REACHED' || e.name === 'AbortError' || e.message.includes('Failed to fetch')) {
         showNotify('Server neodpovídá.', 'error');
         setDbConnectionError(true);
      } else {
         showNotify(`Chyba: ${e.message || 'Neznámá chyba'}`, 'error');
      }
      return null;
    } finally {
        setIsOperationPending(false); 
    }
  }, []);

  const fetchData = async () => {
      setIsLoading(true);
      try {
        if (dataSource === 'api') {
          setAllUsers([]);
          setProducts([]);
          setOrders([]);
          setDiscountCodes([]);
          setDayConfigs([]);
          setSettings(EMPTY_SETTINGS);
          const data = await apiCall('/api/bootstrap', 'GET');
          if (data) {
              setAllUsers(data.users || []);
              setProducts(data.products || []);
              setOrders(data.orders || []);
              if (data.settings) {
                 const mergedSettings = { ...DEFAULT_SETTINGS, ...data.settings };
                 // Ensure arrays exist
                 if (!mergedSettings.categories) mergedSettings.categories = DEFAULT_SETTINGS.categories;
                 if (!mergedSettings.pickupLocations) mergedSettings.pickupLocations = DEFAULT_SETTINGS.pickupLocations;
                 if (!mergedSettings.capacityCategories) mergedSettings.capacityCategories = [];
                 if (!mergedSettings.eventSlots) mergedSettings.eventSlots = [];
                 setSettings(mergedSettings); 
              }
              setDiscountCodes(data.discountCodes || []);
              setDayConfigs(data.dayConfigs || []);
              // showNotify("Připojeno k databázi.", 'success');
          }
        } else {
          setAllUsers(loadFromStorage('db_users', INITIAL_USERS));
          setProducts(loadFromStorage('db_products', INITIAL_PRODUCTS));
          setOrders(loadFromStorage('db_orders', MOCK_ORDERS));
          
          const loadedSettings = loadFromStorage('db_settings', DEFAULT_SETTINGS);
          if (!loadedSettings.categories) loadedSettings.categories = DEFAULT_SETTINGS.categories;
          if (!loadedSettings.pickupLocations) loadedSettings.pickupLocations = DEFAULT_SETTINGS.pickupLocations;
          if (!loadedSettings.capacityCategories) loadedSettings.capacityCategories = [];
          if (!loadedSettings.eventSlots) loadedSettings.eventSlots = [];
          
          setSettings(loadedSettings);
          setDiscountCodes(loadFromStorage('db_discounts', []));
          setDayConfigs(loadFromStorage('db_dayconfigs', []));
          // showNotify("Přepnuto na lokální paměť.", 'success');
        }
      } catch (err: any) {
        showNotify('Kritická chyba při načítání aplikace: ' + err.message, 'error');
      } finally {
        setIsLoading(false);
      }
  };

  useEffect(() => {
    fetchData();
  }, [dataSource]);

  useEffect(() => localStorage.setItem('cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('session_user', JSON.stringify(user)), [user]);
  useEffect(() => localStorage.setItem('cookie_settings', JSON.stringify(cookieSettings)), [cookieSettings]);
  
  useEffect(() => {
    if (dataSource === 'local') {
      localStorage.setItem('db_users', JSON.stringify(allUsers));
      localStorage.setItem('db_orders', JSON.stringify(orders));
      localStorage.setItem('db_products', JSON.stringify(products));
      localStorage.setItem('db_discounts', JSON.stringify(discountCodes));
      localStorage.setItem('db_settings', JSON.stringify(settings));
      localStorage.setItem('db_dayconfigs', JSON.stringify(dayConfigs));
    }
  }, [allUsers, orders, products, discountCodes, settings, dayConfigs, dataSource]);

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);
  const dismissNotification = () => setGlobalNotification(null);
  const saveCookieSettings = (s: CookieSettings) => setCookieSettings(s);

  const getImageUrl = (url?: string) => {
      if (!url) return '';
      if (url.startsWith('http')) return url;
      if (url.startsWith('data:')) return url;
      // Local or API path
      const base = getFullApiUrl('');
      return `${base.endsWith('/') ? base.slice(0,-1) : base}${url.startsWith('/') ? url : '/'+url}`;
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
    // Notification removed as per request
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
    
    // In local mode or general validation, we need full order history for discount usage checks.
    // However, for cart validation we often just check properties. Usage checks might fail if orders not fully loaded in API mode.
    // For simplicity, we use loaded orders.
    
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
      if (removedCodes.length > 0) showNotify(`Slevový kupon ${removedCodes.join(', ')} byl odebrán.`, 'error');
    }
  }, [cart]);

  // --- CRUD OPERATIONS ---

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
        // In API mode, we should ideally fetch again, but for UX we optimistic update
        // However, fetching ensures we get server-generated fields if any
        await fetchData(); 
        return true;
      }
      return false;
    } else {
      setOrders(prev => [orderWithHistory, ...prev]);
      return true;
    }
  };

  const updateOrder = async (order: Order, sendNotify?: boolean, isUserEdit?: boolean): Promise<boolean> => {
    let updatedOrder = { ...order };
    if (updatedOrder.items.length === 0) {
      updatedOrder.status = OrderStatus.CANCELLED;
    }
    // If status changed locally, add history? (Handled in backend or manually)
    
    if (dataSource === 'api') {
       const res = await apiCall('/api/orders', 'POST', { ...updatedOrder, sendNotify });
       if (res && res.success) {
          await fetchData();
          showNotify('Objednávka aktualizována.');
          return true;
       }
       return false;
    } else {
       setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
       showNotify('Objednávka aktualizována.');
       return true;
    }
  };

  const updateOrderStatus = async (ids: string[], status: OrderStatus, notify?: boolean): Promise<boolean> => {
    if (dataSource === 'api') {
       const res = await apiCall('/api/orders/status', 'PUT', { ids, status, notifyCustomer: notify });
       if (res && res.success) {
          await fetchData();
          if (notify) showNotify(`Stav změněn a emaily odeslány (${ids.length})`);
          else showNotify(`Stav změněn (${ids.length})`);
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
        showNotify(`Stav změněn (${ids.length})`);
        return true;
    }
  };

  const searchOrders = async (params: any): Promise<OrdersSearchResult> => {
      if (dataSource === 'api') {
          const query = new URLSearchParams(params).toString();
          const res = await apiCall(`/api/orders?${query}`, 'GET');
          if (res && res.success) return res;
          return { orders: [], total: 0, page: 1, pages: 1 };
      } else {
          // Local Filtering Logic (Simplified)
          let filtered = orders.filter(o => {
              if (params.id && !o.id.includes(params.id)) return false;
              if (params.userId && o.userId !== params.userId) return false;
              // ... other filters
              return true;
          });
          const start = ((params.page || 1) - 1) * (params.limit || 50);
          const paged = filtered.slice(start, start + (params.limit || 50));
          return { orders: paged, total: filtered.length, page: params.page || 1, pages: Math.ceil(filtered.length / (params.limit || 50)) };
      }
  };

  const searchUsers = async (params: any): Promise<User[]> => {
      if (dataSource === 'api') {
          const query = new URLSearchParams(params).toString();
          const res = await apiCall(`/api/users?${query}`, 'GET');
          if (res && res.success) return res.users;
          return [];
      } else {
          return allUsers;
      }
  };

  const addProduct = async (p: Product): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/products', 'POST', p);
        if (res && res.success) { await fetchData(); showNotify('Produkt uložen.'); return true; }
        return false;
    } else {
        setProducts(prev => [...prev, p]); return true;
    }
  };

  const updateProduct = async (p: Product): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/products', 'POST', p);
        if (res && res.success) { await fetchData(); showNotify('Produkt aktualizován.'); return true; }
        return false;
    } else {
        setProducts(prev => prev.map(x => x.id === p.id ? p : x)); return true;
    }
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall(`/api/products/${id}`, 'DELETE');
        if (res && res.success) { await fetchData(); showNotify('Produkt smazán.'); return true; }
        return false;
    } else {
        setProducts(prev => prev.filter(x => x.id !== id)); return true;
    }
  };

  const uploadImage = async (base64Data: string, fileName: string): Promise<string> => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/admin/upload', 'POST', { image: base64Data, name: fileName });
          if (res && res.success) return res.url;
          throw new Error('Upload failed');
      } else {
          return base64Data; // Local mode keeps base64
      }
  };

  const addUser = async (name: string, email: string, phone: string, role: 'customer' | 'admin' | 'driver'): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/users', 'POST', { id: Date.now().toString(), name, email, phone, role, isBlocked: false, marketingConsent: false, passwordHash: hashPassword('1234') });
        if (res && res.success) { await fetchData(); return true; }
        return false;
    } else {
        setAllUsers(prev => [...prev, { id: Date.now().toString(), name, email, phone, role, billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword('1234'), marketingConsent: false }]);
        return true;
    }
  };

  const updateUser = async (u: User): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/users', 'POST', u);
        if (res && res.success) {
            setUser(u); // Update session user immediately
            // Optionally fetch data if critical parts changed
            return true;
        }
        return false;
    } else {
        setUser(u);
        setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
        return true;
    }
  };

  const updateUserAdmin = async (u: User): Promise<boolean> => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/users', 'POST', u);
          if (res && res.success) { await fetchData(); return true; }
          return false;
      } else {
          setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
          if (user && user.id === u.id) setUser(u);
          return true;
      }
  };

  const updateSettings = async (s: GlobalSettings): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/settings', 'POST', s);
        if (res && res.success) { setSettings(s); showNotify('Nastavení uloženo.'); return true; }
        return false;
    } else {
        setSettings(s); return true;
    }
  };

  const updateDayConfig = async (c: DayConfig): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/calendar', 'POST', c);
        if (res && res.success) { await fetchData(); showNotify('Kalendář aktualizován.'); return true; }
        return false;
    } else {
        setDayConfigs(prev => { const exists = prev.find(d => d.date === c.date); return exists ? prev.map(d => d.date === c.date ? c : d) : [...prev, c]; });
        return true;
    }
  };

  const removeDayConfig = async (date: string): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall(`/api/calendar/${date}`, 'DELETE');
        if (res && res.success) { await fetchData(); return true; }
        return false;
    } else {
        setDayConfigs(prev => prev.filter(d => d.date !== date)); return true;
    }
  };

  const addDiscountCode = async (c: DiscountCode): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/discounts', 'POST', c);
        if (res && res.success) { await fetchData(); return true; }
        return false;
    } else {
        setDiscountCodes(prev => [...prev, c]); return true;
    }
  };

  const updateDiscountCode = async (code: DiscountCode): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/discounts', 'POST', code);
        if (res && res.success) { await fetchData(); return true; }
        return false;
    } else {
        setDiscountCodes(prev => prev.map(x => x.id === code.id ? code : x)); return true;
    }
  };

  const deleteDiscountCode = async (id: string): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall(`/api/discounts/${id}`, 'DELETE');
        if (res && res.success) { await fetchData(); return true; }
        return false;
    } else {
        setDiscountCodes(prev => prev.filter(x => x.id !== id)); return true;
    }
  };

  // --- EVENTS ---
  const updateEventSlot = async (slot: EventSlot): Promise<boolean> => {
      const newSlots = [...(settings.eventSlots || [])];
      const index = newSlots.findIndex(s => s.date === slot.date);
      if (index >= 0) newSlots[index] = slot; else newSlots.push(slot);
      return await updateSettings({ ...settings, eventSlots: newSlots });
  };

  const removeEventSlot = async (date: string): Promise<boolean> => {
      const newSlots = (settings.eventSlots || []).filter(s => s.date !== date);
      return await updateSettings({ ...settings, eventSlots: newSlots });
  };

  const notifyEventSubscribers = async (date: string): Promise<boolean> => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/admin/notify-event', 'POST', { date });
          if (res && res.success) { showNotify(`Notifikace odeslána ${res.count} odběratelům.`); return true; }
          return false;
      }
      showNotify('Notifikace simulována (Lokální režim).');
      return true;
  };

  const isEventCapacityAvailable = (product: Product): boolean => {
      return getAvailableEventDatesLogic(product, settings, orders, products).length > 0;
  };

  const getAvailableEventDates = (product: Product): string[] => {
      return getAvailableEventDatesLogic(product, settings, orders, products);
  };

  // --- HELPERS WRAPPERS ---
  const calculatePackagingFee = (items: CartItem[]) => calculatePackagingFeeLogic(items, settings.packaging.types, settings.packaging.freeFrom);
  
  const getDailyLoad = (date: string, excludeOrderId?: string) => {
      const relevantOrders = orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED && o.id !== excludeOrderId);
      return calculateDailyLoad(relevantOrders, products, settings);
  };

  const checkAvailability = (date: string, items: CartItem[], excludeOrderId?: string): CheckResult => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date); targetDate.setHours(0, 0, 0, 0);
    
    // Past check
    if (targetDate < today) return { allowed: false, reason: t('error.past'), status: 'past' };
    
    // Check Day Config (Holiday/Closed)
    const config = dayConfigs.find(d => d.date === date);
    if (config && !config.isOpen) return { allowed: false, reason: t('error.day_closed'), status: 'closed' };

    // Check Lead Time
    const maxLeadTime = items.length > 0 ? Math.max(...items.map(i => i.leadTimeDays || 0)) : 0;
    const minPossibleDate = new Date(today); minPossibleDate.setDate(minPossibleDate.getDate() + maxLeadTime);
    if (targetDate < minPossibleDate) return { allowed: false, reason: t('error.too_soon'), status: 'too_soon' };

    // Separate Event Items check vs Standard Items check
    const eventItems = items.filter(i => i.isEventProduct);
    const standardItems = items.filter(i => !i.isEventProduct);

    // 1. EVENT CHECK
    if (eventItems.length > 0) {
        const eventSlot = settings.eventSlots?.find(s => s.date === date);
        if (!eventSlot) {
            return { allowed: false, reason: t('cart.event_only'), status: 'closed' };
        }
        
        // Check event capacity
        // Note: For simplicity, we assume if `getAvailableEventDates` returns the date, it's valid.
        // But `getAvailableEventDates` works per product. Here we check the WHOLE cart.
        // We need to simulate adding the whole cart to current load.
        
        const relevantOrders = orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED && o.id !== excludeOrderId);
        
        // Add current cart as a dummy order
        const simulatedOrders = [...relevantOrders, { items: items } as any]; 
        const { eventLoad } = calculateDailyLoad(simulatedOrders, products, settings);
        
        // Check limits
        for (const cat of settings.categories) {
            const limit = eventSlot.capacityOverrides?.[cat.id] ?? 0;
            const current = eventLoad[cat.id] || 0;
            if (current > limit) {
                return { allowed: false, reason: t('cart.capacity_exceeded'), status: 'exceeds' };
            }
        }
    }

    // 2. STANDARD CHECK
    // If we have event items, they consume Event Capacity (checked above).
    // If we have standard items, they consume Daily Capacity.
    // If mixed cart, we check both.
    
    if (standardItems.length > 0) {
        // Standard items can theoretically be ordered on Event days too, consuming standard capacity?
        // Or should we block standard items on event days if not explicitly allowed?
        // Current logic: Standard capacity is independent.
        
        const relevantOrders = orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED && o.id !== excludeOrderId);
        const simulatedOrders = [...relevantOrders, { items: items } as any];
        const { load } = calculateDailyLoad(simulatedOrders, products, settings);
        
        for (const cat of settings.categories) {
            const limit = config?.capacityOverrides?.[cat.id] ?? settings.defaultCapacities[cat.id] ?? 0;
            const current = load[cat.id] || 0;
            if (current > limit) {
                return { allowed: false, reason: t('cart.capacity_exceeded'), status: 'exceeds' };
            }
        }
    }

    return { allowed: true, status: 'available' };
  };

  const getDateStatus = (date: string, items: CartItem[]): DayStatus => {
     const check = checkAvailability(date, items);
     return check.status;
  };

  // --- AUTH ---
  const login = async (email: string, password?: string) => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/users/login', 'POST', { email, password });
        if (res && res.success) {
            setUser(res.user);
            localStorage.setItem('auth_token', res.token);
            return { success: true };
        }
        return { success: false, message: res?.message || 'Login failed' };
    } else {
        const foundUser = allUsers.find(u => u.email === email);
        if (foundUser) {
            if (foundUser.isBlocked) return { success: false, message: 'Blokován.' };
            if (password && foundUser.passwordHash !== hashPassword(password)) return { success: false, message: 'Chybné heslo.' };
            setUser(foundUser); 
            return { success: true };
        }
        return { success: false, message: 'Nenalezen.' };
    }
  };

  const register = (name: string, email: string, phone: string, password?: string) => {
    // ... same as before but using apiCall
    if (allUsers.find(u => u.email.toLowerCase() === email.toLowerCase())) { 
        showNotify('Tento email je již registrován.', 'error');
        return; 
    }
    const newUser: User = { id: Date.now().toString(), name, email, phone, role: 'customer', billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword(password || '1234'), marketingConsent: false };
    
    if (dataSource === 'api') {
        apiCall('/api/users', 'POST', newUser).then(res => {
            if (res && res.success) { showNotify('Registrace úspěšná. Přihlašte se.', 'success'); }
        });
    } else {
        setAllUsers(prev => [...prev, newUser]); setUser(newUser);
    }
  };

  const logout = () => { setUser(null); localStorage.removeItem('session_user'); localStorage.removeItem('auth_token'); };
  const toggleUserBlock = async (id: string): Promise<boolean> => { const u = allUsers.find(x => x.id === id); if (u) { const updated = { ...u, isBlocked: !u.isBlocked }; return await updateUserAdmin(updated); } return false; };
  const sendPasswordReset = async (email: string) => { if (dataSource === 'api') { const res = await apiCall('/api/auth/reset-password', 'POST', { email }); if (res && res.success) { return { success: true, message: res.message }; } return { success: false, message: res?.message }; } return { success: true, message: 'Simulace: Email odeslán.' }; };
  const resetPasswordByToken = async (token: string, newPass: string): Promise<PasswordChangeResult> => { if (dataSource === 'api') { const newHash = hashPassword(newPass); const res = await apiCall('/api/auth/reset-password-confirm', 'POST', { token, newPasswordHash: newHash }); if (res && res.success) { return { success: true, message: 'Heslo změněno.' }; } return { success: false, message: res?.message || 'Chyba' }; } return { success: true, message: 'Heslo změněno' }; };
  const changePassword = async (o: string, n: string) => { if (!user) return { success: false, message: 'Login required' }; if (hashPassword(o) !== user.passwordHash) return { success: false, message: 'Staré heslo nesouhlasí' }; const u = { ...user, passwordHash: hashPassword(n) }; await updateUser(u); return { success: true, message: 'Změněno' }; };
  
  const getDeliveryRegion = (zip: string) => settings.deliveryRegions.find(r => r.enabled && r.zips.includes(zip.replace(/\s/g,'')));
  const getRegionInfoForDate = (r: DeliveryRegion, d: string) => { const ex = r.exceptions?.find(e => e.date === d); return ex ? { isOpen: ex.isOpen, timeStart: ex.deliveryTimeStart, timeEnd: ex.deliveryTimeEnd, isException: true } : { isOpen: true, timeStart: r.deliveryTimeStart, timeEnd: r.deliveryTimeEnd, isException: false }; };
  
  const getPickupPointInfo = (location: PickupLocation, dateStr: string): RegionDateInfo => {
      const ex = location.exceptions?.find(e => e.date === dateStr);
      if (ex) { return { isOpen: ex.isOpen, timeStart: ex.deliveryTimeStart, timeEnd: ex.deliveryTimeEnd, isException: true, reason: ex.isOpen ? 'Výjimka: Otevřeno' : 'Výjimka: Zavřeno' }; }
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      const config = location.openingHours[dayOfWeek];
      if (!config || !config.isOpen) { return { isOpen: false, isException: false, reason: 'Zavřeno' }; }
      return { isOpen: true, timeStart: config.start, timeEnd: config.end, isException: false };
  };

  const checkOrderRestoration = (o: Order) => ({ valid: true, invalidCodes: [] }); 
  
  const importDatabase = async (d: BackupData, s: any): Promise<ImportResult> => {
    if (dataSource === 'api') {
        try {
            const res = await apiCall('/api/admin/import', 'POST', { data: d, selection: s });
            if (res && res.success) { await fetchData(); return { success: true }; }
            return { success: false, message: res?.error || 'Import failed.' };
        } catch (e: any) { return { success: false, message: e.message }; }
    } else {
        try {
            if (s.users && d.users) setAllUsers(d.users);
            if (s.orders && d.orders) setOrders(d.orders);
            if (s.products && d.products) setProducts(d.products);
            if (s.discountCodes && d.discountCodes) setDiscountCodes(d.discountCodes);
            if (s.dayConfigs && d.dayConfigs) setDayConfigs(d.dayConfigs);
            if (s.settings && d.settings) setSettings(d.settings);
            return { success: true };
        } catch (e: any) { return { success: false, message: e.message }; }
    }
  };
  
  const generateInvoice = (o: Order) => `API_INVOICE_${o.id}`;
  const printInvoice = async (o: Order, type: 'proforma' | 'final' = 'proforma') => {
      await generateInvoicePdf(o, type, settings);
  };
  
  const applyDiscount = (code: string) => {
      if (appliedDiscounts.some(d => d.code === code.toUpperCase())) return { success: false, error: 'Kód již uplatněn.' };
      const res = validateDiscount(code, cart);
      if (res.success && res.amount !== undefined) {
          if (appliedDiscounts.length > 0 && !res.discount?.isStackable) return { success: false, error: 'Kód nelze kombinovat.' };
          setAppliedDiscounts([...appliedDiscounts, { code: res.discount!.code, amount: res.amount }]);
          return { success: true };
      }
      return { success: false, error: res.error };
  };
  
  const removeAppliedDiscount = (code: string) => setAppliedDiscounts(prev => prev.filter(d => d.code !== code));
  const validateDiscount = (code: string, currentCart: CartItem[]) => calculateDiscountAmountLogic(code, currentCart, discountCodes, orders);

  const generateCzIban = calculateCzIban;

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-400">Načítám data...</div>;

  return (
    <StoreContext.Provider value={{
      dataSource, setDataSource,
      isLoading, isOperationPending, dbConnectionError,
      language, setLanguage, cart, cartBump, addToCart, removeFromCart, updateCartItemQuantity, clearCart, 
      user, allUsers, login, logout, register, updateUser, updateUserAdmin, toggleUserBlock, sendPasswordReset, resetPasswordByToken, changePassword, addUser,
      orders, addOrder, updateOrderStatus, updateOrder, checkOrderRestoration, searchOrders, searchUsers, products, addProduct, updateProduct, deleteProduct, uploadImage,
      discountCodes, appliedDiscounts, addDiscountCode, updateDiscountCode, deleteDiscountCode, applyDiscount, removeAppliedDiscount, validateDiscount,
      settings, updateSettings, dayConfigs, updateDayConfig, removeDayConfig, checkAvailability, getDateStatus, getDailyLoad, getDeliveryRegion, getRegionInfoForDate,
      getPickupPointInfo,
      calculatePackagingFee,
      t, tData, generateInvoice, printInvoice, generateCzIban, importDatabase, globalNotification, dismissNotification,
      isAuthModalOpen, openAuthModal, closeAuthModal, removeDiacritics, formatDate, getImageUrl,
      cookieSettings, saveCookieSettings,
      updateEventSlot, removeEventSlot, notifyEventSubscribers, isEventCapacityAvailable, getAvailableEventDates,
      getFullApiUrl,
      isPreviewEnvironment
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