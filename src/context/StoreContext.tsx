
import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import { CartItem, Language, Product, User, Order, GlobalSettings, DayConfig, ProductCategory, OrderStatus, PaymentMethod, DiscountCode, DiscountType, AppliedDiscount, DeliveryRegion, PackagingType, CompanyDetails, BackupData, PickupLocation, DeliveryType, LocalizedContent } from '../types';
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
  language: Language;
  setLanguage: (lang: Language) => void;
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartItemQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  user: User | null;
  allUsers: User[];
  login: (email: string, password?: string) => { success: boolean; message?: string };
  register: (name: string, email: string, phone: string, password?: string) => void; // Updated signature
  logout: () => void;
  updateUser: (user: User) => Promise<boolean>; 
  updateUserAdmin: (user: User) => Promise<boolean>; 
  toggleUserBlock: (userId: string) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<void>;
  resetPasswordByToken: (token: string, newPass: string) => Promise<PasswordChangeResult>;
  changePassword: (oldPass: string, newPass: string) => PasswordChangeResult;
  addUser: (name: string, email: string, phone: string, role: 'customer' | 'admin' | 'driver') => Promise<boolean>; // Updated signature
  
  orders: Order[];
  addOrder: (order: Order) => Promise<boolean>;
  updateOrderStatus: (orderIds: string[], status: OrderStatus, sendNotify?: boolean) => Promise<boolean>;
  updateOrder: (order: Order, sendNotify?: boolean) => Promise<boolean>;
  checkOrderRestoration: (order: Order) => RestorationCheckResult;
  
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
  
  checkAvailability: (date: string, cartItems: CartItem[], excludeOrderId?: string) => CheckResult;
  getDateStatus: (date: string, cartItems: CartItem[]) => DayStatus;
  getDailyLoad: (date: string, excludeOrderId?: string) => Record<string, number>;
  getDeliveryRegion: (zip: string) => DeliveryRegion | undefined;
  getRegionInfoForDate: (region: DeliveryRegion, date: string) => RegionDateInfo;
  getPickupPointInfo: (location: PickupLocation, date: string) => RegionDateInfo; // NEW
  calculatePackagingFee: (items: CartItem[]) => number;
  
  t: (key: string, params?: Record<string, string>) => string;
  tData: (obj: any, field: string) => string; // NEW HELPER
  generateInvoice: (order: Order) => string;
  printInvoice: (order: Order) => Promise<void>;
  generateCzIban: (accountStr: string) => string;
  removeDiacritics: (str: string) => string;
  formatDate: (dateStr: string) => string;
  
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

// Helper for fetching Fonts/Images
const fetchAsBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
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
    return (localStorage.getItem('app_data_source') as DataSourceMode) || 'local';
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isOperationPending, setIsOperationPending] = useState(false);
  const [language, setLanguage] = useState<Language>(Language.CS);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [globalNotification, setGlobalNotification] = useState<GlobalNotification | null>(null);

  const t = (key: string, params?: Record<string, string>) => {
    let text = TRANSLATIONS[language]?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  const tData = (obj: any, field: string): string => {
    if (!obj) return '';
    // If current language is CS, return original field directly
    if (language === Language.CS) return obj[field] || '';
    
    // Check if translations exist for current language
    const translated = obj.translations?.[language]?.[field];
    if (translated) return translated;
    
    // Fallback to original
    return obj[field] || '';
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

  // ... (API calls and useEffects omitted for brevity as they are unchanged) ...
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

  const apiCall = async (endpoint: string, method: string, body?: any) => {
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
              showNotify("Připojeno k databázi.", 'success');
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
          showNotify("Přepnuto na lokální paměť.", 'success');
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
    showNotify(`Produkt "${tData(product, 'name')}" přidán do košíku`);
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
        showNotify(`Objednávka #${order.id} byla uložena do DB.`);
        return true;
      }
      return false;
    } else {
      setOrders(prev => [orderWithHistory, ...prev]);
      showNotify(`Objednávka #${order.id} byla vytvořena (Lokálně).`);
      return true;
    }
  };

  const updateOrder = async (order: Order, sendNotify?: boolean): Promise<boolean> => {
    let updatedOrder = { ...order };
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
          if (updatedOrder.status === OrderStatus.CREATED) showNotify(`Objednávka #${updatedOrder.id} aktualizována v DB.`);
          return true;
       }
       return false;
    } else {
       setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
       if (updatedOrder.status === OrderStatus.CREATED) showNotify(`Objednávka #${updatedOrder.id} upravena.`);
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

  const addUser = async (name: string, email: string, phone: string, role: 'customer' | 'admin' | 'driver'): Promise<boolean> => {
    if (allUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) { alert('Uživatel již existuje.'); return false; }
    const newUser: User = { id: Date.now().toString(), name, email, phone, role, billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword('1234'), marketingConsent: false };
    
    if (dataSource === 'api') {
        const res = await apiCall('/api/users', 'POST', newUser);
        if (res && res.success) {
            setAllUsers(prev => [...prev, newUser]);
            showNotify(`Uživatel ${name} vytvořen a email odeslán.`, 'success', false);
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
            showNotify('Uživatel aktualizován v DB.');
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

  const calculateDiscountAmount = (code: string, currentCart: CartItem[]): ValidateDiscountResult => {
    const dc = discountCodes.find(d => d.code.toUpperCase() === code.toUpperCase());
    if (!dc) return { success: false, error: t('discount.invalid') };
    if (!dc.enabled) return { success: false, error: 'Tento kód je již neaktivní.' };
    const actualUsage = orders.filter(o => o.status !== OrderStatus.CANCELLED && o.appliedDiscounts?.some(ad => ad.code === dc.code)).length;
    if (dc.maxUsage > 0 && actualUsage >= dc.maxUsage) return { success: false, error: t('discount.used_up') };
    const now = new Date().toISOString().split('T')[0];
    if (dc.validFrom && now < dc.validFrom) return { success: false, error: t('discount.future') };
    if (dc.validTo && now > dc.validTo) return { success: false, error: t('discount.expired') };
    
    const cartTotal = currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const applicableItems = dc.applicableCategories && dc.applicableCategories.length > 0 ? currentCart.filter(item => dc.applicableCategories!.includes(item.category)) : currentCart;
    const applicableTotal = applicableItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (dc.applicableCategories && dc.applicableCategories.length > 0 && applicableTotal === 0) return { success: false, error: 'Sleva se nevztahuje na položky v košíku.' };
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
    const totalVolume = items.reduce((sum, item) => sum + (item.volume || 0) * item.quantity, 0);
    const cartPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (cartPrice >= settings.packaging.freeFrom) return 0;
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

  const getDailyLoad = (date: string, excludeOrderId?: string) => {
    const relevantOrders = orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED && o.id !== excludeOrderId);
    // Initialize load based on configured categories to avoid undefined keys
    const load: Record<string, number> = {};
    (settings.categories || []).forEach(cat => load[cat.id] = 0);
    
    // Also include 'Legacy' keys if they exist in products but not in categories settings
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
             if (!usedProductIds.has(String(item.id))) { load[cat] += itemOverhead; usedProductIds.add(String(item.id)); }
        }
      });
    });
    return load;
  };

  const checkAvailability = (date: string, items: CartItem[], excludeOrderId?: string): CheckResult => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date); targetDate.setHours(0, 0, 0, 0);
    if (targetDate < today) return { allowed: false, reason: 'error.past', status: 'past' };
    const categoriesInCart = new Set(items.map(i => i.category));
    const maxLeadTime = items.length > 0 ? Math.max(...items.map(i => i.leadTimeDays || 0)) : 0;
    const minPossibleDate = new Date(today); minPossibleDate.setDate(minPossibleDate.getDate() + maxLeadTime);
    if (targetDate < minPossibleDate) return { allowed: false, reason: 'error.too_soon', status: 'too_soon' };
    const config = dayConfigs.find(d => d.date === date);
    if (config && !config.isOpen) return { allowed: false, reason: 'error.day_closed', status: 'closed' };
    
    const load = getDailyLoad(date, excludeOrderId);
    
    // Simulate adding current cart to load
    items.forEach(item => {
       const productDef = products.find(p => String(p.id) === String(item.id));
       const workload = Number(productDef?.workload) || Number(item.workload) || 0;
       const overhead = Number(productDef?.workloadOverhead) || Number(item.workloadOverhead) || 0;
       if (load[item.category] !== undefined) {
          load[item.category] += workload * item.quantity;
          load[item.category] += overhead;
       }
    });
    
    let anyExceeds = false;
    // Check limits for all categories present in the cart or generally configured
    const catsToCheck = new Set([...Array.from(categoriesInCart), ...settings.categories.map(c => c.id)]);
    
    for (const cat of catsToCheck) {
      if (items.length > 0 && !categoriesInCart.has(cat)) continue; // Only check categories relevant to cart if cart provided
      
      const limit = config?.capacityOverrides?.[cat] ?? settings.defaultCapacities[cat] ?? 0;
      const currentLoad = load[cat] || 0;
      
      if (currentLoad > limit) {
          anyExceeds = true;
          // console.log(`Exceeded: Cat ${cat}, Load ${currentLoad} > Limit ${limit}`);
      }
    }
    
    if (anyExceeds) return { allowed: false, reason: 'error.capacity_exceeded', status: 'exceeds' };
    return { allowed: true, status: 'available' };
  };

  const getDateStatus = (date: string, items: CartItem[]): DayStatus => {
     const check = checkAvailability(date, items);
     return check.status;
  };

  const login = (email: string, password?: string) => {
    const foundUser = allUsers.find(u => u.email === email);
    if (foundUser) {
      if (foundUser.isBlocked) return { success: false, message: 'Blokován.' };
      if (password && foundUser.passwordHash !== hashPassword(password)) return { success: false, message: 'Chybné heslo.' };
      setUser(foundUser); 
      return { success: true };
    }
    return { success: false, message: 'Nenalezen.' };
  };

  const register = (name: string, email: string, phone: string, password?: string) => {
    if (allUsers.find(u => u.email.toLowerCase() === email.toLowerCase())) { 
        showNotify('Tento email je již registrován.', 'error');
        return; 
    }
    const newUser: User = { id: Date.now().toString(), name, email, phone, role: 'customer', billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword(password || '1234'), marketingConsent: false };
    
    if (dataSource === 'api') {
        apiCall('/api/users', 'POST', newUser).then(res => {
            if (res && res.success) { setAllUsers(prev => [...prev, newUser]); setUser(newUser); }
        });
    } else {
        setAllUsers(prev => [...prev, newUser]); setUser(newUser); 
    }
  };

  const logout = () => { setUser(null); localStorage.removeItem('session_user'); };
  const toggleUserBlock = async (id: string): Promise<boolean> => { const u = allUsers.find(x => x.id === id); if (u) { const updated = { ...u, isBlocked: !u.isBlocked }; return await updateUserAdmin(updated); } return false; };
  const sendPasswordReset = async (email: string) => { if (dataSource === 'api') { const res = await apiCall('/api/auth/reset-password', 'POST', { email }); if (res && res.success) { showNotify(res.message || 'Email odeslán.', 'success', false); } else { showNotify(res?.message || 'Chyba serveru', 'error'); } } else { alert('Simulace (Lokální mód): Reset link odeslán.'); } };
  const resetPasswordByToken = async (token: string, newPass: string): Promise<PasswordChangeResult> => { if (dataSource === 'api') { const newHash = hashPassword(newPass); const res = await apiCall('/api/auth/reset-password-confirm', 'POST', { token, newPasswordHash: newHash }); if (res && res.success) { await fetchData(); return { success: true, message: res.message || 'Heslo úspěšně změněno.' }; } else { return { success: false, message: res?.message || 'Chyba serveru při změně hesla.' }; } } else { return { success: true, message: 'Heslo změněno (Lokální simulace)' }; } };
  const changePassword = (o: string, n: string) => { if (!user) return { success: false, message: 'Login required' }; if (hashPassword(o) !== user.passwordHash) return { success: false, message: 'Staré heslo nesouhlasí' }; const u = { ...user, passwordHash: hashPassword(n) }; updateUser(u); return { success: true, message: 'Změněno' }; };
  const getDeliveryRegion = (zip: string) => settings.deliveryRegions.find(r => r.enabled && r.zips.includes(zip.replace(/\s/g,'')));
  const getRegionInfoForDate = (r: DeliveryRegion, d: string) => { const ex = r.exceptions?.find(e => e.date === d); return ex ? { isOpen: ex.isOpen, timeStart: ex.deliveryTimeStart, timeEnd: ex.deliveryTimeEnd, isException: true } : { isOpen: true, timeStart: r.deliveryTimeStart, timeEnd: r.deliveryTimeEnd, isException: false }; };
  
  // NEW: Helper for Pickup Location opening logic
  const getPickupPointInfo = (location: PickupLocation, dateStr: string): RegionDateInfo => {
      // 1. Check Exceptions
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

      // 2. Check Standard Opening Hours
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay(); // 0 = Sun, 1 = Mon...
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
  
  // UPDATED IMPORT LOGIC
  const importDatabase = async (d: BackupData, s: any): Promise<ImportResult> => {
    if (dataSource === 'api') {
        try {
            const res = await apiCall('/api/admin/import', 'POST', { data: d, selection: s });
            if (res && res.success) {
                await fetchData(); // Refresh data from backend to ensure UI is in sync
                return { success: true };
            }
            return { success: false, message: res?.error || 'Import failed on server.' };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    } else {
        // Local Logic
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
  
  const printInvoice = async (o: Order) => {
      showNotify("Generuji fakturu...", "success");
      
      const doc = new jsPDF();
      
      // --- FONT LOADING (CZ SUPPORT) ---
      try {
          const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
          const fontBase64 = await fetchAsBase64(fontUrl);
          // Split base64 prefix
          const pureBase64 = fontBase64.split(',')[1];
          doc.addFileToVFS("Roboto-Regular.ttf", pureBase64);
          doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
          // CRITICAL: Set this font and NEVER switch to "bold" string alias if bold font is not loaded
          doc.setFont("Roboto", "normal"); 
      } catch (e) {
          console.error("Failed to load font:", e);
          // Fallback to standard font (diacritics will fail)
          showNotify("Nepodařilo se načíst český font. Faktura může mít poškozené znaky.", "error");
      }

      // --- LOGIC: IS VAT PAYER? ---
      // Check if Supplier has DIC filled in settings or snapshot
      const supplierDic = o.companyDetailsSnapshot?.dic || settings.companyDetails.dic;
      const isVatPayer = !!supplierDic && supplierDic.trim().length > 0;

      const pageWidth = doc.internal.pageSize.width;
      const rightMargin = pageWidth - 10;
      let y = 20;

      // --- HEADER ---
      doc.setFontSize(18);
      // NOTE: Using "normal" font with larger size instead of "bold" to preserve diacritics
      doc.setFont("Roboto", "normal"); 
      doc.text(`FAKTURA - DAŇOVÝ DOKLAD č. ${o.id}`, 10, y);
      
      doc.setFontSize(10);
      doc.setFont("Roboto", "normal");
      y += 10;
      doc.text(`Datum vystavení: ${formatDate(o.createdAt)}`, 10, y);
      y += 5;
      
      if (isVatPayer) {
          doc.text(`Datum zdan. plnění: ${formatDate(o.createdAt)}`, 10, y);
          y += 5;
      }
      
      // Variable Symbol
      const vs = o.id.replace(/\D/g, '') || '0';
      doc.text(`Var. symbol: ${vs}`, 10, y);
      y += 5;
      
      // --- SUPPLIER & CUSTOMER ---
      const ySection = y + 10;
      
      // SUPPLIER (Left)
      doc.setFontSize(12);
      doc.setFont("Roboto", "normal"); // Keep normal for consistency
      doc.text('DODAVATEL:', 10, ySection);
      doc.setFont("Roboto", "normal");
      doc.setFontSize(10);
      let ySup = ySection + 5;
      const comp = o.companyDetailsSnapshot || settings.companyDetails;
      
      doc.text(comp.name || '', 10, ySup); ySup += 5;
      doc.text(comp.street || '', 10, ySup); ySup += 5;
      doc.text(`${comp.zip || ''} ${comp.city || ''}`, 10, ySup); ySup += 5;
      doc.text(`IČ: ${comp.ic || ''}`, 10, ySup); ySup += 5;
      if (comp.dic) { doc.text(`DIČ: ${comp.dic}`, 10, ySup); ySup += 5; }
      doc.text(`Účet: ${comp.bankAccount || ''}`, 10, ySup); ySup += 5;
      
      // CUSTOMER (Right)
      doc.setFontSize(12);
      doc.setFont("Roboto", "normal");
      doc.text('ODBĚRATEL:', 110, ySection);
      doc.setFont("Roboto", "normal");
      doc.setFontSize(10);
      let yCust = ySection + 5;
      
      doc.text(o.userName || 'Zákazník', 110, yCust); yCust += 5;
      
      const addressLines = (o.billingAddress || '').split(/,|\n/).map(s => s.trim());
      addressLines.forEach(line => {
          if(line) { doc.text(line, 110, yCust); yCust += 5; }
      });

      // --- PAYMENT METHOD ---
      y = Math.max(ySup, yCust) + 10;
      doc.text(`Způsob úhrady: ${o.paymentMethod.toUpperCase()}`, 10, y);
      y += 10;

      // --- ITEMS TABLE ---
      doc.line(10, y, pageWidth - 10, y);
      y += 5;
      doc.setFont("Roboto", "normal"); // Ensure font is set
      
      if (isVatPayer) {
          // Columns: Položka | Ks | Cena/j bez DPH | Sazba | DPH (částka) | Celkem s DPH
          doc.text('Položka', 10, y);
          doc.text('Ks', 85, y);
          doc.text('Základ', 95, y);
          doc.text('Sazba', 125, y);
          doc.text('DPH', 145, y); // New column for VAT Amount
          doc.text('Celkem', 175, y);
      } else {
          // Columns: Položka | Ks | Cena/j | Celkem
          doc.text('Položka', 10, y);
          doc.text('Ks', 120, y);
          doc.text('Cena/j', 140, y);
          doc.text('Celkem', 170, y);
      }
      
      doc.setFont("Roboto", "normal");
      y += 3;
      doc.line(10, y, pageWidth - 10, y);
      y += 7;

      // VAT Calculation Buckets
      const vatSummary: Record<number, { base: number, tax: number, total: number }> = {};
      let maxVatRate = 0; // Track max rate found for fees
      
      const addToVat = (rate: number, priceTotalWithVat: number) => {
          if (!vatSummary[rate]) vatSummary[rate] = { base: 0, tax: 0, total: 0 };
          
          // Reverse calculation from Price With VAT
          // Base = Total / (1 + rate/100)
          const base = priceTotalWithVat / (1 + rate / 100);
          const tax = priceTotalWithVat - base;
          
          vatSummary[rate].base += base;
          vatSummary[rate].tax += tax;
          vatSummary[rate].total += priceTotalWithVat;
      };

      // Loop items
      o.items.forEach(item => {
          let name = item.name;
          if (name.length > 35) name = name.substring(0, 32) + '...';
          
          const itemTotal = item.price * item.quantity;
          
          if (isVatPayer) {
              // Determine VAT Rate
              const rate = o.deliveryType === DeliveryType.DELIVERY || o.deliveryType === DeliveryType.PICKUP 
                  ? (item.vatRateTakeaway || 15) // Fallback 15% standard food
                  : (item.vatRateInner || 12);
              
              if (rate > maxVatRate) maxVatRate = rate;

              const totalItemBase = itemTotal / (1 + rate / 100);
              const totalItemVat = itemTotal - totalItemBase;
              
              doc.text(name, 10, y);
              doc.text(item.quantity.toString(), 85, y);
              doc.text(totalItemBase.toFixed(2), 95, y);
              doc.text(`${rate}%`, 125, y);
              doc.text(totalItemVat.toFixed(2), 145, y);
              doc.text(itemTotal.toFixed(2), 175, y);
              
              addToVat(rate, itemTotal);
          } else {
              doc.text(name, 10, y);
              doc.text(item.quantity.toString(), 120, y);
              doc.text(item.price.toString(), 140, y);
              doc.text(itemTotal.toString(), 170, y);
          }
          y += 7;
      });

      // Default max VAT if no items (fallback)
      if (maxVatRate === 0) maxVatRate = 21;

      // Fees (Packaging, Delivery) -> Dynamic Rate based on highest item rate
      const feesVatRate = maxVatRate; 
      
      if (o.packagingFee > 0) {
          doc.text('Balné', 10, y);
          doc.text('1', isVatPayer ? 85 : 120, y);
          
          if (isVatPayer) {
              const base = o.packagingFee / (1 + feesVatRate/100);
              const tax = o.packagingFee - base;
              
              doc.text(base.toFixed(2), 95, y);
              doc.text(`${feesVatRate}%`, 125, y);
              doc.text(tax.toFixed(2), 145, y);
              doc.text(o.packagingFee.toString(), 175, y);
              addToVat(feesVatRate, o.packagingFee);
          } else {
              doc.text(o.packagingFee.toString(), 140, y);
              doc.text(o.packagingFee.toString(), 170, y);
          }
          y += 7;
      }
      
      if (o.deliveryFee > 0) {
          doc.text('Doprava', 10, y);
          doc.text('1', isVatPayer ? 85 : 120, y);
          
          if (isVatPayer) {
              const base = o.deliveryFee / (1 + feesVatRate/100);
              const tax = o.deliveryFee - base;
              
              doc.text(base.toFixed(2), 95, y);
              doc.text(`${feesVatRate}%`, 125, y);
              doc.text(tax.toFixed(2), 145, y);
              doc.text(o.deliveryFee.toString(), 175, y);
              addToVat(feesVatRate, o.deliveryFee);
          } else {
              doc.text(o.deliveryFee.toString(), 140, y);
              doc.text(o.deliveryFee.toString(), 170, y);
          }
          y += 7;
      }

      // Discounts
      if (o.appliedDiscounts && o.appliedDiscounts.length > 0) {
          o.appliedDiscounts.forEach(d => {
              doc.setTextColor(200, 0, 0); // Red
              doc.text(`Sleva (${d.code})`, 10, y);
              
              const negativeAmount = -d.amount;
              if (isVatPayer) {
                  // Discount subtracted from highest VAT bucket simplistically for display
                  const base = negativeAmount / (1 + feesVatRate/100);
                  const tax = negativeAmount - base;
                  
                  doc.text(base.toFixed(2), 95, y);
                  doc.text(`${feesVatRate}%`, 125, y);
                  doc.text(tax.toFixed(2), 145, y);
                  doc.text(negativeAmount.toString(), 175, y);
                  
                  addToVat(feesVatRate, negativeAmount);
              } else {
                  doc.text(negativeAmount.toString(), 170, y);
              }
              doc.setTextColor(0, 0, 0);
              y += 7;
          });
      }

      doc.line(10, y, pageWidth - 10, y);
      y += 10;

      // --- RECAPITULATION (VAT Payer Only) ---
      if (isVatPayer) {
          doc.setFontSize(9);
          doc.text('Rekapitulace DPH (v Kč):', 10, y);
          y += 5;
          doc.setFont("Roboto", "normal");
          doc.text('Sazba', 10, y);
          doc.text('Základ', 40, y);
          doc.text('Daň', 70, y);
          doc.text('Celkem', 100, y);
          doc.setFont("Roboto", "normal");
          y += 5;

          let totalBase = 0;
          let totalTax = 0;

          Object.keys(vatSummary).forEach(rKey => {
              const r = Number(rKey);
              const data = vatSummary[r];
              doc.text(`${r}%`, 10, y);
              doc.text(data.base.toFixed(2), 40, y);
              doc.text(data.tax.toFixed(2), 70, y);
              doc.text(data.total.toFixed(2), 100, y);
              
              totalBase += data.base;
              totalTax += data.tax;
              y += 5;
          });
          
          doc.line(10, y, 130, y);
          y += 5;
          doc.setFont("Roboto", "normal");
          doc.text('Součet', 10, y);
          doc.text(totalBase.toFixed(2), 40, y);
          doc.text(totalTax.toFixed(2), 70, y);
          doc.setFont("Roboto", "normal");
          y += 15;
      }

      // --- TOTAL & QR ---
      const discountSum = o.appliedDiscounts?.reduce((acc, d) => acc + d.amount, 0) || 0;
      const finalTotal = Math.max(0, o.totalPrice - discountSum) + o.packagingFee + (o.deliveryFee || 0);

      doc.setFontSize(14);
      doc.setFont("Roboto", "normal");
      // Fixed alignment using right margin
      doc.text(`CELKEM K ÚHRADĚ: ${finalTotal.toFixed(2)} Kč`, rightMargin, y, { align: 'right' });
      
      // QR Code Generation & Embedding
      try {
          const iban = calculateCzIban(settings.companyDetails.bankAccount).replace(/\s/g,'');
          const bic = settings.companyDetails.bic ? `+${settings.companyDetails.bic}` : '';
          const acc = `ACC:${iban}${bic}`;
          const msg = removeDiacritics(`Objednavka ${o.id}`);
          const qrString = `SPD*1.0*${acc}*AM:${finalTotal.toFixed(2)}*CC:CZK*X-VS:${vs}*MSG:${msg}`;
          
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrString)}`;
          const qrBase64 = await fetchAsBase64(qrUrl);
          
          // Add QR image (x, y, w, h)
          doc.addImage(qrBase64, 'PNG', 150, y + 5, 40, 40);
          doc.setFontSize(8);
          doc.setFont("Roboto", "normal");
          doc.text('QR Platba', 160, y + 48);
          
      } catch (err) {
          console.error("QR Code generation failed for PDF:", err);
      }

      // Save
      doc.save(`faktura_${o.id}.pdf`);
      showNotify("Faktura stažena.", "success");
  };
  
  const generateCzIban = calculateCzIban;

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-400">Načítám data...</div>;

  return (
    <StoreContext.Provider value={{
      dataSource, setDataSource,
      isLoading, isOperationPending, // EXPORTED
      language, setLanguage, cart, addToCart, removeFromCart, updateCartItemQuantity, clearCart, 
      user, allUsers, login, logout, register, updateUser, updateUserAdmin, toggleUserBlock, sendPasswordReset, resetPasswordByToken, changePassword, addUser,
      orders, addOrder, updateOrderStatus, updateOrder, checkOrderRestoration, products, addProduct, updateProduct, deleteProduct,
      discountCodes, appliedDiscounts, addDiscountCode, updateDiscountCode, deleteDiscountCode, applyDiscount, removeAppliedDiscount, validateDiscount,
      settings, updateSettings, dayConfigs, updateDayConfig, removeDayConfig, checkAvailability, getDateStatus, getDailyLoad, getDeliveryRegion, getRegionInfoForDate,
      getPickupPointInfo,
      calculatePackagingFee,
      t, tData, generateInvoice, printInvoice, generateCzIban, importDatabase, globalNotification, dismissNotification,
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
