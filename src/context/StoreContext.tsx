
import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback, useRef } from 'react';
import { CartItem, Language, Product, User, Order, GlobalSettings, DayConfig, ProductCategory, OrderStatus, PaymentMethod, DiscountCode, DiscountType, AppliedDiscount, DeliveryRegion, PackagingType, CompanyDetails, BackupData, PickupLocation, DataSourceMode } from '../types';
import { MOCK_ORDERS, PRODUCTS as INITIAL_PRODUCTS, DEFAULT_SETTINGS, EMPTY_SETTINGS } from '../constants';
import { TRANSLATIONS } from '../translations';
import { removeDiacritics, formatDate, calculateCzIban } from '../utils/helpers';
import { calculateDailyLoad, calculatePackagingFeeLogic, calculateDiscountAmountLogic, getAvailableEventDatesLogic } from '../utils/orderLogic';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../hooks/useAuth';

// Font loading helper for PDF
const fetchFont = async (url: string): Promise<string> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load font: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    // Use a browser-compatible base64 conversion
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

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
  login: (email: string, password?: string) => Promise<{ success: boolean; message?: string; user?: User }>;
  register: (name: string, email: string, phone: string, password?: string) => void;
  logout: () => void;
  updateUser: (user: User) => Promise<boolean>; 
  updateUserAdmin: (user: User) => Promise<boolean>; 
  toggleUserBlock: (userId: string) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPasswordByToken: (token: string, newPass: string) => Promise<PasswordChangeResult>;
  changePassword: (oldPass: string, newPass: string) => PasswordChangeResult;
  addUser: (name: string, email: string, phone: string, role: 'customer' | 'admin' | 'driver') => Promise<boolean>;
  
  searchUsers: (filters: { search: string }) => Promise<User[]>; // Added
  
  orders: Order[];
  searchOrders: (filters: any) => Promise<{ orders: Order[], total: number }>; // Added
  addOrder: (order: Order) => Promise<boolean>;
  updateOrderStatus: (orderIds: string[], status: OrderStatus, sendNotify?: boolean) => Promise<boolean>;
  updateOrder: (order: Order, sendNotify?: boolean, isUserEdit?: boolean) => Promise<boolean>;
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
  validateDiscount: (code: string, items: CartItem[]) => ValidateDiscountResult;
  
  settings: GlobalSettings;
  updateSettings: (settings: GlobalSettings) => Promise<boolean>;
  dayConfigs: DayConfig[];
  updateDayConfig: (config: DayConfig) => Promise<boolean>;
  removeDayConfig: (date: string) => Promise<boolean>;
  updateEventSlot: (slot: any) => Promise<boolean>;
  removeEventSlot: (date: string) => Promise<boolean>;
  
  checkAvailability: (date: string, cartItems: CartItem[], excludeOrderId?: string) => CheckResult;
  getDateStatus: (date: string, cartItems: CartItem[]) => DayStatus;
  getDailyLoad: (date: string, excludeOrderId?: string) => { load: Record<string, number>, eventLoad: Record<string, number> };
  getAvailableEventDates: (product: Product) => string[];
  isEventCapacityAvailable: (product: Product) => boolean;
  
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
  
  importDatabase: (data: BackupData, selection: Record<string, boolean>) => Promise<ImportResult>;
  uploadImage: (base64: string, name: string) => Promise<string>;
  getImageUrl: (path: string) => string; // Added
  
  globalNotification: GlobalNotification | null;
  dismissNotification: () => void;

  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;

  cookieSettings: any;
  saveCookieSettings: (settings: any) => void;
  
  isPreviewEnvironment: boolean;
  getFullApiUrl: (endpoint: string) => string;
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
  const [cookieSettings, setCookieSettings] = useState<any>(() => loadFromStorage('cookie_settings', null));

  const t = (key: string, params?: Record<string, string>) => {
    let text = TRANSLATIONS[language]?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  const tData = (obj: any, key: string): string => {
      if (!obj) return '';
      const val = obj.translations?.[language]?.[key];
      return val || obj[key] || '';
  };

  const [cart, setCart] = useState<CartItem[]>(() => loadFromStorage('cart', []));
  const [cartBump, setCartBump] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>([]);
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);

  // Environment Check - Safe Access
  // @ts-ignore
  const env = (import.meta as any).env || {};
  const isPreviewEnvironment = env.MODE !== 'production' || window.location.hostname.includes('localhost') || window.location.hostname.includes('webcontainer');

  const setDataSource = (mode: DataSourceMode) => {
    localStorage.setItem('app_data_source', mode);
    setDataSourceState(mode);
  };

  const showNotify = (message: string, type: 'success' | 'error' = 'success', autoClose: boolean = true) => {
    setGlobalNotification({ message, type, autoClose });
  };

  const getFullApiUrl = (endpoint: string) => {
    // @ts-ignore
    const env = (import.meta as any).env || {};
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

  const getImageUrl = (path: string) => {
      if (!path) return '';
      if (path.startsWith('data:')) return path;
      if (path.startsWith('http')) return path;
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
         setDbConnectionError(true);
      } else {
         console.warn(`[API] Call to ${endpoint} failed:`, e);
         showNotify(`Chyba: ${e.message || 'Neznámá chyba'}`, 'error');
      }
      return null;
    } finally {
        setIsOperationPending(false); 
    }
  };

  const fetchDataRef = useRef<() => Promise<void>>(async () => {});
  
  const {
      user,
      allUsers,
      setAllUsers,
      login,
      register,
      logout,
      addUser,
      updateUser,
      updateUserAdmin,
      toggleUserBlock,
      sendPasswordReset,
      resetPasswordByToken,
      changePassword,
      INITIAL_USERS // useAuth provides this
  } = useAuth(dataSource, apiCall, showNotify, async () => { await fetchDataRef.current(); });

  const fetchData = useCallback(async () => {
      setIsLoading(true);
      try {
        if (dataSource === 'api') {
          setDbConnectionError(false);
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
              // showNotify("Připojeno k databázi.", 'success');
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
      } finally {
        setIsLoading(false);
      }
  }, [dataSource, setAllUsers, INITIAL_USERS]); // Added deps

  useEffect(() => {
      fetchDataRef.current = fetchData;
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [dataSource, fetchData]); // Added fetchData to deps

  useEffect(() => localStorage.setItem('cart', JSON.stringify(cart)), [cart]);
  // User session is handled by useAuth via local storage sync
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

  const saveCookieSettings = (s: any) => setCookieSettings(s);
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
      if (removedCodes.length > 0) showNotify(`Slevový kupon ${removedCodes.join(', ')} byl odebrán.`, 'error');
    }
  }, [cart, discountCodes]);

  const searchOrders = async (filters: any) => {
      if (dataSource === 'api') {
          const queryString = new URLSearchParams(filters).toString();
          const res = await apiCall(`/api/orders?${queryString}`, 'GET');
          return res || { orders: [], total: 0 };
      } else {
          // Client side filtering for local mode
          let filtered = orders.filter(o => {
              if (filters.id && !o.id.includes(filters.id)) return false;
              if (filters.userId && o.userId !== filters.userId) return false;
              if (filters.status && o.status !== filters.status) return false;
              if (filters.dateFrom && o.deliveryDate < filters.dateFrom) return false;
              if (filters.dateTo && o.deliveryDate > filters.dateTo) return false;
              if (filters.customer && !o.userName?.toLowerCase().includes(filters.customer.toLowerCase())) return false;
              return true;
          });
          const page = Number(filters.page) || 1;
          const limit = Number(filters.limit) || 50;
          const start = (page - 1) * limit;
          return { orders: filtered.slice(start, start + limit), total: filtered.length };
      }
  };

  const searchUsers = async (filters: { search: string }): Promise<User[]> => {
      if (dataSource === 'api') {
          const queryString = new URLSearchParams(filters).toString();
          const res = await apiCall(`/api/users?${queryString}`, 'GET');
          return res?.users || [];
      } else {
          const term = filters.search.toLowerCase();
          return allUsers.filter(u => 
              u.name.toLowerCase().includes(term) || 
              u.email.toLowerCase().includes(term)
          );
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
        // Refresh orders if needed or just add locally
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
    
    if (dataSource === 'api') {
       const res = await apiCall('/api/orders', 'POST', { ...updatedOrder, sendNotify });
       if (res && res.success) {
          setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
          if (isUserEdit) showNotify('Objednávka byla upravena.');
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
       // We should pass deliveryCompanyDetailsSnapshot if delivered to freeze snapshot
       const deliverySnapshot = status === OrderStatus.DELIVERED ? settings.companyDetails : undefined;
       
       const res = await apiCall('/api/orders/status', 'PUT', { ids, status, notifyCustomer: notify, deliveryCompanyDetailsSnapshot: deliverySnapshot });
       if (res && res.success) {
          setOrders(prev => prev.map(o => {
            if (ids.includes(o.id)) {
                const updated = { ...o, status, statusHistory: [...(o.statusHistory || []), { status, date: new Date().toISOString() }] };
                if (status === OrderStatus.DELIVERED) {
                    updated.finalInvoiceDate = new Date().toISOString();
                    if (!updated.deliveryCompanyDetailsSnapshot) updated.deliveryCompanyDetailsSnapshot = JSON.parse(JSON.stringify(settings.companyDetails));
                }
                return updated;
            }
            return o;
          }));
          showNotify(`Stav změněn.`, 'success', !notify);
          return true;
       }
       return false;
    } else {
       setOrders(prev => prev.map(o => {
          if (ids.includes(o.id)) {
            const updated = { ...o, status, statusHistory: [...(o.statusHistory || []), { status, date: new Date().toISOString() }] };
            if (status === OrderStatus.DELIVERED) {
                updated.finalInvoiceDate = new Date().toISOString();
                if (!updated.deliveryCompanyDetailsSnapshot) updated.deliveryCompanyDetailsSnapshot = JSON.parse(JSON.stringify(settings.companyDetails));
            }
            return updated;
          }
          return o;
        }));
        showNotify(`Stav změněn.`);
        return true;
    }
  };

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
        if (res && res.success) { setProducts(prev => prev.filter(x => x.id !== id)); showNotify('Smazáno.'); return true; }
        return false;
    } else {
        setProducts(prev => prev.filter(x => x.id !== id)); showNotify('Smazáno.'); return true;
    }
  };

  const updateSettings = async (s: GlobalSettings): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/settings', 'POST', s);
        if (res && res.success) { setSettings(s); showNotify(t('notification.db_saved')); return true; }
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
            showNotify(t('notification.db_saved')); return true;
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
        if (res && res.success) { setDayConfigs(prev => prev.filter(d => d.date !== date)); showNotify('Smazáno.'); return true; }
        return false;
    } else {
        setDayConfigs(prev => prev.filter(d => d.date !== date)); return true;
    }
  };

  const updateEventSlot = async (slot: any): Promise<boolean> => {
      // In the current DB schema, event slots are part of global settings JSON
      // So we update settings
      let newSlots = [...(settings.eventSlots || [])];
      const index = newSlots.findIndex(s => s.date === slot.date);
      if (index >= 0) newSlots[index] = slot;
      else newSlots.push(slot);
      
      const newSettings = { ...settings, eventSlots: newSlots };
      return await updateSettings(newSettings);
  };

  const removeEventSlot = async (date: string): Promise<boolean> => {
      const newSlots = (settings.eventSlots || []).filter(s => s.date !== date);
      const newSettings = { ...settings, eventSlots: newSlots };
      return await updateSettings(newSettings);
  };

  const addDiscountCode = async (c: DiscountCode): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/discounts', 'POST', c);
        if (res && res.success) { setDiscountCodes(prev => [...prev, c]); showNotify(t('notification.db_saved')); return true; }
        return false;
    } else {
        setDiscountCodes(prev => [...prev, c]); return true;
    }
  };

  const updateDiscountCode = async (code: DiscountCode): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/discounts', 'POST', code);
        if (res && res.success) { setDiscountCodes(prev => prev.map(x => x.id === code.id ? code : x)); showNotify(t('notification.db_saved')); return true; }
        return false;
    } else {
        setDiscountCodes(prev => prev.map(x => x.id === code.id ? code : x)); return true;
    }
  };

  const deleteDiscountCode = async (id: string): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall(`/api/discounts/${id}`, 'DELETE');
        if (res && res.success) { setDiscountCodes(prev => prev.filter(x => x.id !== id)); showNotify('Smazáno.'); return true; }
        return false;
    } else {
        setDiscountCodes(prev => prev.filter(x => x.id !== id)); return true;
    }
  };

  const uploadImage = async (base64: string, name: string): Promise<string> => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/admin/upload', 'POST', { image: base64, name });
          if (res && res.success) return res.url;
          throw new Error('Upload failed');
      } else {
          return base64; // Local mode just stores base64 string
      }
  };

  const calculatePackagingFee = (items: CartItem[]) => calculatePackagingFeeLogic(items, settings.packaging.types, settings.packaging.freeFrom);
  
  const validateDiscount = (code: string, items: CartItem[]) => calculateDiscountAmountLogic(code, items, discountCodes, orders);
  
  const applyDiscount = (code: string): { success: boolean; error?: string } => {
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

  const getDailyLoad = (date: string, excludeOrderId?: string) => {
      const relevantOrders = orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED && o.id !== excludeOrderId);
      return calculateDailyLoad(relevantOrders, products, settings);
  };

  const checkAvailability = (date: string, items: CartItem[], excludeOrderId?: string): CheckResult => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date); targetDate.setHours(0, 0, 0, 0);
    if (targetDate < today) return { allowed: false, reason: t('error.past'), status: 'past' };
    
    // Lead time check
    const maxLeadTime = items.length > 0 ? Math.max(...items.map(i => i.leadTimeDays || 0)) : 0;
    const minPossibleDate = new Date(today); minPossibleDate.setDate(minPossibleDate.getDate() + maxLeadTime);
    if (targetDate < minPossibleDate) return { allowed: false, reason: t('error.too_soon'), status: 'too_soon' };
    
    // Day open check
    const config = dayConfigs.find(d => d.date === date);
    if (config && !config.isOpen) return { allowed: false, reason: t('error.day_closed'), status: 'closed' };
    
    // Event Product Check
    // If cart contains event product, date MUST be an event date
    const hasEventProduct = items.some(i => i.isEventProduct);
    const eventSlot = settings.eventSlots?.find(s => s.date === date);
    
    if (hasEventProduct && !eventSlot) {
        return { allowed: false, reason: t('cart.event_only'), status: 'closed' };
    }

    // Capacity Check
    const { load, eventLoad } = getDailyLoad(date, excludeOrderId);
    
    // Simulate adding current cart
    const simulatedLoad = { ...load };
    const simulatedEventLoad = { ...eventLoad };
    
    items.forEach(item => {
        const productDef = products.find(p => String(p.id) === String(item.id));
        const workload = (Number(productDef?.workload) || Number(item.workload) || 0) * item.quantity;
        const overhead = (Number(productDef?.workloadOverhead) || Number(item.workloadOverhead) || 0);
        const cat = item.category;
        const isEvent = !!productDef?.isEventProduct;
        
        if (isEvent) {
            simulatedEventLoad[cat] = (simulatedEventLoad[cat] || 0) + workload + overhead; // Simplified overhead for check
        } else {
            simulatedLoad[cat] = (simulatedLoad[cat] || 0) + workload + overhead;
        }
    });

    // Check Limits
    const catsToCheck = new Set([...items.map(i => i.category), ...settings.categories.map(c => c.id)]);
    let anyExceeds = false;

    for (const cat of catsToCheck) {
        // Standard Check
        const stdLimit = config?.capacityOverrides?.[cat] ?? settings.defaultCapacities[cat] ?? 0;
        if (simulatedLoad[cat] > stdLimit) anyExceeds = true;

        // Event Check
        if (eventSlot) {
            const evtLimit = eventSlot.capacityOverrides?.[cat] ?? 0;
            // Only check event load if limit is defined (0 means no limit? No, 0 means closed usually)
            // But if capacityOverrides is missing key, it might mean "closed" for that category in event?
            // Assuming 0 means closed for events.
            if (simulatedEventLoad[cat] > evtLimit) anyExceeds = true;
        } else if (simulatedEventLoad[cat] > 0) {
            // Should not happen if filtered above, but safety
            anyExceeds = true; 
        }
    }

    if (anyExceeds) return { allowed: false, reason: t('error.capacity_exceeded'), status: 'exceeds' };
    return { allowed: true, status: 'available' };
  };

  const getDateStatus = (date: string, items: CartItem[]): DayStatus => {
     const check = checkAvailability(date, items);
     return check.status;
  };

  const getAvailableEventDates = (product: Product) => getAvailableEventDatesLogic(product, settings, orders, products);
  const isEventCapacityAvailable = (product: Product) => {
      // Check if there is ANY future date available for this event product
      const dates = getAvailableEventDates(product);
      return dates.length > 0;
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
  
  // PDF Generation Logic - Now Client Side using fetched fonts for robust utf-8 support
  const printInvoice = async (order: Order, type: 'proforma' | 'final' = 'proforma') => {
      // Fetch Fonts from CDN or public dir
      // We use Roboto because it supports Czech chars well
      let regBase64 = '', boldBase64 = '';
      try {
          // Using CDN for demo, in prod better to serve from /fonts/
          regBase64 = await fetchFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf');
          boldBase64 = await fetchFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf');
      } catch (e) {
          console.warn("Could not load fonts, falling back to default (diacritics may break).");
      }

      const doc = new jsPDF();
      if (regBase64) {
          doc.addFileToVFS("Roboto-Regular.ttf", regBase64);
          doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
      }
      if (boldBase64) {
          doc.addFileToVFS("Roboto-Medium.ttf", boldBase64);
          doc.addFont("Roboto-Medium.ttf", "Roboto", "bold");
      }
      if (regBase64) doc.setFont("Roboto");

      // Snapshot Logic
      let comp: Partial<CompanyDetails> = {};
      if (type === 'final') {
          comp = order.deliveryCompanyDetailsSnapshot || order.companyDetailsSnapshot || settings.companyDetails || {};
      } else {
          comp = order.companyDetailsSnapshot || settings.companyDetails || {};
      }

      const isVatPayer = !!comp.dic && comp.dic.trim().length > 0;
      const headerTitle = type === 'proforma' ? "ZÁLOHOVÝ DAŇOVÝ DOKLAD" : (isVatPayer ? "FAKTURA - DAŇOVÝ DOKLAD" : "FAKTURA");
      const dateToUse = type === 'final' ? (order.finalInvoiceDate || new Date().toISOString()) : order.createdAt;
      const brandColor = [147, 51, 234] as [number, number, number];

      // Header
      doc.setTextColor(...brandColor);
      doc.setFontSize(20);
      if (regBase64) doc.setFont("Roboto", "bold");
      doc.text(headerTitle, 105, 20, { align: "center" });
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      if (regBase64) doc.setFont("Roboto", "normal");
      doc.text(`Číslo obj: ${order.id}`, 105, 28, { align: "center" });
      doc.text(`Datum vystavení: ${formatDate(dateToUse)}`, 105, 34, { align: "center" });
      if (isVatPayer && type === 'final') {
          doc.text(`Datum zdan. plnění: ${formatDate(dateToUse)}`, 105, 40, { align: "center" });
      }

      // Supplier/Customer
      doc.setFontSize(11);
      if (regBase64) doc.setFont("Roboto", "bold");
      doc.text("DODAVATEL:", 14, 55);
      doc.text("ODBĚRATEL:", 110, 55);
      
      if (regBase64) doc.setFont("Roboto", "normal");
      doc.setFontSize(10);
      
      let yPos = 61;
      doc.text(comp.name || '', 14, yPos); yPos += 5;
      doc.text(comp.street || '', 14, yPos); yPos += 5;
      doc.text(`${comp.zip || ''} ${comp.city || ''}`, 14, yPos); yPos += 5;
      doc.text(`IČ: ${comp.ic || ''}`, 14, yPos); yPos += 5;
      if(comp.dic) doc.text(`DIČ: ${comp.dic}`, 14, yPos);

      yPos = 61;
      doc.text(order.billingName || order.userName || 'Zákazník', 110, yPos); yPos += 5;
      doc.text(order.billingStreet || '', 110, yPos); yPos += 5;
      doc.text(`${order.billingZip || ''} ${order.billingCity || ''}`, 110, yPos); yPos += 5;
      if (order.billingIc) { doc.text(`IČ: ${order.billingIc}`, 110, yPos); yPos += 5; }
      if (order.billingDic) { doc.text(`DIČ: ${order.billingDic}`, 110, yPos); yPos += 5; }

      // Items Table
      const getBase = (priceWithVat: number, rate: number) => priceWithVat / (1 + rate / 100);
      const getVat = (priceWithVat: number, rate: number) => priceWithVat - getBase(priceWithVat, rate);

      const tableBody: any[] = [];
      const grossTotalsByRate: Record<number, number> = {};
      
      order.items.forEach(item => {
          const rate = Number(item.vatRateTakeaway || 0);
          grossTotalsByRate[rate] = (grossTotalsByRate[rate] || 0) + (item.price * item.quantity);
          const lineTotal = item.price * item.quantity;
          
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
          tableBody.push(row);
      });

      // Fees
      let maxVatRate = 0;
      Object.keys(grossTotalsByRate).forEach(k => { if(Number(k) > maxVatRate) maxVatRate = Number(k); });
      const feeVatRate = maxVatRate > 0 ? maxVatRate : 21;

      if (order.packagingFee > 0) {
          grossTotalsByRate[feeVatRate] = (grossTotalsByRate[feeVatRate] || 0) + order.packagingFee;
          const row = ['Balné', '1', isVatPayer ? getBase(order.packagingFee, feeVatRate).toFixed(2) : order.packagingFee.toFixed(2)];
          if (isVatPayer) { row.push(`${feeVatRate}%`); row.push(getVat(order.packagingFee, feeVatRate).toFixed(2)); }
          row.push(order.packagingFee.toFixed(2));
          tableBody.push(row);
      }
      if (order.deliveryFee > 0) {
          grossTotalsByRate[feeVatRate] = (grossTotalsByRate[feeVatRate] || 0) + order.deliveryFee;
          const row = ['Doprava', '1', isVatPayer ? getBase(order.deliveryFee, feeVatRate).toFixed(2) : order.deliveryFee.toFixed(2)];
          if (isVatPayer) { row.push(`${feeVatRate}%`); row.push(getVat(order.deliveryFee, feeVatRate).toFixed(2)); }
          row.push(order.deliveryFee.toFixed(2));
          tableBody.push(row);
      }

      order.appliedDiscounts?.forEach(d => {
          const row = [`Sleva ${d.code}`, '1', `-${d.amount.toFixed(2)}`];
          if (isVatPayer) { row.push(''); row.push(''); }
          row.push(`-${d.amount.toFixed(2)}`);
          tableBody.push(row);
      });

      const head = isVatPayer 
          ? [['Položka', 'Ks', 'Základ/ks', 'DPH %', 'DPH Celkem', 'Celkem s DPH']]
          : [['Položka', 'Ks', 'Cena/ks', 'Celkem']];

      autoTable(doc, {
          startY: 100,
          head: head,
          body: tableBody,
          theme: 'grid',
          styles: { font: regBase64 ? 'Roboto' : 'helvetica', fontSize: 9, lineColor: [200, 200, 200] },
          headStyles: { fillColor: brandColor, textColor: [255, 255, 255], fontStyle: 'bold' },
          columnStyles: isVatPayer ? {
              0: { cellWidth: 'auto' }, 1: { halign: 'center' }, 2: { halign: 'right' },
              3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' }
          } : {
              0: { cellWidth: 'auto' }, 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' }
          }
      });

      let finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 150;

      // Totals & QR
      const grandGrossTotal = Object.values(grossTotalsByRate).reduce((a, b) => a + b, 0);
      const totalDiscount = order.appliedDiscounts?.reduce((a, b) => a + b.amount, 0) || 0;
      const grandTotal = Math.max(0, grandGrossTotal - totalDiscount);

      // VAT Recap
      if (isVatPayer) {
          doc.setFontSize(10);
          if (regBase64) doc.setFont("Roboto", "bold");
          doc.text("Rekapitulace DPH", 14, finalY);
          
          const discountRatio = grandGrossTotal > 0 ? (totalDiscount / grandGrossTotal) : 0;
          const summaryBody = Object.keys(grossTotalsByRate).map(rate => {
              const r = Number(rate);
              const gross = grossTotalsByRate[r];
              const netAtRate = gross * (1 - discountRatio);
              const base = getBase(netAtRate, r);
              const vat = netAtRate - base;
              if (Math.abs(netAtRate) < 0.01) return null;
              return [`${r} %`, base.toFixed(2), vat.toFixed(2), netAtRate.toFixed(2)];
          }).filter(Boolean);

          if (summaryBody.length > 0) {
              autoTable(doc, {
                  startY: finalY + 2,
                  head: [['Sazba', 'Základ daně', 'Výše daně', 'Celkem s DPH']],
                  body: summaryBody as any[][],
                  theme: 'striped',
                  styles: { font: regBase64 ? 'Roboto' : 'helvetica', fontSize: 8 },
                  headStyles: { fillColor: [100, 100, 100] },
                  columnStyles: { 0: { halign: 'center', fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
                  margin: { left: 14, right: 100 }
              });
              finalY = (doc as any).lastAutoTable.finalY + 10;
          } else { finalY += 5; }
      }

      if (regBase64) doc.setFont("Roboto", "bold");
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
                const vs = order.id.replace(/\D/g, '');
                const iban = calculateCzIban(comp.bankAccount);
                const bic = comp.bic ? `+${comp.bic}` : '';
                const qrString = `SPD*1.0*ACC:${iban}${bic}*AM:${grandTotal.toFixed(2)}*CC:CZK*X-VS:${vs}*MSG:OBJ${order.id}`;
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

      doc.save(`faktura_${type}_${order.id}.pdf`);
  };

  if (isLoading) return <div className="min-h-screen flex flex-col items-center justify-center font-bold text-gray-400 gap-4">
      <div className="w-12 h-12 border-4 border-gray-200 border-t-accent rounded-full animate-spin"></div>
      <p>Načítám aplikaci...</p>
  </div>;

  return (
    <StoreContext.Provider value={{
      dataSource, setDataSource,
      isLoading, isOperationPending, dbConnectionError,
      language, setLanguage, cart, cartBump, addToCart, removeFromCart, updateCartItemQuantity, clearCart, 
      user, allUsers, login, logout, register, updateUser, updateUserAdmin, toggleUserBlock, sendPasswordReset, resetPasswordByToken, changePassword, addUser,
      searchUsers, 
      orders, searchOrders, addOrder, updateOrderStatus, updateOrder, checkOrderRestoration, products, addProduct, updateProduct, deleteProduct,
      discountCodes, appliedDiscounts, addDiscountCode, updateDiscountCode, deleteDiscountCode, applyDiscount, removeAppliedDiscount, validateDiscount,
      settings, updateSettings, dayConfigs, updateDayConfig, removeDayConfig, updateEventSlot, removeEventSlot,
      checkAvailability, getDateStatus, getDailyLoad, getAvailableEventDates, isEventCapacityAvailable,
      getDeliveryRegion, getRegionInfoForDate, getPickupPointInfo,
      calculatePackagingFee,
      t, tData, generateInvoice, printInvoice, generateCzIban: calculateCzIban, importDatabase, globalNotification, dismissNotification,
      isAuthModalOpen, openAuthModal, closeAuthModal, removeDiacritics, formatDate,
      cookieSettings, saveCookieSettings, uploadImage, getImageUrl, isPreviewEnvironment, getFullApiUrl
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
