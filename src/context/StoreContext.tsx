
import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import { CartItem, Language, Product, User, Order, GlobalSettings, DayConfig, ProductCategory, OrderStatus, PaymentMethod, DiscountCode, DiscountType, AppliedDiscount, DeliveryRegion, PackagingType, CompanyDetails, BackupData, PickupLocation, OrdersSearchResult, EventSlot, CookieSettings, DataSourceMode, ImportResult } from '../types';
import { MOCK_ORDERS, PRODUCTS as INITIAL_PRODUCTS, DEFAULT_SETTINGS, EMPTY_SETTINGS } from '../constants';
import { TRANSLATIONS } from '../translations';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateDailyLoad, calculatePackagingFeeLogic, calculateDiscountAmountLogic, DailyLoadResult, getAvailableEventDatesLogic } from '../utils/orderLogic';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';

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
  sendPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPasswordByToken: (token: string, newPass: string) => Promise<PasswordChangeResult>;
  changePassword: (oldPass: string, newPass: string) => PasswordChangeResult;
  addUser: (name: string, email: string, phone: string, role: 'customer' | 'admin' | 'driver') => Promise<boolean>;
  
  orders: Order[];
  searchOrders: (filters: any) => Promise<OrdersSearchResult>;
  searchUsers: (filters: { search?: string }) => Promise<User[]>;
  addOrder: (order: Order) => Promise<boolean>;
  updateOrderStatus: (orderIds: string[], status: OrderStatus, sendNotify?: boolean) => Promise<boolean>;
  updateOrder: (order: Order, sendNotify?: boolean, isUserEdit?: boolean) => Promise<boolean>;
  checkOrderRestoration: (order: Order) => RestorationCheckResult;
  
  products: Product[];
  addProduct: (product: Product) => Promise<boolean>;
  updateProduct: (product: Product) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
  uploadImage: (base64: string, name?: string) => Promise<string>;
  getImageUrl: (path: string | undefined) => string;
  
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
  updateEventSlot: (slot: EventSlot) => Promise<void>;
  removeEventSlot: (date: string) => Promise<void>;
  
  checkAvailability: (date: string, cartItems: CartItem[], excludeOrderId?: string) => CheckResult;
  getDateStatus: (date: string, cartItems: CartItem[]) => DayStatus;
  getDailyLoad: (date: string) => DailyLoadResult;
  getDeliveryRegion: (zip: string) => DeliveryRegion | undefined;
  getRegionInfoForDate: (region: DeliveryRegion, date: string) => RegionDateInfo;
  getPickupPointInfo: (location: PickupLocation, date: string) => RegionDateInfo;
  calculatePackagingFee: (items: CartItem[]) => number;
  getAvailableEventDates: (product: Product) => string[];
  isEventCapacityAvailable: (product: Product) => boolean;
  
  t: (key: string, params?: Record<string, string>) => string;
  tData: (obj: any, key: string) => string;
  generateInvoice: (order: Order) => string;
  printInvoice: (order: Order, type?: 'proforma' | 'final') => Promise<void>;
  generateCzIban: (accountStr: string) => string;
  removeDiacritics: (str: string) => string;
  formatDate: (dateStr: string) => string;
  getFullApiUrl: (path: string) => string;
  
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

// Helper for ArrayBuffer to Base64 in Browser
const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

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
      const val = obj[key];
      if (obj.translations && obj.translations[language] && obj.translations[language][key]) {
          return obj.translations[language][key];
      }
      return val;
  };

  // Data States
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>([]);
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);

  const isPreviewEnvironment = dataSource === 'local';

  const setDataSource = (mode: DataSourceMode) => {
    localStorage.setItem('app_data_source', mode);
    setDataSourceState(mode);
  };

  const showNotify = useCallback((message: string, type: 'success' | 'error' = 'success', autoClose: boolean = true) => {
    setGlobalNotification({ message, type, autoClose });
  }, []);

  const dismissNotification = useCallback(() => setGlobalNotification(null), []);

  const saveCookieSettings = (s: CookieSettings) => {
      setCookieSettings(s);
      localStorage.setItem('cookie_settings', JSON.stringify(s));
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
  }, [showNotify]);

  const fetchData = useCallback(async () => {
      setIsLoading(true);
      setDbConnectionError(false);
      try {
        if (dataSource === 'api') {
          // Reset to prevent stale data
          setOrders([]); setProducts([]); setDiscountCodes([]); setDayConfigs([]); setSettings(EMPTY_SETTINGS);
          
          const data = await apiCall('/api/bootstrap', 'GET');
          if (data) {
              if (data.users) auth.setAllUsers(data.users); // Update users via Auth hook
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
              // REMOVED SUCCESS NOTIFICATION
          } else {
              setDbConnectionError(true);
          }
        } else {
          auth.setAllUsers(loadFromStorage('db_users', auth.INITIAL_USERS));
          setProducts(loadFromStorage('db_products', INITIAL_PRODUCTS));
          setOrders(loadFromStorage('db_orders', MOCK_ORDERS));
          
          const loadedSettings = loadFromStorage('db_settings', DEFAULT_SETTINGS);
          if (!loadedSettings.categories) loadedSettings.categories = DEFAULT_SETTINGS.categories;
          if (!loadedSettings.pickupLocations) loadedSettings.pickupLocations = DEFAULT_SETTINGS.pickupLocations;
          
          setSettings(loadedSettings);
          setDiscountCodes(loadFromStorage('db_discounts', []));
          setDayConfigs(loadFromStorage('db_dayconfigs', []));
          // REMOVED SUCCESS NOTIFICATION
        }
      } catch (err: any) {
        showNotify('Kritická chyba při načítání aplikace: ' + err.message, 'error');
        setDbConnectionError(true);
      } finally {
        setIsLoading(false);
      }
  }, [dataSource, apiCall, showNotify]);

  // Use Custom Hooks
  const auth = useAuth(dataSource, apiCall, showNotify, fetchData);
  const cartState = useCart((msg) => showNotify(msg, 'success'));

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Persist Local Data
  useEffect(() => {
    if (dataSource === 'local') {
      localStorage.setItem('db_users', JSON.stringify(auth.allUsers));
      localStorage.setItem('db_orders', JSON.stringify(orders));
      localStorage.setItem('db_products', JSON.stringify(products));
      localStorage.setItem('db_discounts', JSON.stringify(discountCodes));
      localStorage.setItem('db_settings', JSON.stringify(settings));
      localStorage.setItem('db_dayconfigs', JSON.stringify(dayConfigs));
    }
  }, [auth.allUsers, orders, products, discountCodes, settings, dayConfigs, dataSource]);

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  // --- LOGIC EXTRACTED TO UTILS BUT EXPOSED HERE ---

  const calculatePackagingFee = (items: CartItem[]) => calculatePackagingFeeLogic(items, settings.packaging.types, settings.packaging.freeFrom);
  
  const validateDiscount = (code: string, currentCart: CartItem[]) => calculateDiscountAmountLogic(code, currentCart, discountCodes, orders);

  const applyDiscount = (code: string): { success: boolean; error?: string } => {
    if (appliedDiscounts.some(d => d.code === code.toUpperCase())) return { success: false, error: 'Kód již uplatněn.' };
    const result = validateDiscount(code, cartState.cart);
    if (result.success && result.discount && result.amount !== undefined) {
      if (appliedDiscounts.length > 0 && !result.discount.isStackable) return { success: false, error: 'Kód nelze kombinovat.' };
      setAppliedDiscounts([...appliedDiscounts, { code: result.discount.code, amount: result.amount }]);
      return { success: true };
    } else {
      return { success: false, error: result.error || 'Neplatný kód.' };
    }
  };

  const removeAppliedDiscount = (code: string) => setAppliedDiscounts(prev => prev.filter(d => d.code !== code));

  // Recalculate discounts when cart changes
  useEffect(() => {
    if (appliedDiscounts.length === 0) return;
    let updatedDiscounts: AppliedDiscount[] = [];
    let removedCodes: string[] = [];
    for (const applied of appliedDiscounts) {
      const calculation = validateDiscount(applied.code, cartState.cart);
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
  }, [cartState.cart]);

  const getDailyLoad = (date: string) => calculateDailyLoad(orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED), products, settings);

  const getAvailableEventDates = (product: Product): string[] => {
      return getAvailableEventDatesLogic(product, settings, orders, products);
  };

  const isEventCapacityAvailable = (product: Product): boolean => {
      if (!product.isEventProduct) return true;
      const dates = getAvailableEventDates(product);
      return dates.length > 0;
  };

  const checkAvailability = (date: string, items: CartItem[], excludeOrderId?: string): CheckResult => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date); targetDate.setHours(0, 0, 0, 0);
    
    if (targetDate < today) return { allowed: false, reason: t('error.past'), status: 'past' };
    
    // Lead time check
    const maxLeadTime = items.length > 0 ? Math.max(...items.map(i => i.leadTimeDays || 0)) : 0;
    const minPossibleDate = new Date(today); minPossibleDate.setDate(minPossibleDate.getDate() + maxLeadTime);
    
    if (targetDate < minPossibleDate) return { allowed: false, reason: t('error.too_soon'), status: 'too_soon' };
    
    // Config Check (DayConfig)
    const config = dayConfigs.find(d => d.date === date);
    if (config && !config.isOpen) return { allowed: false, reason: t('error.day_closed'), status: 'closed' };
    
    // Event Product Check
    const hasEventProduct = items.some(i => i.isEventProduct);
    const eventSlot = settings.eventSlots?.find(s => s.date === date);
    
    if (hasEventProduct && !eventSlot) {
        return { allowed: false, reason: t('cart.event_only'), status: 'closed' };
    }

    // Capacity Check using pure logic
    const relevantOrders = orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED && o.id !== excludeOrderId);
    const virtualOrders = [...relevantOrders, { items, deliveryDate: date } as Order]; 
    const { load, eventLoad } = calculateDailyLoad(virtualOrders, products, settings);
    
    let anyExceeds = false;
    
    // 1. Standard Categories
    if (!hasEventProduct || !eventSlot) {
        for (const cat of settings.categories) {
            let limit = config?.capacityOverrides?.[cat.id] ?? settings.defaultCapacities[cat.id] ?? 0;
            if (load[cat.id] > limit) anyExceeds = true;
        }
    }

    // 2. Event Categories
    if (eventSlot) {
        for (const cat of settings.categories) {
            const limit = eventSlot.capacityOverrides?.[cat.id] ?? 0;
            if (eventLoad[cat.id] > limit) anyExceeds = true;
        }
    }
    
    if (anyExceeds) return { allowed: false, reason: t('error.capacity_exceeded'), status: 'exceeds' };
    return { allowed: true, status: 'available' };
  };

  const getDateStatus = (date: string, items: CartItem[]): DayStatus => {
     const check = checkAvailability(date, items);
     return check.status;
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
              
              if (filters.ic) {
                  const hasIcInAddr = !!(o.billingIc) || (o.billingName && o.billingName.toLowerCase().includes('ič'));
                  if (filters.ic === 'yes' && !hasIcInAddr) return false;
                  if (filters.ic === 'no' && hasIcInAddr) return false;
              }

              if (filters.isEvent) {
                  const hasEventItem = o.items.some(i => i.isEventProduct);
                  if (filters.isEvent === 'yes' && !hasEventItem) return false;
                  if (filters.isEvent === 'no' && hasEventItem) return false;
              }
              
              return true;
          }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

  const searchUsers = async (filters: { search?: string }) => {
       if (dataSource === 'api') {
           const queryString = new URLSearchParams(filters as any).toString();
           const res = await apiCall(`/api/users?${queryString}`, 'GET');
           return res && res.success ? res.users : [];
       } else {
           if (!filters.search) return auth.allUsers;
           const term = filters.search.toLowerCase();
           return auth.allUsers.filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
       }
  };

  const addOrder = async (order: Order): Promise<boolean> => {
    const orderWithHistory: Order = {
      ...order,
      language: language,
      companyDetailsSnapshot: JSON.parse(JSON.stringify(settings.companyDetails)), // Snapshot creation (Proforma)
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

  const updateOrder = async (order: Order, sendNotify?: boolean, isUserEdit?: boolean): Promise<boolean> => {
    let updatedOrder = { ...order };
    if (updatedOrder.items.length === 0) {
      updatedOrder.status = OrderStatus.CANCELLED;
      if (!updatedOrder.statusHistory?.some(h => h.status === OrderStatus.CANCELLED)) {
         updatedOrder.statusHistory = [...(updatedOrder.statusHistory || []), { status: OrderStatus.CANCELLED, date: new Date().toISOString() }];
      }
    }
    if (dataSource === 'api') {
       const res = await apiCall('/api/orders', 'POST', { ...updatedOrder, sendNotify, isUserEdit });
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
    const snapshotForDelivery = status === OrderStatus.DELIVERED ? JSON.parse(JSON.stringify(settings.companyDetails)) : undefined;

    if (dataSource === 'api') {
       const res = await apiCall('/api/orders/status', 'PUT', { ids, status, notifyCustomer: notify, deliveryCompanyDetailsSnapshot: snapshotForDelivery });
       if (res && res.success) {
          setOrders(prev => prev.map(o => {
            if (ids.includes(o.id)) {
                const updated = { ...o, status, statusHistory: [...(o.statusHistory || []), { status, date: new Date().toISOString() }] };
                if (status === OrderStatus.DELIVERED && !updated.finalInvoiceDate) {
                    updated.finalInvoiceDate = new Date().toISOString();
                    updated.deliveryCompanyDetailsSnapshot = snapshotForDelivery;
                }
                return updated;
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
            const updated = { ...o, status, statusHistory: [...(o.statusHistory || []), { status, date: new Date().toISOString() }] };
            if (status === OrderStatus.DELIVERED && !updated.finalInvoiceDate) {
                updated.finalInvoiceDate = new Date().toISOString();
                updated.deliveryCompanyDetailsSnapshot = snapshotForDelivery;
            }
            return updated;
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

  const uploadImage = async (base64: string, name: string = 'image'): Promise<string> => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/admin/upload', 'POST', { image: base64, name });
          if (res && res.success) return res.url;
          throw new Error('Upload failed');
      } else {
          return base64; // Local storage keeps base64
      }
  };

  const getImageUrl = (path: string | undefined) => {
       if (!path) return '';
       if (path.startsWith('data:') || path.startsWith('http')) return path;
       return getFullApiUrl(path.startsWith('/') ? path : `/${path}`);
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

  const updateEventSlot = async (slot: EventSlot) => {
       const newSlots = [...(settings.eventSlots || [])];
       const idx = newSlots.findIndex(s => s.date === slot.date);
       if (idx > -1) newSlots[idx] = slot;
       else newSlots.push(slot);
       
       const newSettings = { ...settings, eventSlots: newSlots };
       await updateSettings(newSettings);
  };

  const removeEventSlot = async (date: string) => {
       const newSlots = (settings.eventSlots || []).filter(s => s.date !== date);
       const newSettings = { ...settings, eventSlots: newSlots };
       await updateSettings(newSettings);
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
            if (s.users && d.users) auth.setAllUsers(d.users);
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
      try {
          const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
          const fontUrlBold = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf';
          
          const [reg, bold] = await Promise.all([
              fetch(fontUrl).then(res => res.arrayBuffer()),
              fetch(fontUrlBold).then(res => res.arrayBuffer())
          ]);

          const regBase64 = arrayBufferToBase64(reg);
          const boldBase64 = arrayBufferToBase64(bold);

          const doc = new jsPDF();
          doc.addFileToVFS("Roboto-Regular.ttf", regBase64);
          doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
          doc.addFileToVFS("Roboto-Medium.ttf", boldBase64);
          doc.addFont("Roboto-Medium.ttf", "Roboto", "bold");
          doc.setFont("Roboto");

          // --- 2. SNAPSHOT SELECTION LOGIC ---
          // Use Final snapshot if printing final invoice, otherwise fallback to creation snapshot, then current global settings
          let comp = o.companyDetailsSnapshot || settings.companyDetails || {};
          
          if (type === 'final') {
              comp = o.deliveryCompanyDetailsSnapshot || o.companyDetailsSnapshot || settings.companyDetails || {};
          }

          const isVatPayer = !!comp.dic && comp.dic.trim().length > 0;
          const headerTitle = type === 'proforma' ? "ZÁLOHOVÝ DAŇOVÝ DOKLAD" : (isVatPayer ? "FAKTURA - DAŇOVÝ DOKLAD" : "FAKTURA");
          const dateToUse = type === 'final' ? (o.finalInvoiceDate || new Date().toISOString()) : o.createdAt;
          const brandColor = [147, 51, 234] as [number, number, number]; 

          // 3. Header
          doc.setTextColor(...brandColor);
          doc.setFont("Roboto", "bold");
          doc.setFontSize(20);
          doc.text(headerTitle, 105, 20, { align: "center" });
          
          doc.setTextColor(0, 0, 0);
          doc.setFont("Roboto", "normal");
          doc.setFontSize(10);
          doc.text(`Číslo obj: ${o.id}`, 105, 28, { align: "center" });
          doc.text(`Datum vystavení: ${formatDate(dateToUse)}`, 105, 34, { align: "center" });
          
          if (isVatPayer && type === 'final') {
              doc.text(`Datum zdan. plnění: ${formatDate(dateToUse)}`, 105, 40, { align: "center" });
          }

          // 4. Supplier / Customer
          doc.setFontSize(11);
          doc.setFont("Roboto", "bold");
          doc.text("DODAVATEL:", 14, 55);
          doc.text("ODBĚRATEL:", 110, 55);
          
          doc.setFont("Roboto", "normal");
          doc.setFontSize(10);
          
          let yPos = 61;
          doc.text(comp.name || '', 14, yPos); yPos += 5;
          doc.text(comp.street || '', 14, yPos); yPos += 5;
          doc.text(`${comp.zip || ''} ${comp.city || ''}`, 14, yPos); yPos += 5;
          doc.text(`IČ: ${comp.ic || ''}`, 14, yPos); yPos += 5;
          if(comp.dic) doc.text(`DIČ: ${comp.dic}`, 14, yPos);

          yPos = 61;
          doc.text(o.billingName || o.userName || 'Zákazník', 110, yPos); yPos += 5;
          doc.text(o.billingStreet || '', 110, yPos); yPos += 5;
          doc.text(`${o.billingZip || ''} ${o.billingCity || ''}`, 110, yPos); yPos += 5;
          if (o.billingIc) { doc.text(`IČ: ${o.billingIc}`, 110, yPos); yPos += 5; }
          if (o.billingDic) { doc.text(`DIČ: ${o.billingDic}`, 110, yPos); yPos += 5; }

          // 5. Calculations
          const getBase = (priceWithVat: number, rate: number) => priceWithVat / (1 + rate / 100);
          const getVat = (priceWithVat: number, rate: number) => priceWithVat - getBase(priceWithVat, rate);

          const grossTotalsByRate: Record<number, number> = {};
          o.items.forEach(item => {
              const rate = Number(item.vatRateTakeaway || 0);
              grossTotalsByRate[rate] = (grossTotalsByRate[rate] || 0) + (item.price * item.quantity);
          });

          let maxVatRate = 0;
          Object.keys(grossTotalsByRate).forEach(k => { if(Number(k) > maxVatRate) maxVatRate = Number(k); });
          const feeVatRate = maxVatRate > 0 ? maxVatRate : 21;

          if (o.packagingFee > 0) grossTotalsByRate[feeVatRate] = (grossTotalsByRate[feeVatRate] || 0) + o.packagingFee;
          if (o.deliveryFee > 0) grossTotalsByRate[feeVatRate] = (grossTotalsByRate[feeVatRate] || 0) + o.deliveryFee;

          const grandGrossTotal = Object.values(grossTotalsByRate).reduce((a, b) => a + b, 0);
          const totalDiscount = o.appliedDiscounts?.reduce((a, b) => a + b.amount, 0) || 0;
          const discountRatio = grandGrossTotal > 0 ? (totalDiscount / grandGrossTotal) : 0;

          const tableBody: any[] = [];
          const taxSummary: Record<number, any> = {};

          Object.keys(grossTotalsByRate).forEach(k => {
              const r = Number(k);
              const gross = grossTotalsByRate[r];
              const netAtRate = gross * (1 - discountRatio);
              taxSummary[r] = {
                  total: netAtRate,
                  base: getBase(netAtRate, r),
                  vat: netAtRate - getBase(netAtRate, r)
              };
          });

          o.items.forEach(item => {
              const lineTotal = item.price * item.quantity;
              const rate = Number(item.vatRateTakeaway || 0);
              const row = [
                  item.name,
                  item.quantity,
                  isVatPayer ? getBase(item.price, rate).toFixed(2) : item.price.toFixed(2)
              ];
              if (isVatPayer) { row.push(`${rate}%`); row.push(getVat(lineTotal, rate).toFixed(2)); }
              row.push(lineTotal.toFixed(2));
              tableBody.push(row);
          });

          if (o.packagingFee > 0) {
              const row = ['Balné', '1', isVatPayer ? getBase(o.packagingFee, feeVatRate).toFixed(2) : o.packagingFee.toFixed(2)];
              if (isVatPayer) { row.push(`${feeVatRate}%`); row.push(getVat(o.packagingFee, feeVatRate).toFixed(2)); }
              row.push(o.packagingFee.toFixed(2));
              tableBody.push(row);
          }

          if (o.deliveryFee > 0) {
              const row = ['Doprava', '1', isVatPayer ? getBase(o.deliveryFee, feeVatRate).toFixed(2) : o.deliveryFee.toFixed(2)];
              if (isVatPayer) { row.push(`${feeVatRate}%`); row.push(getVat(o.deliveryFee, feeVatRate).toFixed(2)); }
              row.push(o.deliveryFee.toFixed(2));
              tableBody.push(row);
          }

          o.appliedDiscounts?.forEach(d => {
              const row = [`Sleva ${d.code}`, '1', `-${d.amount.toFixed(2)}`];
              if (isVatPayer) { row.push(''); row.push(''); }
              row.push(`-${d.amount.toFixed(2)}`);
              tableBody.push(row);
          });

          // 6. Table Generation
          const head = isVatPayer 
              ? [['Položka', 'Ks', 'Základ/ks', 'DPH %', 'DPH Celkem', 'Celkem s DPH']]
              : [['Položka', 'Ks', 'Cena/ks', 'Celkem']];

          autoTable(doc, {
              startY: 100,
              head: head,
              body: tableBody,
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

          let finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 160;

          // 7. VAT Recap
          if (isVatPayer) {
              doc.setFontSize(10);
              doc.setFont("Roboto", "bold");
              doc.text("Rekapitulace DPH", 14, finalY);
              const summaryBody = Object.keys(taxSummary).map(rate => {
                  const r = Number(rate);
                  const s = taxSummary[r];
                  if (Math.abs(s.total) < 0.01) return null;
                  return [`${r} %`, s.base.toFixed(2), s.vat.toFixed(2), s.total.toFixed(2)];
              }).filter(Boolean);

              if (summaryBody.length > 0) {
                  autoTable(doc, {
                      startY: finalY + 2,
                      head: [['Sazba', 'Základ daně', 'Výše daně', 'Celkem s DPH']],
                      body: summaryBody,
                      theme: 'striped',
                      styles: { font: 'Roboto', fontSize: 8 },
                      headStyles: { fillColor: [100, 100, 100] },
                      columnStyles: { 0: { halign: 'center', fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
                      margin: { left: 14, right: 100 }
                  });
                  finalY = (doc as any).lastAutoTable.finalY + 10;
              } else { finalY += 5; }
          }

          // 8. Totals & QR
          const grandTotal = Math.max(0, grandGrossTotal - totalDiscount);
          doc.setFont("Roboto", "bold");
          doc.setFontSize(14);
          doc.setTextColor(...brandColor);
          doc.text(`CELKEM K ÚHRADĚ: ${grandTotal.toFixed(2)} Kč`, 196, finalY, { align: "right" });
          
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(10);
          
          if (type === 'final') {
              doc.text("NEPLATIT - Již uhrazeno zálohovou fakturou.", 196, finalY + 8, { align: "right" });
          } else {
              try {
                  if (comp.bankAccount) {
                    const vs = o.id.replace(/\D/g, '');
                    const iban = calculateCzIban(comp.bankAccount);
                    const bic = comp.bic ? `+${comp.bic}` : '';
                    const qrString = `SPD*1.0*ACC:${iban}${bic}*AM:${grandTotal.toFixed(2)}*CC:CZK*X-VS:${vs}*MSG:OBJ${o.id}`;
                    
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrString)}`;
                    const qrResp = await fetch(qrUrl);
                    const qrBuf = await qrResp.arrayBuffer();
                    const qrBase64 = arrayBufferToBase64(qrBuf);
                    doc.addImage(qrBase64, "PNG", 150, finalY + 10, 40, 40);
                    doc.setFontSize(8);
                    doc.text("QR Platba", 170, finalY + 53, { align: "center" });
                  }
              } catch (e) { console.error("QR Code generation failed:", e); }
          }

          doc.save(`faktura_${type}_${o.id}.pdf`);

      } catch (e) {
          console.error("PDF Generation failed:", e);
          showNotify("Chyba při generování PDF. Zkuste to prosím později.", "error");
      }
  };

  const generateCzIban = calculateCzIban;

  return (
    <StoreContext.Provider value={{
      dataSource, setDataSource,
      isLoading, isOperationPending, dbConnectionError, isPreviewEnvironment,
      language, setLanguage, 
      cart: cartState.cart, 
      cartBump: cartState.cartBump,
      addToCart: cartState.addToCart, 
      removeFromCart: cartState.removeFromCart, 
      updateCartItemQuantity: cartState.updateCartItemQuantity, 
      clearCart: cartState.clearCart, 
      
      user: auth.user, 
      allUsers: auth.allUsers, 
      login: auth.login, 
      logout: auth.logout, 
      register: auth.register, 
      updateUser: auth.updateUser, 
      updateUserAdmin: auth.updateUserAdmin, 
      toggleUserBlock: auth.toggleUserBlock, 
      sendPasswordReset: auth.sendPasswordReset, 
      resetPasswordByToken: auth.resetPasswordByToken, 
      changePassword: auth.changePassword, 
      addUser: auth.addUser,
      
      orders, searchOrders, searchUsers, addOrder, updateOrderStatus, updateOrder, checkOrderRestoration, 
      products, addProduct, updateProduct, deleteProduct, uploadImage, getImageUrl,
      discountCodes, appliedDiscounts, addDiscountCode, updateDiscountCode, deleteDiscountCode, applyDiscount, removeAppliedDiscount, validateDiscount,
      settings, updateSettings, dayConfigs, updateDayConfig, removeDayConfig, updateEventSlot, removeEventSlot,
      checkAvailability, getDateStatus, getDailyLoad, getDeliveryRegion, getRegionInfoForDate, getPickupPointInfo,
      calculatePackagingFee, getAvailableEventDates, isEventCapacityAvailable,
      t, tData, generateInvoice, printInvoice, generateCzIban, removeDiacritics, formatDate, getFullApiUrl,
      importDatabase, globalNotification, dismissNotification,
      isAuthModalOpen, openAuthModal, closeAuthModal,
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
