import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import { CartItem, Language, Product, User, Order, GlobalSettings, DayConfig, ProductCategory, OrderStatus, PaymentMethod, DiscountCode, DiscountType, AppliedDiscount, DeliveryRegion, PackagingType, CompanyDetails, BackupData, PickupLocation, EventSlot, OrdersSearchResult, CookieSettings, DataSourceMode } from '../types';
import { MOCK_ORDERS, PRODUCTS as INITIAL_PRODUCTS, DEFAULT_SETTINGS, EMPTY_SETTINGS } from '../constants';
import { TRANSLATIONS } from '../translations';
import { jsPDF } from 'jspdf';
import { calculatePackagingFeeLogic, calculateDiscountAmountLogic, calculateDailyLoad, getAvailableEventDatesLogic } from '../utils/orderLogic';
import { removeDiacritics, formatDate, calculateCzIban } from '../utils/helpers';
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
  isPreviewEnvironment: boolean;
  getFullApiUrl: (endpoint: string) => string;
  
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
  tData: (data: any, key: string) => string;
  
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartItemQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartBump: boolean;
  
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
  searchUsers: (filters: any) => Promise<User[]>;
  
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
  notifyEventSubscribers: (date: string) => Promise<boolean>;
  
  checkAvailability: (date: string, cartItems: CartItem[], excludeOrderId?: string) => CheckResult;
  getDateStatus: (date: string, cartItems: CartItem[]) => DayStatus;
  getDailyLoad: (date: string, excludeOrderId?: string) => { load: Record<string, number>; eventLoad: Record<string, number> };
  getDeliveryRegion: (zip: string) => DeliveryRegion | undefined;
  getRegionInfoForDate: (region: DeliveryRegion, date: string) => RegionDateInfo;
  getPickupPointInfo: (location: PickupLocation, date: string) => RegionDateInfo;
  calculatePackagingFee: (items: CartItem[]) => number;
  getAvailableEventDates: (product: Product) => string[];
  isEventCapacityAvailable: (product: Product) => boolean;
  
  generateInvoice: (order: Order) => string;
  printInvoice: (order: Order, type?: 'proforma' | 'final') => Promise<void>;
  generateCzIban: (accountStr: string) => string;
  removeDiacritics: (str: string) => string;
  formatDate: (dateStr: string) => string;
  
  importDatabase: (data: BackupData, selection: Record<string, boolean>) => Promise<ImportResult>;
  uploadImage: (base64Data: string, fileName: string) => Promise<string>;
  getImageUrl: (path?: string) => string;
  
  globalNotification: GlobalNotification | null;
  dismissNotification: () => void;

  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;

  cookieSettings: CookieSettings | null;
  saveCookieSettings: (settings: CookieSettings) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
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
  const [cookieSettings, setCookieSettings] = useState<CookieSettings | null>(() => loadFromStorage('app_cookies', null));

  // Data States
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>([]);
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);

  const isPreviewEnvironment = useMemo(() => {
      try {
          // @ts-ignore
          return (import.meta && import.meta.env && import.meta.env.DEV) || false;
      } catch {
          return false;
      }
  }, []);

  const t = (key: string, params?: Record<string, string>) => {
    let text = TRANSLATIONS[language]?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  const tData = (data: any, key: string) => {
      if (!data) return '';
      if (data.translations && data.translations[language]) {
          return data.translations[language][key] || data[key] || '';
      }
      return data[key] || '';
  };

  const showNotify = (message: string, type: 'success' | 'error' = 'success', autoClose: boolean = true) => {
    setGlobalNotification({ message, type, autoClose });
  };

  const getFullApiUrl = (endpoint: string) => {
    // @ts-ignore
    const env = (import.meta && import.meta.env) ? import.meta.env : {};
    
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
      const json = await res.json();
      setDbConnectionError(false);
      return json;
    } catch (e: any) {
      if (e.message === 'TIMEOUT_LIMIT_REACHED' || e.name === 'AbortError') {
         showNotify('Server neodpovídá.', 'error');
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

  const fetchData = useCallback(async () => {
      setIsLoading(true);
      try {
        if (dataSource === 'api') {
          // Clear local states before fetch to avoid stale data mix
          setProducts([]);
          setOrders([]);
          setDiscountCodes([]);
          setDayConfigs([]);
          setSettings(EMPTY_SETTINGS);
          
          const data = await apiCall('/api/bootstrap', 'GET');
          if (data) {
              setProducts(data.products || []);
              setOrders(data.orders || []);
              if (data.settings) {
                 const mergedSettings = { ...DEFAULT_SETTINGS, ...data.settings };
                 // Ensure array properties are initialized
                 if (!mergedSettings.categories) mergedSettings.categories = DEFAULT_SETTINGS.categories;
                 if (!mergedSettings.pickupLocations) mergedSettings.pickupLocations = DEFAULT_SETTINGS.pickupLocations;
                 if (!mergedSettings.eventSlots) mergedSettings.eventSlots = [];
                 if (!mergedSettings.capacityCategories) mergedSettings.capacityCategories = [];
                 setSettings(mergedSettings); 
              }
              setDiscountCodes(data.discountCodes || []);
              setDayConfigs(data.dayConfigs || []);
              
              // Auth hook handles users separately via its own logic or we pass initial users here?
              // The useAuth hook manages users state, but we need to populate it from bootstrap if possible.
              // We'll expose a setter in useAuth or let useAuth fetch its own data.
              // For now, let's assume useAuth will fetch or we pass data to it.
              // Actually, useAuth fetches on its own or we can pass initial data. 
              // To avoid refactoring useAuth too much, we will trigger its internal fetch or set state.
              // But useAuth internal state is not exposed to set directly easily unless we change it.
              // Let's rely on useAuth fetching or passed via props.
              // The provided useAuth doesn't accept initial data in props, so we might need to manually set it via setAllUsers if exposed.
          }
        } else {
          // Local Mode
          setProducts(loadFromStorage('db_products', INITIAL_PRODUCTS));
          setOrders(loadFromStorage('db_orders', MOCK_ORDERS));
          
          const loadedSettings = loadFromStorage('db_settings', DEFAULT_SETTINGS);
          if (!loadedSettings.categories) loadedSettings.categories = DEFAULT_SETTINGS.categories;
          if (!loadedSettings.pickupLocations) loadedSettings.pickupLocations = DEFAULT_SETTINGS.pickupLocations;
          if (!loadedSettings.eventSlots) loadedSettings.eventSlots = [];
          
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
  }, [dataSource, apiCall]);

  const setDataSource = (mode: DataSourceMode) => {
    localStorage.setItem('app_data_source', mode);
    setDataSourceState(mode);
  };

  // --- HOOKS INTEGRATION ---
  const auth = useAuth(dataSource, apiCall, showNotify, fetchData);
  const { cart, cartBump, addToCart, removeFromCart, updateCartItemQuantity, clearCart } = useCart((msg) => showNotify(msg));

  // Sync users from bootstrap to auth hook if needed
  useEffect(() => {
      fetchData();
  }, [fetchData]);

  // Sync Auth Users with Bootstrap Data (Only for API mode if not handled by useAuth)
  // useAuth calls /api/users/login and /api/users, but doesn't have a bulk set from bootstrap. 
  // We can add a specialized fetch in useAuth or just let useAuth load independently.
  // Ideally useAuth should export a way to set users from bootstrap. 
  // For now, we assume useAuth fetches its own data or we accept slight inefficiency.
  // Actually, useAuth calls `setAllUsers` internally. We can't access it unless exposed. 
  // `useAuth` returns `allUsers` and `setAllUsers`. So we can set it!
  
  useEffect(() => {
      if (dataSource === 'api') {
          // Fetch users explicitly to ensure they are loaded
          apiCall('/api/users', 'GET').then(res => {
              if (res && res.users) auth.setAllUsers(res.users);
          });
      } else {
          auth.setAllUsers(loadFromStorage('db_users', auth.INITIAL_USERS));
      }
  }, [dataSource, apiCall]);

  // Local Storage Sync for DB Data (Local Mode Only)
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

  // --- LOGIC IMPLEMENTATIONS ---

  const calculatePackagingFee = (items: CartItem[]) => calculatePackagingFeeLogic(items, settings.packaging.types, settings.packaging.freeFrom);
  const validateDiscount = (code: string, currentCart: CartItem[]) => calculateDiscountAmountLogic(code, currentCart, discountCodes, orders);
  
  const applyDiscount = (code: string) => {
    if (appliedDiscounts.some(d => d.code === code.toUpperCase())) return { success: false, error: t('discount.applied') };
    const result = validateDiscount(code, cart);
    if (result.success && result.discount && result.amount !== undefined) {
      if (appliedDiscounts.length > 0 && !result.discount.isStackable) return { success: false, error: t('discount.not_stackable') };
      setAppliedDiscounts([...appliedDiscounts, { code: result.discount.code, amount: result.amount }]);
      return { success: true };
    } else {
      return { success: false, error: result.error || t('discount.invalid') };
    }
  };

  const removeAppliedDiscount = (code: string) => setAppliedDiscounts(prev => prev.filter(d => d.code !== code));

  // Discount re-validation on cart change
  useEffect(() => {
    if (appliedDiscounts.length === 0) return;
    let updatedDiscounts: AppliedDiscount[] = [];
    let removedCodes: string[] = [];
    for (const applied of appliedDiscounts) {
      const calculation = validateDiscount(applied.code, cart);
      if (calculation.success && calculation.amount !== undefined) {
        updatedDiscounts.push({ code: applied.code, amount: calculation.amount });
      } else {
        removedCodes.push(applied.code);
      }
    }
    const isDifferent = JSON.stringify(updatedDiscounts) !== JSON.stringify(appliedDiscounts);
    if (isDifferent) {
      setAppliedDiscounts(updatedDiscounts);
      if (removedCodes.length > 0) showNotify(`${t('discount.code')} ${removedCodes.join(', ')} ${t('discount.invalid')}`, 'error');
    }
  }, [cart]);

  const getDailyLoad = (date: string, excludeOrderId?: string) => {
      const relevantOrders = orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED && o.id !== excludeOrderId);
      return calculateDailyLoad(relevantOrders, products, settings);
  };

  const checkAvailability = (date: string, items: CartItem[], excludeOrderId?: string): CheckResult => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date); targetDate.setHours(0, 0, 0, 0);
    if (targetDate < today) return { allowed: false, reason: t('error.past'), status: 'past' };
    
    // Lead Time Check
    const maxLeadTime = items.length > 0 ? Math.max(...items.map(i => i.leadTimeDays || 0)) : 0;
    const minPossibleDate = new Date(today); minPossibleDate.setDate(minPossibleDate.getDate() + maxLeadTime);
    if (targetDate < minPossibleDate) return { allowed: false, reason: t('error.too_soon'), status: 'too_soon' };
    
    const config = dayConfigs.find(d => d.date === date);
    if (config && !config.isOpen) return { allowed: false, reason: t('error.day_closed'), status: 'closed' };
    
    // Event Product Check
    const hasEventProducts = items.some(i => i.isEventProduct);
    const eventSlot = settings.eventSlots?.find(s => s.date === date);
    
    if (hasEventProducts && !eventSlot) {
        return { allowed: false, reason: t('cart.event_only'), status: 'closed' };
    }

    const { load, eventLoad } = getDailyLoad(date, excludeOrderId);
    
    // Simulate current cart load
    // Note: We need to properly account for overhead sharing if possible, but simplest is to just add it raw
    const simulatedLoad = { ...load };
    const simulatedEventLoad = { ...eventLoad };
    
    items.forEach(item => {
       const productDef = products.find(p => String(p.id) === String(item.id));
       const workload = (Number(productDef?.workload) || Number(item.workload) || 0) * item.quantity;
       // Overhead is tricky to simulate without full recalc, assume worst case (add it)
       const overhead = Number(productDef?.workloadOverhead) || Number(item.workloadOverhead) || 0;
       
       const cat = item.category;
       const isEvent = item.isEventProduct;
       
       if (isEvent) {
           simulatedEventLoad[cat] = (simulatedEventLoad[cat] || 0) + workload + overhead;
       } else {
           simulatedLoad[cat] = (simulatedLoad[cat] || 0) + workload + overhead;
       }
    });

    // Check Limits
    let anyExceeds = false;
    const catsToCheck = new Set(items.map(i => i.category));
    
    for (const cat of catsToCheck) {
        // 1. Standard Limit
        const stdLimit = config?.capacityOverrides?.[cat] ?? settings.defaultCapacities[cat] ?? 0;
        if (simulatedLoad[cat] > stdLimit) anyExceeds = true;

        // 2. Event Limit (if event slot exists)
        if (eventSlot) {
            const evtLimit = eventSlot.capacityOverrides?.[cat] ?? 0;
            if (simulatedEventLoad[cat] > evtLimit) anyExceeds = true;
        }
    }
    
    if (anyExceeds) return { allowed: false, reason: t('error.capacity_exceeded'), status: 'exceeds' };
    return { allowed: true, status: 'available' };
  };

  const getDateStatus = (date: string, items: CartItem[]): DayStatus => checkAvailability(date, items).status;

  const getAvailableEventDates = (product: Product) => getAvailableEventDatesLogic(product, settings, orders, products);
  
  const isEventCapacityAvailable = (product: Product) => {
      const dates = getAvailableEventDates(product);
      return dates.length > 0;
  };

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
        setOrders(prev => [orderWithHistory, ...prev]);
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
    
    // Status history check
    const lastStatus = updatedOrder.statusHistory?.[updatedOrder.statusHistory.length - 1]?.status;
    if (lastStatus !== updatedOrder.status) {
        updatedOrder.statusHistory = [...(updatedOrder.statusHistory || []), { status: updatedOrder.status, date: new Date().toISOString() }];
    }

    if (dataSource === 'api') {
       const payload = { ...updatedOrder, sendNotify };
       const res = await apiCall('/api/orders', 'POST', payload);
       if (res && res.success) {
          setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
          if (sendNotify) showNotify(t('notification.email_sent'));
          else showNotify(t('notification.db_saved'));
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
       const res = await apiCall('/api/orders/status', 'PUT', { ids, status, notifyCustomer: notify, deliveryCompanyDetailsSnapshot: settings.companyDetails });
       if (res && res.success) {
          setOrders(prev => prev.map(o => {
            if (ids.includes(o.id)) {
              return { ...o, status, statusHistory: [...(o.statusHistory || []), { status, date: new Date().toISOString() }] };
            }
            return o;
          }));
          const msg = notify ? t('notification.email_sent') : t('notification.db_saved');
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
        showNotify(`Status changed to: ${t(`status.${status}`)}`);
        return true;
    }
  };

  const searchOrders = useCallback(async (filters: any) => {
      if (dataSource === 'api') {
          const queryString = new URLSearchParams(filters).toString();
          const res = await apiCall(`/api/orders?${queryString}`, 'GET');
          return res || { orders: [], total: 0, page: 1, pages: 1 };
      } else {
          // Client side filtering for local mode
          let filtered = orders.filter(o => {
              if (filters.id && !o.id.includes(filters.id)) return false;
              if (filters.userId && o.userId !== filters.userId) return false;
              
              if (filters.status) {
                  const statuses = filters.status.split(',').filter((s: string) => s.trim() !== '');
                  if (statuses.length > 0 && !statuses.includes(o.status)) {
                      return false;
                  }
              }

              if (filters.dateFrom && o.deliveryDate < filters.dateFrom) return false;
              if (filters.dateTo && o.deliveryDate > filters.dateTo) return false;
              if (filters.customer && !o.userName?.toLowerCase().includes(filters.customer.toLowerCase())) return false;
              
              if (filters.isEvent === 'yes') {
                  const hasEventItem = o.items.some(i => {
                      const p = products.find(prod => prod.id === i.id);
                      return p?.isEventProduct || i.isEventProduct;
                  });
                  if (!hasEventItem) return false;
              } else if (filters.isEvent === 'no') {
                   const hasEventItem = o.items.some(i => {
                      const p = products.find(prod => prod.id === i.id);
                      return p?.isEventProduct || i.isEventProduct;
                  });
                  if (hasEventItem) return false;
              }

              return true;
          });
          
          filtered.sort((a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime() || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          const page = Number(filters.page) || 1;
          const limit = Number(filters.limit) || 50;
          const start = (page - 1) * limit;
          const total = filtered.length;
          
          return { 
              orders: filtered.slice(start, start + limit), 
              total, 
              page, 
              pages: Math.ceil(total / limit) 
          };
      }
  }, [dataSource, apiCall, orders, products]);

  // --- ENTITY UPDATES ---

  const addProduct = async (p: Product) => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/products', 'POST', p);
        if (res && res.success) { setProducts(prev => [...prev, p]); showNotify(t('notification.db_saved')); return true; }
        return false;
    } else {
        setProducts(prev => [...prev, p]); 
        showNotify(t('notification.saved'));
        return true;
    }
  };

  const updateProduct = async (p: Product) => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/products', 'POST', p);
        if (res && res.success) { setProducts(prev => prev.map(x => x.id === p.id ? p : x)); showNotify(t('notification.db_saved')); return true; }
        return false;
    } else {
        setProducts(prev => prev.map(x => x.id === p.id ? p : x)); 
        showNotify(t('notification.saved'));
        return true;
    }
  };

  const deleteProduct = async (id: string) => {
    if (dataSource === 'api') {
        const res = await apiCall(`/api/products/${id}`, 'DELETE');
        if (res && res.success) { setProducts(prev => prev.filter(x => x.id !== id)); showNotify(t('notification.db_saved')); return true; }
        return false;
    } else {
        setProducts(prev => prev.filter(x => x.id !== id)); 
        return true;
    }
  };

  const updateSettings = async (s: GlobalSettings) => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/settings', 'POST', s);
        if (res && res.success) { setSettings(s); showNotify(t('notification.db_saved')); return true; }
        return false;
    } else {
        setSettings(s); 
        showNotify(t('notification.saved'));
        return true;
    }
  };

  const updateDayConfig = async (c: DayConfig) => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/calendar', 'POST', c);
        if (res && res.success) {
            setDayConfigs(prev => { const exists = prev.find(d => d.date === c.date); return exists ? prev.map(d => d.date === c.date ? c : d) : [...prev, c]; });
            showNotify(t('notification.db_saved')); return true;
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
        if (res && res.success) { setDayConfigs(prev => prev.filter(d => d.date !== date)); showNotify(t('notification.db_saved')); return true; }
        return false;
    } else {
        setDayConfigs(prev => prev.filter(d => d.date !== date)); return true;
    }
  };

  const addDiscountCode = async (c: DiscountCode) => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/discounts', 'POST', c);
        if (res && res.success) { setDiscountCodes(prev => [...prev, c]); showNotify(t('notification.db_saved')); return true; }
        return false;
    } else {
        setDiscountCodes(prev => [...prev, c]); return true;
    }
  };

  const updateDiscountCode = async (code: DiscountCode) => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/discounts', 'POST', code);
        if (res && res.success) { setDiscountCodes(prev => prev.map(x => x.id === code.id ? code : x)); showNotify(t('notification.db_saved')); return true; }
        return false;
    } else {
        setDiscountCodes(prev => prev.map(x => x.id === code.id ? code : x)); return true;
    }
  };

  const deleteDiscountCode = async (id: string) => {
    if (dataSource === 'api') {
        const res = await apiCall(`/api/discounts/${id}`, 'DELETE');
        if (res && res.success) { setDiscountCodes(prev => prev.filter(x => x.id !== id)); showNotify(t('notification.db_saved')); return true; }
        return false;
    } else {
        setDiscountCodes(prev => prev.filter(x => x.id !== id)); return true;
    }
  };

  // --- EVENTS ---
  const updateEventSlot = async (slot: EventSlot) => {
      const newSlots = [...(settings.eventSlots || [])];
      const index = newSlots.findIndex(s => s.date === slot.date);
      if (index > -1) newSlots[index] = slot;
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
          if (res && res.success) {
              showNotify(`${t('notification.email_sent')} (${res.count})`);
              return true;
          }
      } else {
          showNotify('Notifikace simulována (Lokální režim)');
      }
      return true;
  };

  // --- HELPERS ---
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

  const saveCookieSettings = (s: CookieSettings) => {
      setCookieSettings(s);
      localStorage.setItem('app_cookies', JSON.stringify(s));
  };

  const searchUsers = useCallback(async (filters: any) => {
      if (dataSource === 'api') {
          const queryString = new URLSearchParams(filters).toString();
          const res = await apiCall(`/api/users?${queryString}`, 'GET');
          return res?.users || [];
      } else {
          let filtered = auth.allUsers;
          if (filters.search) {
              const term = filters.search.toLowerCase();
              filtered = filtered.filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
          }
          return filtered;
      }
  }, [dataSource, apiCall, auth.allUsers]);

  const uploadImage = async (base64Data: string, fileName: string) => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/admin/upload', 'POST', { image: base64Data, name: fileName });
          if (res && res.success) return res.url;
          throw new Error('Upload failed');
      }
      return base64Data; // Local mode: keep base64
  };

  const getImageUrl = (path?: string) => {
      if (!path) return '';
      if (path.startsWith('http') || path.startsWith('data:')) return path;
      if (dataSource === 'api') {
          // Construct full URL to API
          const baseUrl = getFullApiUrl('');
          // Clean double slash
          const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
          const cleanPath = path.startsWith('/') ? path : `/${path}`;
          return `${cleanBase}${cleanPath}`;
      }
      return path;
  };

  const generateInvoice = (o: Order) => `API_INVOICE_${o.id}`;
  const printInvoice = async (o: Order, type: 'proforma' | 'final' = 'proforma') => { 
      const doc = new jsPDF(); 
      doc.text(`Faktura ${o.id} (${type})`, 10, 10); 
      doc.save(`faktura_${o.id}.pdf`); 
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
            // Very simplified local restore
            if (s.products && d.products) setProducts(d.products);
            // ... others
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }
  };

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);
  const dismissNotification = () => setGlobalNotification(null);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-400">Načítám data...</div>;

  return (
    <StoreContext.Provider value={{
      dataSource, setDataSource,
      isLoading, isOperationPending, dbConnectionError, isPreviewEnvironment, getFullApiUrl,
      language, setLanguage, t, tData,
      cart, addToCart, removeFromCart, updateCartItemQuantity, clearCart, cartBump,
      user: auth.user, allUsers: auth.allUsers, login: auth.login, logout: auth.logout, register: auth.register, 
      updateUser: auth.updateUser, updateUserAdmin: auth.updateUserAdmin, toggleUserBlock: auth.toggleUserBlock, 
      sendPasswordReset: auth.sendPasswordReset, resetPasswordByToken: auth.resetPasswordByToken, changePassword: auth.changePassword, addUser: auth.addUser,
      searchUsers,
      orders, addOrder, updateOrderStatus, updateOrder, checkOrderRestoration, searchOrders,
      products, addProduct, updateProduct, deleteProduct,
      discountCodes, appliedDiscounts, addDiscountCode, updateDiscountCode, deleteDiscountCode, applyDiscount, removeAppliedDiscount, validateDiscount,
      settings, updateSettings, dayConfigs, updateDayConfig, removeDayConfig, 
      updateEventSlot, removeEventSlot, notifyEventSubscribers, getAvailableEventDates, isEventCapacityAvailable,
      checkAvailability, getDateStatus, getDailyLoad, getDeliveryRegion, getRegionInfoForDate, getPickupPointInfo, calculatePackagingFee,
      generateInvoice, printInvoice, generateCzIban: calculateCzIban, removeDiacritics, formatDate,
      importDatabase, uploadImage, getImageUrl,
      globalNotification, dismissNotification,
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
