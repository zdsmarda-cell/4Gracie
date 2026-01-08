
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { CartItem, Language, Product, User, Order, GlobalSettings, DayConfig, ProductCategory, OrderStatus, PaymentMethod, DiscountCode, DiscountType, AppliedDiscount, DeliveryRegion, PackagingType, CompanyDetails, BackupData, PickupLocation, CookieSettings, OrdersSearchResult, EventSlot } from '../types';
import { MOCK_ORDERS, PRODUCTS as INITIAL_PRODUCTS, DEFAULT_SETTINGS, EMPTY_SETTINGS } from '../constants';
import { TRANSLATIONS } from '../translations';
import { jsPDF } from 'jspdf';

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
  updateOrderStatus: (orderIds: string[], status: OrderStatus, sendNotify?: boolean) => Promise<boolean>;
  updateOrder: (order: Order, sendNotify?: boolean, isUserEdit?: boolean) => Promise<boolean>;
  checkOrderRestoration: (order: Order) => RestorationCheckResult;
  searchOrders: (params: any) => Promise<OrdersSearchResult>;
  searchUsers: (params: any) => Promise<User[]>;
  
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
  
  // Event Slots
  updateEventSlot: (slot: EventSlot) => Promise<boolean>;
  removeEventSlot: (date: string) => Promise<boolean>;
  notifyEventSubscribers: (date: string) => Promise<boolean>;
  getAvailableEventDates: (product: Product) => string[];
  isEventCapacityAvailable: (product: Product) => boolean;

  checkAvailability: (date: string, cartItems: CartItem[], excludeOrderId?: string) => CheckResult;
  getDateStatus: (date: string, cartItems: CartItem[]) => DayStatus;
  getDailyLoad: (date: string, excludeOrderId?: string) => { load: Record<string, number>, eventLoad: Record<string, number> };
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
  getImageUrl: (path: string) => string;
  uploadImage: (base64: string, name: string) => Promise<string>;
  getFullApiUrl: (endpoint: string) => string;
  
  importDatabase: (data: BackupData, selection: Record<string, boolean>) => Promise<ImportResult>;
  
  globalNotification: GlobalNotification | null;
  dismissNotification: () => void;

  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;

  cookieSettings: CookieSettings | null;
  saveCookieSettings: (settings: CookieSettings) => void;
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
  const [dataSource, setDataSourceState] = useState<DataSourceMode>(() => {
    // @ts-ignore
    const env = import.meta.env;
    // PRODUCTION SAFEGUARD: If running in production build, ALWAYS force API mode
    if (env && env.PROD) {
      return 'api';
    }
    // DEVELOPMENT: Allow toggling via localStorage or default to local
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

  const tData = (obj: any, key: string) => {
      if (!obj) return '';
      // 1. Try translations object
      if (obj.translations?.[language]?.[key]) return obj.translations[language][key];
      // 2. Fallback to direct property
      return obj[key] || '';
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

  // isPreviewEnvironment determines if we show dev-only tools (like DB toggle).
  // In production (PROD=true), DEV is false, so tools are hidden.
  // @ts-ignore
  const isPreviewEnvironment = import.meta.env ? import.meta.env.DEV : true;

  const setDataSource = (mode: DataSourceMode) => {
    localStorage.setItem('app_data_source', mode);
    setDataSourceState(mode);
  };

  const showNotify = (message: string, type: 'success' | 'error' = 'success', autoClose: boolean = true) => {
    setGlobalNotification({ message, type, autoClose });
  };

  const saveCookieSettings = (s: CookieSettings) => {
      setCookieSettings(s);
      localStorage.setItem('cookie_settings', JSON.stringify(s));
  };

  const getFullApiUrl = (endpoint: string) => {
    // @ts-ignore
    const env = (import.meta as any).env;
    if (env && env.DEV) return endpoint;
    let baseUrl = env?.VITE_API_URL;
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
        }, 8000); 
    });

    try {
      const url = getFullApiUrl(endpoint);
      const token = localStorage.getItem('auth_token');
      const headers: any = { 'Content-Type': 'application/json' };
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
          // If 403/401 sometimes it returns JSON, sometimes not.
          if (res.status === 401 || res.status === 403) {
              throw new Error("Unauthorized");
          }
          throw new Error("Server vrátil neplatná data.");
      }
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `API Chyba: ${res.status}`);
      return json;
    } catch (e: any) {
      if (e.message === 'TIMEOUT_LIMIT_REACHED' || e.name === 'AbortError') {
         showNotify('Nepodařilo se operaci dokončit z důvodu nedostupnosti DB.', 'error');
         setDbConnectionError(true);
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
          setAllUsers([]);
          setProducts([]);
          setOrders([]);
          setDiscountCodes([]);
          setDayConfigs([]);
          setSettings(EMPTY_SETTINGS);
          const data = await apiCall('/api/bootstrap', 'GET');
          if (data && data.success) {
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
              // showNotify("Připojeno k databázi.", 'success');
          } else {
              // Only if bootstrap specifically fails without throwing
              if(!data) setDbConnectionError(true);
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
          // showNotify("Přepnuto na lokální paměť.", 'success');
        }
      } catch (err: any) {
        showNotify('Kritická chyba při načítání aplikace: ' + err.message, 'error');
        setDbConnectionError(true);
      } finally {
        setIsLoading(false);
      }
  };

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

  const getImageUrl = (path: string) => {
      if (!path) return '';
      if (path.startsWith('data:') || path.startsWith('http')) return path;
      return getFullApiUrl(path);
  };

  const uploadImage = async (base64: string, name: string) => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/admin/upload', 'POST', { image: base64, name });
          if (res && res.success) return res.url;
          throw new Error('Upload failed');
      } else {
          return base64; // Keep base64 in local mode
      }
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
    showNotify(`Produkt "${product.name}" přidán do košíku`);
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
      if (removedCodes.length > 0) showNotify(`Slevový kupon ${removedCodes.join(', ')} byl odebrán.`, 'error');
    }
  }, [cart]);

  // ORDERS
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
      showNotify(`Objednávka #${order.id} byla vytvořena (Lokálně).`);
      return true;
    }
  };

  const updateOrder = async (order: Order, sendNotify?: boolean, isUserEdit?: boolean): Promise<boolean> => {
    let updatedOrder = { ...order };
    // If saving with no items, implicitly cancel? (Optional rule)
    if (updatedOrder.items.length === 0 && updatedOrder.status !== OrderStatus.CANCELLED) {
      updatedOrder.status = OrderStatus.CANCELLED;
    }
    
    // In local mode, just update array
    if (dataSource === 'local') {
       setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
       if (updatedOrder.status === OrderStatus.CREATED) showNotify(`Objednávka #${updatedOrder.id} upravena.`);
       return true;
    }

    // API Mode
    const payload = { ...updatedOrder, sendNotify };
    const res = await apiCall('/api/orders', 'POST', payload);
    if (res && res.success) {
        setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
        if (!isUserEdit) showNotify(`Objednávka #${updatedOrder.id} aktualizována.`);
        else showNotify(`Změny uloženy.`, 'success');
        return true;
    }
    return false;
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
          const msg = notify ? `Stav změněn a emaily odeslány (${ids.length})` : `Stav objednávek (${ids.length}) změněn v DB.`;
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
        showNotify(`Stav objednávek (${ids.length}) změněn na: ${t(`status.${status}`)}`);
        return true;
    }
  };

  const searchOrders = useCallback(async (params: any): Promise<OrdersSearchResult> => {
      if (dataSource === 'api') {
          const query = new URLSearchParams(params).toString();
          const res = await apiCall(`/api/orders?${query}`, 'GET');
          if (res && res.success) return res;
          return { orders: [], total: 0, page: 1, pages: 1 };
      } else {
          // Local Filtering
          let filtered = orders.filter(o => {
              if (params.id && !o.id.includes(params.id)) return false;
              if (params.userId && o.userId !== params.userId) return false;
              if (params.status && params.status !== o.status) return false;
              return true;
          });
          const start = ((params.page || 1) - 1) * (params.limit || 50);
          const paged = filtered.slice(start, start + (params.limit || 50));
          return { orders: paged, total: filtered.length, page: params.page || 1, pages: Math.ceil(filtered.length / (params.limit || 50)) };
      }
  }, [dataSource, orders, apiCall]);

  const searchUsers = useCallback(async (params: any): Promise<User[]> => {
      if (dataSource === 'api') {
          const query = new URLSearchParams(params).toString();
          const res = await apiCall(`/api/users?${query}`, 'GET');
          if (res && res.success) return res.users;
          return [];
      } else {
          return allUsers; 
      }
  }, [dataSource, allUsers, apiCall]);

  // PRODUCTS
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

  // USERS
  const addUser = async (name: string, email: string, phone: string, role: 'customer' | 'admin' | 'driver'): Promise<boolean> => {
    if (allUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) { alert('Uživatel již existuje.'); return false; }
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
            // showNotify('Profil aktualizován.');
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
            showNotify('Uživatel aktualizován v DB.');
            return true;
        }
        return false;
    } else {
        setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
        if (user && user.id === u.id) setUser(u);
        return true;
    }
  };

  // SETTINGS & CONFIGS
  const updateSettings = async (s: GlobalSettings): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/settings', 'POST', s);
        if (res && res.success) { setSettings(s); showNotify('Nastavení uloženo do DB.'); return true; }
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
            showNotify('Kalendář aktualizován v DB.'); return true;
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
        if (res && res.success) { setDayConfigs(prev => prev.filter(d => d.date !== date)); showNotify('Výjimka smazána z DB.'); return true; }
        return false;
    } else {
        setDayConfigs(prev => prev.filter(d => d.date !== date)); return true;
    }
  };

  // DISCOUNTS
  const addDiscountCode = async (c: DiscountCode): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/discounts', 'POST', c);
        if (res && res.success) { setDiscountCodes(prev => [...prev, c]); showNotify('Slevový kód uložen do DB.'); return true; }
        return false;
    } else {
        setDiscountCodes(prev => [...prev, c]); return true;
    }
  };

  const updateDiscountCode = async (code: DiscountCode): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/discounts', 'POST', code);
        if (res && res.success) { setDiscountCodes(prev => prev.map(x => x.id === code.id ? code : x)); showNotify('Slevový kód aktualizován v DB.'); return true; }
        return false;
    } else {
        setDiscountCodes(prev => prev.map(x => x.id === code.id ? code : x)); return true;
    }
  };

  const deleteDiscountCode = async (id: string): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall(`/api/discounts/${id}`, 'DELETE');
        if (res && res.success) { setDiscountCodes(prev => prev.filter(x => x.id !== id)); showNotify('Slevový kód smazán z DB.'); return true; }
        return false;
    } else {
        setDiscountCodes(prev => prev.filter(x => x.id !== id)); return true;
    }
  };

  // EVENT SLOTS (NEW)
  const updateEventSlot = async (slot: EventSlot): Promise<boolean> => {
      const newSlots = [...(settings.eventSlots || [])];
      const index = newSlots.findIndex(s => s.date === slot.date);
      if (index > -1) newSlots[index] = slot;
      else newSlots.push(slot);
      return await updateSettings({ ...settings, eventSlots: newSlots });
  };

  const removeEventSlot = async (date: string): Promise<boolean> => {
      const newSlots = (settings.eventSlots || []).filter(s => s.date !== date);
      return await updateSettings({ ...settings, eventSlots: newSlots });
  };

  const notifyEventSubscribers = async (date: string): Promise<boolean> => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/admin/notify-event', 'POST', { date });
          if (res && res.success) {
              showNotify(`Notifikace odeslána na ${res.count} emailů.`);
              return true;
          }
          return false;
      } else {
          showNotify('Simulace: Notifikace odeslána.');
          return true;
      }
  };

  // HELPER: Discount Calc
  const calculateDiscountAmount = (code: string, currentCart: CartItem[]): ValidateDiscountResult => {
    const dc = discountCodes.find(d => d.code.toUpperCase() === code.toUpperCase());
    if (!dc) return { success: false, error: t('discount.invalid') };
    if (!dc.enabled) return { success: false, error: 'Tento kód je již neaktivní.' };
    
    // Check global usage limit
    const actualUsage = orders.filter(o => o.status !== OrderStatus.CANCELLED && o.appliedDiscounts?.some(ad => ad.code === dc.code)).length;
    if (dc.maxUsage > 0 && actualUsage >= dc.maxUsage) return { success: false, error: t('discount.used_up') };
    
    // Check dates
    const now = new Date().toISOString().split('T')[0];
    if (dc.validFrom && now < dc.validFrom) return { success: false, error: t('discount.future') };
    if (dc.validTo && now > dc.validTo) return { success: false, error: t('discount.expired') };
    
    // Check values
    const cartTotal = currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const applicableItems = dc.applicableCategories && dc.applicableCategories.length > 0 
        ? currentCart.filter(item => dc.applicableCategories!.includes(item.category)) 
        : currentCart;
    const applicableTotal = applicableItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (dc.applicableCategories && dc.applicableCategories.length > 0 && applicableTotal === 0) 
        return { success: false, error: 'Sleva se nevztahuje na položky v košíku.' };
    
    const valueToCheck = (dc.applicableCategories && dc.applicableCategories.length > 0) ? applicableTotal : cartTotal;
    if (valueToCheck < dc.minOrderValue) return { success: false, error: t('discount.min_order', { min: dc.minOrderValue.toString() }) };

    let calculatedAmount = 0;
    if (dc.type === DiscountType.PERCENTAGE) calculatedAmount = Math.floor(applicableTotal * (dc.value / 100));
    else calculatedAmount = Math.min(dc.value, applicableTotal);
    return { success: true, discount: dc, amount: calculatedAmount };
  };

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
    // Volume logic
    const totalVolume = items.reduce((sum, item) => {
        if (item.noPackaging) return sum; // Skip items marked as no packaging
        return sum + (item.volume || 0) * item.quantity;
    }, 0);

    const cartPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (cartPrice >= settings.packaging.freeFrom) return 0;
    
    if (totalVolume === 0) return 0;

    const availableTypes = [...settings.packaging.types].sort((a, b) => a.volume - b.volume);
    if (availableTypes.length === 0) return 0;
    const largestBox = availableTypes[availableTypes.length - 1];
    let remainingVolume = totalVolume;
    let totalFee = 0;
    while (remainingVolume > 0) {
      if (remainingVolume > largestBox.volume) { totalFee += largestBox.price; remainingVolume -= largestBox.volume; } 
      else {
        const bestFit = availableTypes.find(type => type.volume >= remainingVolume);
        if (bestFit) { totalFee += bestFit.price; remainingVolume = 0; } else { totalFee += largestBox.price; remainingVolume -= largestBox.volume; }
      }
    }
    return totalFee;
  };

  // LOGISTICS & CAPACITY
  const getDailyLoad = (date: string, excludeOrderId?: string) => {
    const relevantOrders = orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED && o.id !== excludeOrderId);
    
    // Initialize standard load
    const load: Record<string, number> = {};
    (settings.categories || []).forEach(cat => load[cat.id] = 0);
    Object.values(ProductCategory).forEach(c => { if (load[c] === undefined) load[c] = 0; });
    
    // Initialize event load
    const eventLoad: Record<string, number> = {};
    Object.keys(load).forEach(k => eventLoad[k] = 0);

    const usedProductIds = new Set<string>();
    
    // Track overheads by Capacity Category (shared overhead)
    // Key: CapCatID, Value: { maxOverhead, maxOverheadCategory, hasEvent }
    const ccGroups = new Map<string, { maxOverhead: number, maxOverheadCategory: string, hasEvent: boolean }>();

    relevantOrders.forEach(order => {
      if (!order.items) return;
      order.items.forEach(item => {
        const productDef = products.find(p => String(p.id) === String(item.id));
        const itemWorkload = Number(productDef?.workload) || Number(item.workload) || 0;
        const itemOverhead = Number(productDef?.workloadOverhead) || Number(item.workloadOverhead) || 0;
        const cat = item.category || productDef?.category;
        const isEvent = !!productDef?.isEventProduct; // Check if this item is event-based
        const capCatId = productDef?.capacityCategoryId; // Shared capacity group

        if (cat) {
             // 1. Add variable workload (quantity based)
             if (isEvent) {
                 if (eventLoad[cat] === undefined) eventLoad[cat] = 0;
                 eventLoad[cat] += itemWorkload * item.quantity;
             } else {
                 if (load[cat] === undefined) load[cat] = 0;
                 load[cat] += itemWorkload * item.quantity;
             }

             // 2. Handle Overhead (Fixed per product type per order, OR shared by group)
             if (capCatId) {
                 // It belongs to a group. Find current max overhead for this group in this day/context?
                 // Wait, getDailyLoad is aggregative across ALL orders. Shared overhead is typically per order or per batch.
                 // Here we assume getDailyLoad sums up load from ALL orders. 
                 // If CapacityCategory means "Shared prep for the whole day", then we calc max across all orders? 
                 // NO, usually shared prep is per Order (e.g. heating up fryer). 
                 // But if it's "Fryer Capacity", it's global. 
                 // Let's assume CapacityCategory links products that share the SAME overhead resource GLOBALLY for that day 
                 // (e.g. 1 setup of fryer for the day). If it's per order, logic is different.
                 // Given the context of "Catering", usually prep overhead is per order/batch.
                 // BUT current logic in `checkAvailability` (old) was per order accumulation.
                 
                 // Let's stick to: Overhead is added per unique product in order (standard) OR per group if specified.
                 // Since we iterate orders, let's accumulate overheads.
                 // Complex shared overhead logic requires knowing if we batch production.
                 // Fallback to simple accumulation for now to match old logic, but respects event separation.
                 
                 if (!usedProductIds.has(String(item.id) + "_" + order.id)) { // unique per order item
                     if (isEvent) eventLoad[cat] += itemOverhead;
                     else load[cat] += itemOverhead;
                     usedProductIds.add(String(item.id) + "_" + order.id);
                 }
             } else {
                 // Standard behavior: Overhead added once per product type in the order
                 if (!usedProductIds.has(String(item.id) + "_" + order.id)) {
                     if (isEvent) eventLoad[cat] += itemOverhead;
                     else load[cat] += itemOverhead;
                     usedProductIds.add(String(item.id) + "_" + order.id);
                 }
             }
        }
      });
    });
    return { load, eventLoad };
  };

  const getAvailableEventDates = (product: Product): string[] => {
      if (!product.isEventProduct) return [];
      // Logic: Return dates from settings.eventSlots where:
      // 1. Date is in future (respecting lead time)
      // 2. Capacity for product category is > current load + product workload (1 unit min)
      
      const slots = settings.eventSlots || [];
      const today = new Date(); 
      today.setHours(0,0,0,0);
      
      const leadTime = product.leadTimeDays || 0;
      const minDate = new Date(today);
      minDate.setDate(minDate.getDate() + leadTime);

      return slots.filter(s => {
          const slotDate = new Date(s.date);
          slotDate.setHours(0,0,0,0);
          
          if (slotDate < minDate) return false;

          // Check capacity
          const catId = product.category;
          const limit = s.capacityOverrides?.[catId] ?? 0;
          if (limit <= 0) return false; // Closed category for this event

          const { eventLoad } = getDailyLoad(s.date);
          const currentLoad = eventLoad[catId] || 0;
          
          // Check if adding min quantity fits
          const minQty = product.minOrderQuantity || 1;
          const needed = (product.workload || 0) * minQty + (product.workloadOverhead || 0);
          
          return (currentLoad + needed) <= limit;
      }).map(s => s.date).sort();
  };

  const isEventCapacityAvailable = (product: Product): boolean => {
      // For event products, returns true if at least one future slot is available
      return getAvailableEventDates(product).length > 0;
  };

  const checkAvailability = (date: string, items: CartItem[], excludeOrderId?: string): CheckResult => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date); targetDate.setHours(0, 0, 0, 0);
    
    if (targetDate < today) return { allowed: false, reason: t('error.past'), status: 'past' };
    
    const maxLeadTime = items.length > 0 ? Math.max(...items.map(i => i.leadTimeDays || 0)) : 0;
    const minPossibleDate = new Date(today); minPossibleDate.setDate(minPossibleDate.getDate() + maxLeadTime);
    if (targetDate < minPossibleDate) return { allowed: false, reason: t('error.too_soon'), status: 'too_soon' };
    
    // EVENT CHECK
    // If cart contains ANY event items, the date MUST be an event slot
    const hasEventItems = items.some(i => i.isEventProduct);
    if (hasEventItems) {
        const eventSlot = settings.eventSlots?.find(s => s.date === date);
        if (!eventSlot) return { allowed: false, reason: t('cart.event_only'), status: 'closed' };
        
        // Check Event Capacities
        const { eventLoad } = getDailyLoad(date, excludeOrderId);
        let anyExceeds = false;
        
        items.filter(i => i.isEventProduct).forEach(item => {
             const cat = item.category;
             const limit = eventSlot.capacityOverrides?.[cat] ?? 0;
             if (limit <= 0) { anyExceeds = true; return; }
             
             const current = eventLoad[cat] || 0;
             const added = (item.workload || 0) * item.quantity + (item.workloadOverhead || 0);
             if (current + added > limit) anyExceeds = true;
        });
        
        if (anyExceeds) return { allowed: false, reason: t('cart.capacity_exceeded'), status: 'exceeds' };
    }

    // STANDARD CHECK (always runs, unless day strictly closed for standard)
    const config = dayConfigs.find(d => d.date === date);
    if (config && !config.isOpen) return { allowed: false, reason: t('error.day_closed'), status: 'closed' };
    
    // Check Standard Capacities (for non-event items)
    const standardItems = items.filter(i => !i.isEventProduct);
    if (standardItems.length > 0) {
        const { load } = getDailyLoad(date, excludeOrderId);
        let anyExceeds = false;
        const categoriesInCart = new Set(standardItems.map(i => i.category));
        
        for (const cat of categoriesInCart) {
            const limit = config?.capacityOverrides?.[cat] ?? settings.defaultCapacities[cat] ?? 0;
            const currentLoad = load[cat] || 0;
            
            // Calculate added load for this category from current cart
            const addedLoad = standardItems
                .filter(i => i.category === cat)
                .reduce((sum, item) => sum + (item.workload || 0) * item.quantity + (item.workloadOverhead || 0), 0);

            if (currentLoad + addedLoad > limit) {
                anyExceeds = true;
            }
        }
        if (anyExceeds) return { allowed: false, reason: t('cart.capacity_exceeded'), status: 'exceeds' };
    }
    
    return { allowed: true, status: 'available' };
  };

  const getDateStatus = (date: string, items: CartItem[]): DayStatus => {
     const check = checkAvailability(date, items);
     return check.status;
  };

  const login = async (email: string, password?: string) => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/users/login', 'POST', { email, password });
        if (res && res.success) {
            setUser(res.user);
            localStorage.setItem('session_user', JSON.stringify(res.user));
            if (res.token) localStorage.setItem('auth_token', res.token);
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
    if (allUsers.find(u => u.email.toLowerCase() === email.toLowerCase())) { 
        showNotify('Tento email je již registrován.', 'error');
        return; 
    }
    const newUser: User = { id: Date.now().toString(), name, email, phone, role: 'customer', billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword(password || '1234'), marketingConsent: false };
    
    if (dataSource === 'api') {
        apiCall('/api/users', 'POST', newUser).then(res => {
            if (res && res.success) { 
                showNotify('Registrace úspěšná. Nyní se prosím přihlaste.', 'success');
            }
        });
    } else {
        setAllUsers(prev => [...prev, newUser]); 
        setUser(newUser);
        localStorage.setItem('session_user', JSON.stringify(newUser));
    }
  };

  const logout = () => { setUser(null); localStorage.removeItem('session_user'); localStorage.removeItem('auth_token'); };
  
  const toggleUserBlock = async (id: string): Promise<boolean> => { const u = allUsers.find(x => x.id === id); if (u) { const updated = { ...u, isBlocked: !u.isBlocked }; return await updateUserAdmin(updated); } return false; };
  
  const sendPasswordReset = async (email: string) => { 
      if (dataSource === 'api') { 
          const res = await apiCall('/api/auth/reset-password', 'POST', { email }); 
          if (res && res.success) { return { success: true, message: res.message }; } 
          return { success: false, message: res?.message || 'Server error' }; 
      } 
      return { success: true, message: 'Email sent (simulated)' }; 
  };
  
  const resetPasswordByToken = async (token: string, newPass: string): Promise<PasswordChangeResult> => { 
      if (dataSource === 'api') { 
          const newHash = hashPassword(newPass); 
          const res = await apiCall('/api/auth/reset-password-confirm', 'POST', { token, newPasswordHash: newHash }); 
          if (res && res.success) { 
              await fetchData(); 
              return { success: true, message: res.message || 'Heslo úspěšně změněno.' }; 
          } else { 
              return { success: false, message: res?.message || 'Chyba serveru při změně hesla.' }; 
          } 
      } else { 
          return { success: true, message: 'Heslo změněno (Lokální simulace)' }; 
      } 
  };
  
  const changePassword = async (o: string, n: string) => { 
      if (!user) return { success: false, message: 'Login required' }; 
      if (hashPassword(o) !== user.passwordHash) return { success: false, message: 'Staré heslo nesouhlasí' }; 
      const u = { ...user, passwordHash: hashPassword(n) }; 
      await updateUser(u); 
      return { success: true, message: 'Změněno' }; 
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
      // In a real app this would download PDF from backend or generate locally
      // Placeholder
      alert(`Generating ${type} invoice for #${o.id}`);
  };
  
  const generateCzIban = calculateCzIban;

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-400">Načítám data...</div>;

  return (
    <StoreContext.Provider value={{
      dataSource, setDataSource,
      isLoading, isOperationPending, dbConnectionError, isPreviewEnvironment,
      language, setLanguage, 
      cart, cartBump, addToCart, removeFromCart, updateCartItemQuantity, clearCart, 
      user, allUsers, login, logout, register, updateUser, updateUserAdmin, toggleUserBlock, sendPasswordReset, resetPasswordByToken, changePassword, addUser,
      orders, addOrder, updateOrderStatus, updateOrder, checkOrderRestoration, searchOrders, searchUsers,
      products, addProduct, updateProduct, deleteProduct,
      discountCodes, appliedDiscounts, addDiscountCode, updateDiscountCode, deleteDiscountCode, applyDiscount, removeAppliedDiscount, validateDiscount,
      settings, updateSettings, dayConfigs, updateDayConfig, removeDayConfig, 
      updateEventSlot, removeEventSlot, notifyEventSubscribers, getAvailableEventDates, isEventCapacityAvailable,
      checkAvailability, getDateStatus, getDailyLoad, getDeliveryRegion, getRegionInfoForDate,
      getPickupPointInfo,
      calculatePackagingFee,
      t, tData, generateInvoice, printInvoice, generateCzIban, getImageUrl, uploadImage, getFullApiUrl,
      importDatabase, globalNotification, dismissNotification,
      isAuthModalOpen, openAuthModal, closeAuthModal, removeDiacritics, formatDate,
      cookieSettings, saveCookieSettings
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
