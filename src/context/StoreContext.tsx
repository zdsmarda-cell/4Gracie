
import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback, useRef } from 'react';
import { CartItem, Language, Product, User, Order, GlobalSettings, DayConfig, ProductCategory, OrderStatus, PaymentMethod, DiscountCode, DiscountType, AppliedDiscount, DeliveryRegion, PackagingType, CompanyDetails, BackupData, PickupLocation } from '../types';
import { MOCK_ORDERS, PRODUCTS as INITIAL_PRODUCTS, DEFAULT_SETTINGS, EMPTY_SETTINGS } from '../constants';
import { TRANSLATIONS } from '../translations';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { calculatePackagingFeeLogic, calculateDiscountAmountLogic } from '../utils/orderLogic';

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

interface DailyLoadResult {
    load: Record<string, number>;
    usedProductIds: Set<string>;
}

export type DataSourceMode = 'local' | 'api';

interface GlobalNotification {
  message: string;
  type: 'success' | 'error';
  autoClose: boolean;
}

interface OrdersSearchResult {
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
  sendPasswordReset: (email: string) => Promise<{success: boolean, message: string}>;
  resetPasswordByToken: (token: string, newPass: string) => Promise<PasswordChangeResult>;
  changePassword: (oldPass: string, newPass: string) => PasswordChangeResult;
  addUser: (name: string, email: string, phone: string, role: 'customer' | 'admin' | 'driver') => Promise<boolean>;
  searchUsers: (filter: {search?: string}) => Promise<User[]>;
  
  orders: Order[];
  searchOrders: (filters: { id?: string; dateFrom?: string; dateTo?: string; status?: string; customer?: string; ic?: string; page?: number; limit?: number }) => Promise<OrdersSearchResult>;
  addOrder: (order: Order) => Promise<boolean>;
  updateOrderStatus: (orderIds: string[], status: OrderStatus, sendNotify?: boolean) => Promise<boolean>;
  updateOrder: (order: Order, sendNotify?: boolean) => Promise<boolean>;
  checkOrderRestoration: (order: Order) => RestorationCheckResult;
  
  products: Product[];
  addProduct: (product: Product) => Promise<boolean>;
  updateProduct: (product: Product) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  uploadImage: (base64: string, name?: string) => Promise<string>;
  
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
  
  checkAvailability: (date: string, cartItems: CartItem[], excludeOrderId?: string) => CheckResult;
  getDateStatus: (date: string, cartItems: CartItem[]) => DayStatus;
  getDailyLoad: (date: string, excludeOrderId?: string) => DailyLoadResult;
  getDeliveryRegion: (zip: string) => DeliveryRegion | undefined;
  getRegionInfoForDate: (region: DeliveryRegion, date: string) => RegionDateInfo;
  getPickupPointInfo: (location: PickupLocation, date: string) => RegionDateInfo; 
  calculatePackagingFee: (items: CartItem[]) => number;
  
  t: (key: string, params?: Record<string, string>) => string;
  tData: (obj: any, key: string) => string;
  generateInvoice: (order: Order) => string;
  printInvoice: (order: Order, type?: 'proforma' | 'final') => Promise<void>;
  generateCzIban: (accountStr: string) => string;
  removeDiacritics: (str: string) => string;
  formatDate: (dateStr: string) => string;
  getFullApiUrl: (path: string) => string;
  getImageUrl: (path: string) => string; 
  refreshData: (force?: boolean) => Promise<void>;
  
  importDatabase: (data: BackupData, selection: Record<string, boolean>) => Promise<ImportResult>;
  
  globalNotification: GlobalNotification | null;
  dismissNotification: () => void;

  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const hashPassword = (pwd: string) => `hashed_${btoa(pwd)}`;

const removeDiacritics = (str: string): string => {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const calculateCzIban = (accountString: string): string => {
  if (!accountString) return '';
  const cleanStr = accountString.replace(/\s/g, '');
  const [accountPart, bankCode] = cleanStr.split('/');
  if (!accountPart || !bankCode || bankCode.length !== 4) return '';
  let prefix = '';
  let number = accountPart;
  if (accountPart.includes('-')) { [prefix, number] = accountPart.split('-'); }
  const paddedPrefix = prefix.padStart(6, '0');
  const paddedNumber = number.padStart(10, '0');
  const paddedBank = bankCode.padStart(4, '0');
  const bban = paddedBank + paddedPrefix + paddedNumber;
  const numericStr = bban + '123500';
  const remainder = BigInt(numericStr) % 97n;
  const checkDigitsVal = 98n - remainder;
  const checkDigitsStr = checkDigitsVal.toString().padStart(2, '0');
  return `CZ${checkDigitsStr}${bban}`;
};

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
  const env = (import.meta as any).env;
  const isProduction = env?.PROD ?? false;

  const [dataSource, setDataSourceState] = useState<DataSourceMode>(() => {
    if (isProduction) return 'api';
    return (localStorage.getItem('app_data_source') as DataSourceMode) || 'local';
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isOperationPending, setIsOperationPending] = useState(false);
  const [language, setLanguage] = useState<Language>(Language.CS);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [globalNotification, setGlobalNotification] = useState<GlobalNotification | null>(null);
  const [cartBump, setCartBump] = useState(false);

  const t = useCallback((key: string, params?: Record<string, string>) => {
    let text = TRANSLATIONS[language]?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  }, [language]);

  const tData = useCallback((obj: any, key: string): string => {
    if (!obj) return '';
    const val = obj.translations?.[language]?.[key];
    return val || obj[key] || '';
  }, [language]);

  const [cart, setCart] = useState<CartItem[]>(() => loadFromStorage('cart', []));
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(() => loadFromStorage('session_user', null));
  
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>([]);
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);

  const setDataSource = (mode: DataSourceMode) => {
    if (isProduction && mode === 'local') return; 
    localStorage.setItem('app_data_source', mode);
    setDataSourceState(mode);
  };

  const isPreviewEnvironment = useMemo(() => !isProduction, [isProduction]);

  const showNotify = (message: string, type: 'success' | 'error' = 'success', autoClose: boolean = true) => {
    setGlobalNotification({ message, type, autoClose });
  };

  const getFullApiUrl = useCallback((endpoint: string) => {
    // @ts-ignore
    const env = (import.meta as any).env;
    if (env?.DEV) return endpoint; 
    let baseUrl = env?.VITE_API_URL;
    if (!baseUrl) {
       baseUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
    }
    if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
    }
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
  }, []);

  const getImageUrl = useCallback((path: string) => {
      if (!path) return '';
      if (path.startsWith('http')) return path;
      if (path.startsWith('data:')) return path;
      return getFullApiUrl(path);
  }, [getFullApiUrl]);

  const apiCall = useCallback(async (endpoint: string, method: string, body?: any) => {
    const controller = new AbortController();
    setIsOperationPending(true);
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            controller.abort();
            reject(new Error('TIMEOUT_LIMIT_REACHED'));
        }, 8000); 
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
      
      if (res.status === 204) return null; 

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Server vrátil neplatná data (HTML místo JSON).");
      }
      if (!res.ok) throw new Error(`API Chyba: ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e: any) {
      if (e.message === 'TIMEOUT_LIMIT_REACHED' || e.name === 'AbortError') {
         if (e.name !== 'AbortError') {
             showNotify('Nepodařilo se operaci dokončit z důvodu nedostupnosti DB.', 'error');
         }
      } else {
         console.warn(`[API] Call to ${endpoint} failed:`, e);
         showNotify(`Chyba: ${e.message || 'Neznámá chyba'}`, 'error');
      }
      return null;
    } finally {
        setIsOperationPending(false); 
    }
  }, [getFullApiUrl]);

  const fetchData = useCallback(async (force: boolean = false) => {
      try {
        if (dataSource === 'api') {
          const data = await apiCall('/api/bootstrap', 'GET');
          if (data) {
              setAllUsers([]); 
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
          } else {
              showNotify('Nepodařilo se načíst data ze serveru. Zkontrolujte připojení.', 'error', false);
          }
        } else {
          setAllUsers(loadFromStorage('db_users', INITIAL_USERS));
          setProducts(loadFromStorage('db_products', INITIAL_PRODUCTS));
          setOrders(loadFromStorage('db_orders', MOCK_ORDERS));
          const loadedSettings = loadFromStorage('db_settings', DEFAULT_SETTINGS);
          if (!loadedSettings.categories) loadedSettings.categories = DEFAULT_SETTINGS.categories;
          if (!loadedSettings.pickupLocations) loadedSettings.pickupLocations = DEFAULT_SETTINGS.pickupLocations;
          setSettings(loadedSettings);
          setDiscountCodes(loadFromStorage('db_discounts', []));
          setDayConfigs(loadFromStorage('db_dayconfigs', []));
        }
      } catch (err: any) {
        showNotify('Chyba při načítání aplikace: ' + err.message, 'error');
      } finally {
        setIsLoading(false); 
      }
  }, [dataSource, apiCall]); 

  useEffect(() => {
    fetchData();
  }, [dataSource]); 

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

  const calculateDiscountAmount = (code: string, currentCart: CartItem[]): ValidateDiscountResult => {
      return calculateDiscountAmountLogic(code, currentCart, discountCodes, orders);
  };

  useEffect(() => {
    if (appliedDiscounts.length === 0) return;
    let updatedDiscounts: AppliedDiscount[] = [];
    let removedCodes: string[] = [];
    for (const applied of appliedDiscounts) {
      const calculation = calculateDiscountAmount(applied.code, cart);
      if (calculation.success && calculation.amount !== undefined) {
        updatedDiscounts.push({ code: applied.code, amount: calculation.amount });
      } else {
        removedCodes.push(applied.code);
      }
    }
    const isDifferent = JSON.stringify(updatedDiscounts) !== JSON.stringify(appliedDiscounts);
    if (isDifferent) {
      setAppliedDiscounts(updatedDiscounts);
      if (removedCodes.length > 0) showNotify(`Kupon ${removedCodes.join(', ')} byl odebrán (podmínky nesplněny).`, 'error');
    }
  }, [cart]);

  const applyDiscount = (code: string): { success: boolean; error?: string } => {
    if (appliedDiscounts.some(d => d.code === code.toUpperCase())) return { success: false, error: t('discount.applied') };
    const result = calculateDiscountAmount(code, cart);
    if (result.success && result.discount && result.amount !== undefined) {
      if (appliedDiscounts.length > 0 && !result.discount.isStackable) return { success: false, error: t('discount.not_stackable') };
      setAppliedDiscounts([...appliedDiscounts, { code: result.discount.code, amount: result.amount }]);
      return { success: true };
    } else {
      return { success: false, error: result.error || t('discount.invalid') };
    }
  };

  const removeAppliedDiscount = (code: string) => setAppliedDiscounts(prev => prev.filter(d => d.code !== code));
  const validateDiscount = calculateDiscountAmount;

  const calculatePackagingFee = (items: CartItem[]): number => {
      return calculatePackagingFeeLogic(items, settings.packaging.types, settings.packaging.freeFrom);
  };

  const uploadImage = async (base64: string, name?: string): Promise<string> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/admin/upload', 'POST', { image: base64, name });
        if (res && res.success) return res.url;
        throw new Error('Upload failed');
    } else {
        return base64; 
    }
  };

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
        return true;
      }
      return false;
    } else {
      setOrders(prev => [orderWithHistory, ...prev]);
      return true;
    }
  };

  const updateOrder = async (order: Order, sendNotify?: boolean): Promise<boolean> => {
    let updatedOrder = { ...order };
    if (updatedOrder.items.length === 0) {
      updatedOrder.status = OrderStatus.CANCELLED;
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
              const updatedOrder = { 
                  ...o, 
                  status, 
                  statusHistory: [...(o.statusHistory || []), { status, date: new Date().toISOString() }] 
              };
              if (status === OrderStatus.DELIVERED && !updatedOrder.finalInvoiceDate) {
                  updatedOrder.finalInvoiceDate = new Date().toISOString();
              }
              return updatedOrder;
            }
            return o;
          }));
          const msg = notify ? t('notification.email_sent') : t('notification.saved');
          showNotify(msg, 'success', !notify);
          return true;
       }
       return false;
    } else {
       setOrders(prev => prev.map(o => {
          if (ids.includes(o.id)) {
            const updatedOrder = { ...o, status, statusHistory: [...(o.statusHistory || []), { status, date: new Date().toISOString() }] };
            if (status === OrderStatus.DELIVERED && !updatedOrder.finalInvoiceDate) {
                updatedOrder.finalInvoiceDate = new Date().toISOString();
            }
            return updatedOrder;
          }
          return o;
        }));
        showNotify(t('notification.saved'));
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
          let filtered = orders.filter(o => {
              if (filters.id && !o.id.includes(filters.id)) return false;
              if (filters.userId && o.userId !== filters.userId) return false;
              if (filters.status && o.status !== filters.status) return false;
              if (filters.dateFrom && o.deliveryDate < filters.dateFrom) return false;
              if (filters.dateTo && o.deliveryDate > filters.dateTo) return false;
              if (filters.customer && !o.userName?.toLowerCase().includes(filters.customer.toLowerCase())) return false;
              return true;
          });
          const page = filters.page || 1;
          const limit = filters.limit || 50;
          const start = (page - 1) * limit;
          return {
              orders: filtered.slice(start, start + limit),
              total: filtered.length,
              page,
              pages: Math.ceil(filtered.length / limit)
          };
      }
  }, [dataSource, orders, apiCall]); 

  // Product Functions
  const addProduct = async (p: Product): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/products', 'POST', p);
        if (res && res.success) { setProducts(prev => [...prev, p]); showNotify('Produkt uložen do DB.'); return true; }
        return false;
    } else {
        setProducts(prev => [...prev, p]); return true;
    }
  };

  const updateProduct = async (p: Product): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/products', 'POST', p);
        if (res && res.success) { setProducts(prev => prev.map(x => x.id === p.id ? p : x)); showNotify('Produkt aktualizován v DB.'); return true; }
        return false;
    } else {
        setProducts(prev => prev.map(x => x.id === p.id ? p : x)); return true;
    }
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall(`/api/products/${id}`, 'DELETE');
        if (res && res.success) { setProducts(prev => prev.filter(x => x.id !== id)); showNotify('Produkt smazán z DB.'); return true; }
        return false;
    } else {
        setProducts(prev => prev.filter(x => x.id !== id)); return true;
    }
  };

  // Auth Functions
  const login = async (e: string, p?: string) => { 
      if (dataSource === 'api') {
        const res = await apiCall('/api/auth/login', 'POST', { email: e, password: p });
        if (res && res.success) { setUser(res.user); return { success: true }; }
        return { success: false, message: res?.message || 'Login failed' };
      }
      const foundUser = allUsers.find(u => u.email === e);
      if (foundUser) {
          if (foundUser.isBlocked) return { success: false, message: t('cart.blocked_alert') };
          if (p && foundUser.passwordHash !== hashPassword(p)) return { success: false, message: 'Invalid password' };
          setUser(foundUser); 
          return { success: true };
      }
      return { success: false, message: 'User not found' };
  };

  const logout = () => {
      setUser(null);
      localStorage.removeItem('session_user');
  };

  const register = (n: string, e: string, ph: string, p?: string) => { 
      if (allUsers.find(u => u.email.toLowerCase() === e.toLowerCase())) { 
          showNotify('Tento email je již registrován.', 'error');
          return; 
      }
      const newUser: User = { id: Date.now().toString(), name: n, email: e, phone: ph, role: 'customer', billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword(p || '1234'), marketingConsent: false };
      
      if (dataSource === 'api') {
          apiCall('/api/users', 'POST', newUser).then(res => {
              if (res && res.success) { setAllUsers(prev => [...prev, newUser]); setUser(newUser); }
          });
      } else {
          setAllUsers(prev => [...prev, newUser]); setUser(newUser); 
      }
  };

  const searchUsers = async (f: any) => { 
      if (dataSource === 'api') {
          const queryString = new URLSearchParams(f).toString();
          const res = await apiCall(`/api/users?${queryString}`, 'GET');
          if (res && res.success) return res.users;
          return [];
      }
      return allUsers; 
  };

  const addUser = async (name: string, email: string, phone: string, role: 'customer' | 'admin' | 'driver'): Promise<boolean> => {
    if (allUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) { showNotify('Uživatel již existuje.', 'error'); return false; }
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
            showNotify('Profil aktualizován.');
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
        if (res && res.success) {
            setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
            if (user && user.id === u.id) setUser(u);
            showNotify('Uživatel aktualizován.');
            return true;
        }
        return false;
    } else {
        setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
        if (user && user.id === u.id) setUser(u);
        return true;
    }
  };

  const toggleUserBlock = async (id: string): Promise<boolean> => { 
      const u = allUsers.find(x => x.id === id); 
      if (u) { 
          const updated = { ...u, isBlocked: !u.isBlocked }; 
          return await updateUserAdmin(updated); 
      } 
      return false; 
  };

  const sendPasswordReset = async (email: string) => { 
      if (dataSource === 'api') { 
          const res = await apiCall('/api/auth/reset-password', 'POST', { email }); 
          if (res && res.success) return { success: true, message: res.message || 'Email odeslán.' }; 
          return { success: false, message: res?.message || 'Chyba serveru' }; 
      } 
      return { success: true, message: 'Simulace (Lokální mód): Reset link odeslán.' }; 
  };

  const resetPasswordByToken = async (token: string, newPass: string): Promise<PasswordChangeResult> => { 
      if (dataSource === 'api') { 
          const newHash = hashPassword(newPass); 
          const res = await apiCall('/api/auth/reset-password-confirm', 'POST', { token, newPasswordHash: newHash }); 
          if (res && res.success) { await fetchData(); return { success: true, message: res.message || 'Heslo úspěšně změněno.' }; } 
          return { success: false, message: res?.message || 'Chyba serveru při změně hesla.' }; 
      } 
      return { success: true, message: 'Heslo změněno (Lokální simulace)' }; 
  };

  const changePassword = (o: string, n: string) => { 
      if (!user) return { success: false, message: 'Login required' }; 
      if (hashPassword(o) !== user.passwordHash) return { success: false, message: 'Staré heslo nesouhlasí' }; 
      const u = { ...user, passwordHash: hashPassword(n) }; 
      updateUser(u); 
      return { success: true, message: 'Změněno' }; 
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
        if (res && res.success) {
            setDayConfigs(prev => { const exists = prev.find(d => d.date === c.date); return exists ? prev.map(d => d.date === c.date ? c : d) : [...prev, c]; });
            showNotify('Kalendář aktualizován.'); return true;
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
        if (res && res.success) { setDayConfigs(prev => prev.filter(d => d.date !== date)); showNotify('Výjimka smazána.'); return true; }
        return false;
    } else {
        setDayConfigs(prev => prev.filter(d => d.date !== date)); return true;
    }
  };

  const addDiscountCode = async (c: DiscountCode): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/discounts', 'POST', c);
        if (res && res.success) { setDiscountCodes(prev => [...prev, c]); showNotify('Slevový kód uložen.'); return true; }
        return false;
    } else {
        setDiscountCodes(prev => [...prev, c]); return true;
    }
  };

  const updateDiscountCode = async (code: DiscountCode): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/discounts', 'POST', code);
        if (res && res.success) { setDiscountCodes(prev => prev.map(x => x.id === code.id ? code : x)); showNotify('Slevový kód aktualizován.'); return true; }
        return false;
    } else {
        setDiscountCodes(prev => prev.map(x => x.id === code.id ? code : x)); return true;
    }
  };

  const deleteDiscountCode = async (id: string): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall(`/api/discounts/${id}`, 'DELETE');
        if (res && res.success) { setDiscountCodes(prev => prev.filter(x => x.id !== id)); showNotify('Slevový kód smazán.'); return true; }
        return false;
    } else {
        setDiscountCodes(prev => prev.filter(x => x.id !== id)); return true;
    }
  };

  const getDailyLoad = (date: string, excludeOrderId?: string): DailyLoadResult => {
    const relevantOrders = orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED && o.id !== excludeOrderId);
    const load: Record<string, number> = {};
    (settings.categories || []).forEach(cat => load[cat.id] = 0);
    Object.values(ProductCategory).forEach(c => { if (load[c] === undefined) load[c] = 0; });
    const usedProductIds = new Set<string>();
    
    relevantOrders.forEach(order => {
      if (!order.items) return;
      order.items.forEach(item => {
        const productDef = products.find(p => String(p.id) === String(item.id));
        const itemWorkload = Number(productDef?.workload) || Number(item.workload) || 0;
        const itemOverhead = Number(productDef?.workloadOverhead) || Number(item.workloadOverhead) || 0;
        const cat = item.category || productDef?.category;
        
        if (cat) {
             if (load[cat] === undefined) load[cat] = 0;
             load[cat] += itemWorkload * item.quantity;
             if (!usedProductIds.has(String(item.id))) { 
                 load[cat] += itemOverhead; 
                 usedProductIds.add(String(item.id)); 
             }
        }
      });
    });
    return { load, usedProductIds };
  };

  const checkAvailability = (date: string, items: CartItem[], excludeOrderId?: string): CheckResult => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date); targetDate.setHours(0, 0, 0, 0);
    if (targetDate < today) return { allowed: false, reason: t('error.past'), status: 'past' };
    const categoriesInCart = new Set(items.map(i => i.category));
    const maxLeadTime = items.length > 0 ? Math.max(...items.map(i => i.leadTimeDays || 0)) : 0;
    const minPossibleDate = new Date(today); minPossibleDate.setDate(minPossibleDate.getDate() + maxLeadTime);
    if (targetDate < minPossibleDate) return { allowed: false, reason: t('error.too_soon'), status: 'too_soon' };
    const config = dayConfigs.find(d => d.date === date);
    if (config && !config.isOpen) return { allowed: false, reason: t('error.day_closed'), status: 'closed' };
    
    const { load } = getDailyLoad(date, excludeOrderId);
    
    items.forEach(item => {
       const productDef = products.find(p => String(p.id) === String(item.id));
       const workload = Number(productDef?.workload) || Number(item.workload) || 0;
       
       if (load[item.category] !== undefined) {
          load[item.category] += workload * item.quantity;
       }
    });
    
    let anyExceeds = false;
    const catsToCheck = new Set([...Array.from(categoriesInCart), ...settings.categories.map(c => c.id)]);
    for (const cat of catsToCheck) {
      if (items.length > 0 && !categoriesInCart.has(cat)) continue; 
      const limit = config?.capacityOverrides?.[cat] ?? settings.defaultCapacities[cat] ?? 0;
      const currentLoad = load[cat] || 0;
      if (currentLoad > limit) anyExceeds = true;
    }
    if (anyExceeds) return { allowed: false, reason: t('error.capacity_exceeded'), status: 'exceeds' };
    return { allowed: true, status: 'available' };
  };

  const getDateStatus = (date: string, items: CartItem[]): DayStatus => {
     const check = checkAvailability(date, items);
     return check.status;
  };

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
      return { isOpen: true, timeStart: config.start, timeEnd: config.end, isException: false };
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
  const printInvoice = async (o: Order, type: 'proforma' | 'final' = 'proforma') => { const doc = new jsPDF(); doc.text(`${type === 'final' ? 'Daňový doklad' : 'Faktura'} ${o.id}`, 10, 10); doc.save('faktura.pdf'); };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-400">Načítám data...</div>;

  return (
    <StoreContext.Provider value={{
      dataSource, setDataSource, isPreviewEnvironment,
      isLoading, isOperationPending,
      language, setLanguage, cart, addToCart, removeFromCart, updateCartItemQuantity, clearCart, cartBump,
      user, allUsers, login, logout, register, updateUser, updateUserAdmin, toggleUserBlock, sendPasswordReset, resetPasswordByToken, changePassword, addUser, searchUsers,
      orders, addOrder, updateOrderStatus, updateOrder, checkOrderRestoration, searchOrders,
      products, addProduct, updateProduct, deleteProduct, uploadImage,
      discountCodes, appliedDiscounts, addDiscountCode, updateDiscountCode, deleteDiscountCode, applyDiscount, removeAppliedDiscount, validateDiscount,
      settings, updateSettings, dayConfigs, updateDayConfig, removeDayConfig, checkAvailability, getDateStatus, getDailyLoad, getDeliveryRegion, getRegionInfoForDate,
      getPickupPointInfo,
      calculatePackagingFee,
      t, tData, generateInvoice, printInvoice, generateCzIban: calculateCzIban, importDatabase, globalNotification, dismissNotification,
      isAuthModalOpen, openAuthModal, closeAuthModal, removeDiacritics, formatDate, getFullApiUrl, getImageUrl, refreshData: fetchData
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
