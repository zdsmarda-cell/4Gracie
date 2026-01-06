
import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import { CartItem, Language, Product, User, Order, GlobalSettings, DayConfig, ProductCategory, OrderStatus, PaymentMethod, DiscountCode, DiscountType, AppliedDiscount, DeliveryRegion, PackagingType, PickupLocation, BackupData, CookieSettings, EventSlot, CapacityCategory } from '../types';
import { MOCK_ORDERS, PRODUCTS as INITIAL_PRODUCTS, DEFAULT_SETTINGS, EMPTY_SETTINGS } from '../constants';
import { TRANSLATIONS } from '../translations';
import { jsPDF } from 'jspdf';
import { calculatePackagingFeeLogic, calculateDiscountAmountLogic, calculateDailyLoad, DailyLoadResult } from '../utils/orderLogic';
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

export type DataSourceMode = 'local' | 'api';

interface GlobalNotification {
  message: string;
  type: 'success' | 'error';
  autoClose: boolean;
}

export interface OrdersSearchResult {
  orders: Order[];
  total: number;
  page: number;
  pages: number;
}

interface StoreContextType {
  dataSource: DataSourceMode;
  setDataSource: (mode: DataSourceMode) => void;
  isLoading: boolean;
  isOperationPending: boolean;
  dbConnectionError: boolean;
  isPreviewEnvironment: boolean;
  refreshData: () => Promise<void>;
  
  language: Language;
  setLanguage: (lang: Language) => void;
  
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartItemQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartBump: boolean;
  
  user: User | null;
  allUsers: User[];
  login: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  register: (name: string, email: string, phone: string, password?: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => Promise<boolean>; 
  updateUserAdmin: (user: User) => Promise<boolean>; 
  toggleUserBlock: (userId: string) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPasswordByToken: (token: string, newPass: string) => Promise<PasswordChangeResult>;
  changePassword: (oldPass: string, newPass: string) => PasswordChangeResult;
  addUser: (name: string, email: string, phone: string, role: 'customer' | 'admin' | 'driver') => Promise<boolean>;
  searchUsers: (filters: { search: string }) => Promise<User[]>;
  
  orders: Order[];
  addOrder: (order: Order) => Promise<boolean>;
  updateOrderStatus: (orderIds: string[], status: OrderStatus, sendNotify?: boolean) => Promise<boolean>;
  updateOrder: (order: Order, sendNotify?: boolean, isUserEdit?: boolean) => Promise<boolean>;
  checkOrderRestoration: (order: Order) => RestorationCheckResult;
  searchOrders: (filters: any) => Promise<OrdersSearchResult>;
  
  products: Product[];
  addProduct: (product: Product) => Promise<boolean>;
  updateProduct: (product: Product) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  
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
  
  cookieSettings: CookieSettings | null;
  saveCookieSettings: (settings: CookieSettings) => void;

  checkAvailability: (date: string, cartItems: CartItem[], excludeOrderId?: string) => CheckResult;
  getDateStatus: (date: string, cartItems: CartItem[]) => DayStatus;
  getDailyLoad: (date: string, excludeOrderId?: string) => DailyLoadResult;
  getDeliveryRegion: (zip: string) => DeliveryRegion | undefined;
  getRegionInfoForDate: (region: DeliveryRegion, date: string) => RegionDateInfo;
  getPickupPointInfo: (location: PickupLocation, date: string) => RegionDateInfo;
  calculatePackagingFee: (items: CartItem[]) => number;
  getAvailableEventDates: (product: Product) => string[];
  isEventCapacityAvailable: (product: Product) => boolean;
  
  t: (key: string, params?: Record<string, string>) => string;
  tData: (obj: any, field: string) => string;
  getImageUrl: (url?: string) => string;
  
  generateInvoice: (order: Order) => string;
  printInvoice: (order: Order, type?: 'proforma' | 'final') => Promise<void>;
  generateCzIban: (accountStr: string) => string;
  removeDiacritics: (str: string) => string;
  formatDate: (dateStr: string) => string;
  
  importDatabase: (data: BackupData, selection: Record<string, boolean>) => Promise<ImportResult>;
  uploadImage: (base64: string, name: string) => Promise<string>;
  
  globalNotification: GlobalNotification | null;
  dismissNotification: () => void;

  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
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
  const [dataSource, setDataSourceState] = useState<DataSourceMode>(() => {
    return (localStorage.getItem('app_data_source') as DataSourceMode) || 'local';
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isOperationPending, setIsOperationPending] = useState(false);
  const [dbConnectionError, setDbConnectionError] = useState(false);
  const [language, setLanguageState] = useState<Language>(Language.CS);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [globalNotification, setGlobalNotification] = useState<GlobalNotification | null>(null);
  const [cartBump, setCartBump] = useState(false);

  const setLanguage = (lang: Language) => {
      setLanguageState(lang);
      // Optional: Persist language preference
      localStorage.setItem('app_language', lang);
  };

  useEffect(() => {
      const savedLang = localStorage.getItem('app_language') as Language;
      if (savedLang && Object.values(Language).includes(savedLang)) {
          setLanguageState(savedLang);
      }
  }, []);

  const isPreviewEnvironment = true; // Flag to enable DB toggle in Admin

  const t = (key: string, params?: Record<string, string>) => {
    let text = TRANSLATIONS[language]?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  const tData = (obj: any, field: string) => {
      if (!obj) return '';
      if (settings.enabledLanguages && settings.enabledLanguages.length > 0) {
          // Try current language translation
          const val = obj.translations?.[language]?.[field];
          if (val) return val;
      }
      return obj[field] || '';
  };

  const getImageUrl = (url?: string) => {
      if (!url) return '';
      if (url.startsWith('data:') || url.startsWith('http')) return url;
      
      // In production API mode, images might be relative paths
      // Safely access env
      // @ts-ignore
      const env = (import.meta as any).env;
      let baseUrl = env?.VITE_API_URL;
      
      if (!baseUrl) {
         baseUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
      }

      if (baseUrl.endsWith('/')) {
          baseUrl = baseUrl.slice(0, -1);
      }
      
      const cleanPath = url.startsWith('/') ? url : `/${url}`;
      return `${baseUrl}${cleanPath}`;
  };

  const [cart, setCart] = useState<CartItem[]>(() => loadFromStorage('cart', []));
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(() => loadFromStorage('session_user', null));
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>([]);
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);
  const [cookieSettings, setCookieSettings] = useState<CookieSettings | null>(() => loadFromStorage('cookie_settings', null));

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

  const apiCall = useCallback(async (endpoint: string, method: string, body?: any) => {
    const controller = new AbortController();
    setIsOperationPending(true);
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            controller.abort();
            reject(new Error('TIMEOUT_LIMIT_REACHED'));
        }, 15000); // 15s timeout
    });

    try {
      const url = getFullApiUrl(endpoint);
      const res: any = await Promise.race([
        fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        }),
        timeoutPromise
      ]);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Server vrátil neplatná data (HTML místo JSON).");
      }
      if (!res.ok) throw new Error(`API Chyba: ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e: any) {
      if (e.message === 'TIMEOUT_LIMIT_REACHED' || e.name === 'AbortError') {
         showNotify('Nepodařilo se operaci dokončit z důvodu nedostupnosti DB.', 'error');
      } else {
         console.warn(`[API] Call to ${endpoint} failed:`, e);
         showNotify(`Chyba: ${e.message || 'Neznámá chyba'}`, 'error');
      }
      return null;
    } finally {
        setIsOperationPending(false); 
    }
  }, []);

  const fetchData = async () => {
      setIsLoading(true);
      setDbConnectionError(false);
      try {
        if (dataSource === 'api') {
          // Reset local stores to avoid staleness if switch
          setAllUsers([]);
          setProducts([]);
          setOrders([]);
          setDiscountCodes([]);
          setDayConfigs([]);
          setSettings(EMPTY_SETTINGS);
          
          const data = await apiCall('/api/bootstrap', 'GET');
          
          if (data) {
              if (data.users) setAllUsers(data.users);
              if (data.products) setProducts(data.products);
              if (data.orders) setOrders(data.orders);
              if (data.settings) {
                 const mergedSettings = { ...DEFAULT_SETTINGS, ...data.settings };
                 // Ensure arrays
                 if (!mergedSettings.categories) mergedSettings.categories = DEFAULT_SETTINGS.categories;
                 if (!mergedSettings.capacityCategories) mergedSettings.capacityCategories = [];
                 if (!mergedSettings.pickupLocations) mergedSettings.pickupLocations = DEFAULT_SETTINGS.pickupLocations;
                 setSettings(mergedSettings); 
              }
              if (data.discountCodes) setDiscountCodes(data.discountCodes);
              if (data.dayConfigs) setDayConfigs(data.dayConfigs);
              showNotify("Připojeno k databázi.", 'success');
          } else {
              setDbConnectionError(true);
          }
        } else {
          setAllUsers(loadFromStorage('db_users', INITIAL_USERS));
          setProducts(loadFromStorage('db_products', INITIAL_PRODUCTS));
          setOrders(loadFromStorage('db_orders', MOCK_ORDERS));
          
          const loadedSettings = loadFromStorage('db_settings', DEFAULT_SETTINGS);
          if (!loadedSettings.categories) loadedSettings.categories = DEFAULT_SETTINGS.categories;
          if (!loadedSettings.capacityCategories) loadedSettings.capacityCategories = [];
          if (!loadedSettings.pickupLocations) loadedSettings.pickupLocations = DEFAULT_SETTINGS.pickupLocations;
          
          setSettings(loadedSettings);
          setDiscountCodes(loadFromStorage('db_discounts', []));
          setDayConfigs(loadFromStorage('db_dayconfigs', []));
          showNotify("Přepnuto na lokální paměť.", 'success');
        }
      } catch (err: any) {
        setDbConnectionError(true);
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
    showNotify(t('notification.added_to_cart', { name: tData(product, 'name') }));
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
    
    // In local mode, calculateDiscountAmountLogic needs full orders array to check limits
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
      if (removedCodes.length > 0) showNotify(`Slevový kupon ${removedCodes.join(', ')} byl odebrán (neplatný pro aktuální košík).`, 'error');
    }
  }, [cart, discountCodes]);

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
    let updatedOrder = { ...order, isUserEdit };
    
    // Auto-cancel empty orders
    if (updatedOrder.items.length === 0) {
      updatedOrder.status = OrderStatus.CANCELLED;
      if (!updatedOrder.statusHistory?.some(h => h.status === OrderStatus.CANCELLED)) {
         updatedOrder.statusHistory = [...(updatedOrder.statusHistory || []), { status: OrderStatus.CANCELLED, date: new Date().toISOString() }];
      }
    }
    if (dataSource === 'api') {
       const res = await apiCall('/api/orders', 'POST', updatedOrder);
       if (res && res.success) {
          setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
          showNotify(t('notification.saved'));
          return true;
       }
       return false;
    } else {
       setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
       showNotify(t('notification.saved'));
       return true;
    }
  };

  const updateOrderStatus = async (ids: string[], status: OrderStatus, notify?: boolean): Promise<boolean> => {
    if (dataSource === 'api') {
       const res = await apiCall('/api/orders/status', 'PUT', { ids, status, notifyCustomer: notify });
       if (res && res.success) {
          setOrders(prev => prev.map(o => {
            if (ids.includes(o.id)) {
              return { ...o, status, statusHistory: [...(o.statusHistory || []), { status, date: new Date().toISOString() }] };
            }
            return o;
          }));
          const msg = notify ? `${t('notification.saved')} + ${t('notification.email_sent')}` : t('notification.saved');
          showNotify(msg, 'success', !notify);
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
        showNotify(`${t('admin.status_update')}: ${t(`status.${status}`)}`);
        return true;
    }
  };

  const searchOrders = useCallback(async (filters: any): Promise<OrdersSearchResult> => {
      if (dataSource === 'api') {
          const queryString = new URLSearchParams(filters as any).toString();
          const res = await apiCall(`/api/orders?${queryString}`, 'GET');
          if (res && res.success) {
              return { orders: res.orders, total: res.total, page: res.page, pages: res.pages };
          }
          return { orders: [], total: 0, page: 1, pages: 1 };
      } else {
          // LOCAL SEARCH
          let filtered = orders.filter(o => {
              if (filters.id && !o.id.toLowerCase().includes(filters.id.toLowerCase())) return false;
              if (filters.userId && o.userId !== filters.userId) return false;
              if (filters.status && o.status !== filters.status) return false;
              if (filters.dateFrom && o.deliveryDate < filters.dateFrom) return false;
              if (filters.dateTo && o.deliveryDate > filters.dateTo) return false;
              if (filters.customer && !o.userName?.toLowerCase().includes(filters.customer.toLowerCase())) return false;
              
              // Handle IC Filter
              if (filters.ic) {
                  const hasIcInAddr = !!(o.billingIc) || (o.billingName && o.billingName.toLowerCase().includes('ič'));
                  if (filters.ic === 'yes' && !hasIcInAddr) return false;
                  if (filters.ic === 'no' && hasIcInAddr) return false;
              }

              // Handle Event Filter (Orders containing event products)
              if (filters.isEvent === 'yes') {
                  const hasEventItem = o.items.some(i => i.isEventProduct);
                  if (!hasEventItem) return false;
              }
              
              return true;
          }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Sort by newest

          const page = filters.page || 1;
          const limit = filters.limit || 50;
          const start = (page - 1) * limit;
          
          return {
              orders: filtered.slice(start, start + limit),
              total: filtered.length,
              page,
              pages: Math.ceil(filtered.length / limit) || 1
          };
      }
  }, [dataSource, orders, apiCall]);

  const addProduct = async (p: Product): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/products', 'POST', p);
        if (res && res.success) { setProducts(prev => [...prev, p]); showNotify(t('notification.db_saved')); return true; }
        return false;
    } else {
        setProducts(prev => [...prev, p]); showNotify(t('notification.saved')); return true;
    }
  };

  const updateProduct = async (p: Product): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/products', 'POST', p);
        if (res && res.success) { setProducts(prev => prev.map(x => x.id === p.id ? p : x)); showNotify(t('notification.db_saved')); return true; }
        return false;
    } else {
        setProducts(prev => prev.map(x => x.id === p.id ? p : x)); showNotify(t('notification.saved')); return true;
    }
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall(`/api/products/${id}`, 'DELETE');
        if (res && res.success) { setProducts(prev => prev.filter(x => x.id !== id)); showNotify(t('notification.db_saved')); return true; }
        return false;
    } else {
        setProducts(prev => prev.filter(x => x.id !== id)); showNotify(t('notification.saved')); return true;
    }
  };

  const addUser = async (name: string, email: string, phone: string, role: 'customer' | 'admin' | 'driver'): Promise<boolean> => {
    if (allUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) { alert('Email již existuje.'); return false; }
    const newUser: User = { id: Date.now().toString(), name, email, phone, role, billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword('1234'), marketingConsent: false };
    
    if (dataSource === 'api') {
        const res = await apiCall('/api/users', 'POST', newUser);
        if (res && res.success) {
            setAllUsers(prev => [...prev, newUser]);
            showNotify(`Uživatel ${name} vytvořen.`, 'success', false);
            return true;
        }
        return false;
    } else {
        setAllUsers(prev => [...prev, newUser]);
        showNotify(`Uživatel ${name} vytvořen.`);
        return true;
    }
  };

  const updateUser = async (u: User): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/users', 'POST', u);
        if (res && res.success) {
            setUser(u);
            setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
            showNotify(t('notification.saved'));
            return true;
        }
        return false;
    } else {
        setUser(u);
        setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
        showNotify(t('notification.saved'));
        return true;
    }
  };

  const updateUserAdmin = async (u: User): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/users', 'POST', u);
        if (res && res.success) {
            setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
            if (user && user.id === u.id) setUser(u);
            showNotify(t('notification.saved'));
            return true;
        }
        return false;
    } else {
        setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
        if (user && user.id === u.id) setUser(u);
        return true;
    }
  };

  const searchUsers = useCallback(async (filters: { search: string }): Promise<User[]> => {
      if (dataSource === 'api') {
          const queryString = new URLSearchParams(filters).toString();
          const res = await apiCall(`/api/users?${queryString}`, 'GET');
          return res && res.success ? res.users : [];
      } else {
          return allUsers.filter(u => 
              !filters.search || 
              u.name.toLowerCase().includes(filters.search.toLowerCase()) || 
              u.email.toLowerCase().includes(filters.search.toLowerCase())
          );
      }
  }, [dataSource, allUsers, apiCall]);

  const updateSettings = async (s: GlobalSettings): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/settings', 'POST', s);
        if (res && res.success) { setSettings(s); showNotify(t('notification.saved')); return true; }
        return false;
    } else {
        setSettings(s); showNotify(t('notification.saved')); return true;
    }
  };

  const updateDayConfig = async (c: DayConfig): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/calendar', 'POST', c);
        if (res && res.success) {
            setDayConfigs(prev => { const exists = prev.find(d => d.date === c.date); return exists ? prev.map(d => d.date === c.date ? c : d) : [...prev, c]; });
            showNotify(t('notification.saved')); return true;
        }
        return false;
    } else {
        setDayConfigs(prev => { const exists = prev.find(d => d.date === c.date); return exists ? prev.map(d => d.date === c.date ? c : d) : [...prev, c]; });
        return true;
    }
  };

  const removeDayConfig = async (date: string): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall(`/api/calendar/${date}`, 'DELETE');
        if (res && res.success) { setDayConfigs(prev => prev.filter(d => d.date !== date)); showNotify(t('notification.saved')); return true; }
        return false;
    } else {
        setDayConfigs(prev => prev.filter(d => d.date !== date)); return true;
    }
  };

  // Event Slots Logic (Similar to DayConfig but stored in settings.eventSlots)
  const updateEventSlot = async (slot: EventSlot): Promise<boolean> => {
      const currentSlots = settings.eventSlots || [];
      let newSlots;
      if (currentSlots.some(s => s.date === slot.date)) {
          newSlots = currentSlots.map(s => s.date === slot.date ? slot : s);
      } else {
          newSlots = [...currentSlots, slot];
      }
      return await updateSettings({ ...settings, eventSlots: newSlots });
  };

  const removeEventSlot = async (date: string): Promise<boolean> => {
      const currentSlots = settings.eventSlots || [];
      const newSlots = currentSlots.filter(s => s.date !== date);
      return await updateSettings({ ...settings, eventSlots: newSlots });
  };

  const addDiscountCode = async (c: DiscountCode): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/discounts', 'POST', c);
        if (res && res.success) { setDiscountCodes(prev => [...prev, c]); showNotify(t('notification.saved')); return true; }
        return false;
    } else {
        setDiscountCodes(prev => [...prev, c]); return true;
    }
  };

  const updateDiscountCode = async (code: DiscountCode): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/discounts', 'POST', code);
        if (res && res.success) { setDiscountCodes(prev => prev.map(x => x.id === code.id ? code : x)); showNotify(t('notification.saved')); return true; }
        return false;
    } else {
        setDiscountCodes(prev => prev.map(x => x.id === code.id ? code : x)); return true;
    }
  };

  const deleteDiscountCode = async (id: string): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall(`/api/discounts/${id}`, 'DELETE');
        if (res && res.success) { setDiscountCodes(prev => prev.filter(x => x.id !== id)); showNotify(t('notification.saved')); return true; }
        return false;
    } else {
        setDiscountCodes(prev => prev.filter(x => x.id !== id)); return true;
    }
  };

  const saveCookieSettings = (s: CookieSettings) => {
      setCookieSettings(s);
  };

  const uploadImage = async (base64: string, name: string) => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/admin/upload', 'POST', { image: base64, name });
          return res && res.success ? res.url : base64; 
      }
      return base64; 
  };

  const calculatePackagingFee = (items: CartItem[]): number => {
      return calculatePackagingFeeLogic(items, settings.packaging.types, settings.packaging.freeFrom);
  };

  const applyDiscount = (code: string): { success: boolean; error?: string } => {
    if (appliedDiscounts.some(d => d.code === code.toUpperCase())) return { success: false, error: t('discount.applied') };
    const result = calculateDiscountAmountLogic(code, cart, discountCodes, orders);
    if (result.success && result.discount && result.amount !== undefined) {
      if (appliedDiscounts.length > 0 && !result.discount.isStackable) return { success: false, error: t('discount.not_stackable') };
      setAppliedDiscounts([...appliedDiscounts, { code: result.discount.code, amount: result.amount }]);
      return { success: true };
    } else {
      return { success: false, error: result.error || t('discount.invalid') };
    }
  };

  const removeAppliedDiscount = (code: string) => setAppliedDiscounts(prev => prev.filter(d => d.code !== code));
  
  const validateDiscount = (code: string, currentCart: CartItem[]) => {
      return calculateDiscountAmountLogic(code, currentCart, discountCodes, orders);
  };

  const getDailyLoad = (date: string, excludeOrderId?: string) => {
      // Create a filtered orders list that excludes the current order if editing
      const filteredOrders = excludeOrderId 
        ? orders.filter(o => o.id !== excludeOrderId) 
        : orders;
        
      // Filter by date for the specific calculation
      const dateOrders = filteredOrders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED);
      
      return calculateDailyLoad(dateOrders, products, settings);
  };

  const checkAvailability = (date: string, items: CartItem[], excludeOrderId?: string): CheckResult => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date); targetDate.setHours(0, 0, 0, 0);
    if (targetDate < today) return { allowed: false, reason: t('error.past'), status: 'past' };
    
    const maxLeadTime = items.length > 0 ? Math.max(...items.map(i => i.leadTimeDays || 0)) : 0;
    const minPossibleDate = new Date(today); minPossibleDate.setDate(minPossibleDate.getDate() + maxLeadTime);
    if (targetDate < minPossibleDate) return { allowed: false, reason: t('error.too_soon'), status: 'too_soon' };
    
    // Check if any item is an Event Product
    const hasEventItem = items.some(i => i.isEventProduct);
    
    // Check Calendar Exceptions (Closed/Open)
    const config = dayConfigs.find(d => d.date === date);
    if (config && !config.isOpen) return { allowed: false, reason: t('error.day_closed'), status: 'closed' };
    
    // Check Event Slots
    const eventSlot = settings.eventSlots?.find(s => s.date === date);
    
    if (hasEventItem && !eventSlot) {
        return { allowed: false, reason: t('cart.event_only'), status: 'closed' };
    }

    // Load Calculation
    const { load, eventLoad } = getDailyLoad(date, excludeOrderId);
    
    // Add current cart to load (simulate)
    const simulatedLoad = { ...load };
    const simulatedEventLoad = { ...eventLoad };
    
    // Helper to add overheads properly would duplicate logic from orderLogic. 
    // For simplicity here, we just add workload + overhead directly to the map.
    // Ideally we would reuse calculateDailyLoad but we need to merge existing + new cart.
    // Creating a temporary order object for calculation:
    const tempOrder: any = { items, id: 'temp' };
    // We pass existing orders + temp order to calculator to get total including new
    const relevantOrders = orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED && o.id !== excludeOrderId);
    const projectedResult = calculateDailyLoad([...relevantOrders, tempOrder], products, settings);
    
    let anyExceeds = false;
    
    // Check limits
    // 1. Standard Categories
    for (const cat of settings.categories) {
        // If items are only event items, standard load check might be irrelevant depending on business logic?
        // But assuming standard capacity is always checked for standard items.
        
        const limit = config?.capacityOverrides?.[cat.id] ?? settings.defaultCapacities[cat.id] ?? 0;
        const currentLoad = projectedResult.load[cat.id] || 0;
        
        if (currentLoad > limit) {
            anyExceeds = true;
        }
    }

    // 2. Event Capacities
    if (eventSlot) {
        for (const cat of settings.categories) {
            const limit = eventSlot.capacityOverrides?.[cat.id] ?? 0; // Default 0 for event means disabled if not set
            const currentLoad = projectedResult.eventLoad[cat.id] || 0;
            
            // Only check if limit is set (implied by existence of slot, but if 0 it means no capacity)
            // If limit is 0, and we have load, it exceeds.
            if (currentLoad > limit) {
                anyExceeds = true;
            }
        }
    }

    if (anyExceeds) return { allowed: false, reason: t('error.capacity_exceeded'), status: 'exceeds' };
    return { allowed: true, status: 'available' };
  };

  const getDateStatus = (date: string, items: CartItem[]): DayStatus => {
     const check = checkAvailability(date, items);
     return check.status;
  };

  const getAvailableEventDates = (product: Product): string[] => {
      if (!product.isEventProduct) return [];
      const today = new Date();
      today.setHours(0,0,0,0);
      
      return (settings.eventSlots || [])
        .filter(s => {
            const d = new Date(s.date);
            d.setHours(0,0,0,0);
            if (d < today) return false;
            
            // Check lead time
            const minDate = new Date(today);
            minDate.setDate(minDate.getDate() + product.leadTimeDays);
            if (d < minDate) return false;
            
            // Check capacity
            const catId = product.category;
            const limit = s.capacityOverrides[catId] || 0;
            if (limit <= 0) return false;
            
            // Check current load
            const { eventLoad } = getDailyLoad(s.date);
            const current = eventLoad[catId] || 0;
            
            // Simple check: if current >= limit, it's full (ignoring the specific product size for listing purposes)
            // For listing, we just want to know if there is *some* space.
            return current < limit;
        })
        .map(s => s.date)
        .sort();
  };

  const isEventCapacityAvailable = (product: Product): boolean => {
      // If no event dates available, return false
      if (product.isEventProduct) {
          return getAvailableEventDates(product).length > 0;
      }
      return true; // Standard products always "available" in list (checked in calendar)
  };

  const login = async (email: string, password?: string) => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/auth/login', 'POST', { email });
        if (res && res.success) {
            // Password verification handled on server ideally, but keeping symmetric with local
            if (password && res.user.passwordHash !== hashPassword(password)) {
                return { success: false, message: 'Chybné heslo' };
            }
            setUser(res.user);
            return { success: true };
        }
        return { success: false, message: 'Nenalezen' };
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

  const register = async (name: string, email: string, phone: string, password?: string) => {
    if (allUsers.find(u => u.email.toLowerCase() === email.toLowerCase())) { 
        showNotify('Tento email je již registrován.', 'error');
        return; 
    }
    const newUser: User = { id: Date.now().toString(), name, email, phone, role: 'customer', billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword(password || '1234'), marketingConsent: false };
    
    if (dataSource === 'api') {
        const res = await apiCall('/api/users', 'POST', newUser);
        if (res && res.success) { setAllUsers(prev => [...prev, newUser]); setUser(newUser); }
    } else {
        setAllUsers(prev => [...prev, newUser]); setUser(newUser); 
    }
  };

  const logout = () => { setUser(null); localStorage.removeItem('session_user'); };
  const toggleUserBlock = async (id: string): Promise<boolean> => { const u = allUsers.find(x => x.id === id); if (u) { const updated = { ...u, isBlocked: !u.isBlocked }; return await updateUserAdmin(updated); } return false; };
  const sendPasswordReset = async (email: string) => { if (dataSource === 'api') { const res = await apiCall('/api/auth/reset-password', 'POST', { email }); return { success: !!res?.success, message: res?.message || 'Chyba' }; } else { return { success: true, message: 'Email odeslán (Lokální simulace).' }; } };
  const resetPasswordByToken = async (token: string, newPass: string): Promise<PasswordChangeResult> => { if (dataSource === 'api') { const newHash = hashPassword(newPass); const res = await apiCall('/api/auth/reset-password-confirm', 'POST', { token, newPasswordHash: newHash }); if (res && res.success) { await fetchData(); return { success: true, message: res.message || 'Heslo úspěšně změněno.' }; } else { return { success: false, message: res?.message || 'Chyba serveru při změně hesla.' }; } } else { return { success: true, message: 'Heslo změněno (Lokální simulace)' }; } };
  const changePassword = (o: string, n: string) => { if (!user) return { success: false, message: 'Login required' }; if (hashPassword(o) !== user.passwordHash) return { success: false, message: 'Staré heslo nesouhlasí' }; const u = { ...user, passwordHash: hashPassword(n) }; updateUser(u); return { success: true, message: 'Změněno' }; };
  const getDeliveryRegion = (zip: string) => settings.deliveryRegions.find(r => r.enabled && r.zips.includes(zip.replace(/\s/g,'')));
  const getRegionInfoForDate = (r: DeliveryRegion, d: string) => { const ex = r.exceptions?.find(e => e.date === d); return ex ? { isOpen: ex.isOpen, timeStart: ex.deliveryTimeStart, timeEnd: ex.deliveryTimeEnd, isException: true } : { isOpen: true, timeStart: r.deliveryTimeStart, timeEnd: r.deliveryTimeEnd, isException: false }; };
  
  const getPickupPointInfo = (location: PickupLocation, dateStr: string): RegionDateInfo => {
      const ex = location.exceptions?.find(e => e.date === dateStr);
      if (ex) {
          return {
              isOpen: ex.isOpen,
              timeStart: ex.deliveryTimeStart,
              timeEnd: ex.deliveryTimeEnd,
              isException: true,
              reason: ex.isOpen ? 'Výjimka: Otevřeno' : 'Výjimka: Zavřeno'
          };
      }
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay(); 
      const config = location.openingHours[dayOfWeek];
      if (!config || !config.isOpen) {
          return { isOpen: false, isException: false, reason: 'Zavřeno' };
      }
      return {
          isOpen: true,
          timeStart: config.start,
          timeEnd: config.end,
          isException: false
      };
  };

  const checkOrderRestoration = (o: Order) => ({ valid: true, invalidCodes: [] }); 
  
  const importDatabase = async (d: BackupData, s: any): Promise<ImportResult> => {
    if (dataSource === 'api') {
        try {
            const res = await apiCall('/api/admin/import', 'POST', { data: d, selection: s });
            if (res && res.success) {
                await fetchData(); 
                return { success: true };
            }
            return { success: false, message: res?.error || 'Import failed on server.' };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    } else {
        try {
            if (s.users && d.users) setAllUsers(d.users);
            if (s.orders && d.orders) setOrders(d.orders);
            if (s.products && d.products) setProducts(d.products);
            if (s.discountCodes && d.discountCodes) setDiscountCodes(d.discountCodes);
            if (s.dayConfigs && d.dayConfigs) setDayConfigs(d.dayConfigs);
            if (s.settings && d.settings) setSettings(d.settings);
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }
  };
  
  const generateInvoice = (o: Order) => `API_INVOICE_${o.id}`;
  const printInvoice = async (o: Order, type: 'proforma' | 'final' = 'proforma') => { 
      const doc = new jsPDF(); 
      doc.text(`${type === 'proforma' ? 'Zálohová' : 'Daňová'} faktura ${o.id}`, 10, 10); 
      doc.save(`faktura_${o.id}.pdf`); 
  };
  const generateCzIban = calculateCzIban;

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-400">Načítám data...</div>;

  return (
    <StoreContext.Provider value={{
      dataSource, setDataSource,
      isLoading, isOperationPending, dbConnectionError, isPreviewEnvironment, refreshData: fetchData,
      language, setLanguage, cart, addToCart, removeFromCart, updateCartItemQuantity, clearCart, cartBump,
      user, allUsers, login, logout, register, updateUser, updateUserAdmin, toggleUserBlock, sendPasswordReset, resetPasswordByToken, changePassword, addUser, searchUsers,
      orders, addOrder, updateOrderStatus, updateOrder, checkOrderRestoration, searchOrders,
      products, addProduct, updateProduct, deleteProduct,
      discountCodes, appliedDiscounts, addDiscountCode, updateDiscountCode, deleteDiscountCode, applyDiscount, removeAppliedDiscount, validateDiscount,
      settings, updateSettings, dayConfigs, updateDayConfig, removeDayConfig, updateEventSlot, removeEventSlot,
      cookieSettings, saveCookieSettings,
      checkAvailability, getDateStatus, getDailyLoad, getDeliveryRegion, getRegionInfoForDate, getPickupPointInfo,
      calculatePackagingFee, getAvailableEventDates, isEventCapacityAvailable,
      t, tData, getImageUrl, generateInvoice, printInvoice, generateCzIban, importDatabase, uploadImage,
      globalNotification, dismissNotification,
      isAuthModalOpen, openAuthModal, closeAuthModal, removeDiacritics, formatDate
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
