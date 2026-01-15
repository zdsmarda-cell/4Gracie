
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { CartItem, Language, Product, User, Order, GlobalSettings, DayConfig, OrderStatus, DiscountCode, AppliedDiscount, DeliveryRegion, PackagingType, CompanyDetails, BackupData, PickupLocation, CookieSettings, OrdersSearchResult, EventSlot } from '../types';
import { MOCK_ORDERS, PRODUCTS as INITIAL_PRODUCTS, DEFAULT_SETTINGS, EMPTY_SETTINGS } from '../constants';
import { TRANSLATIONS } from '../translations';

// Logic imports
import { calculateDiscountAmountLogic, calculatePackagingFeeLogic, calculateDailyLoad, getAvailableEventDatesLogic } from '../utils/orderLogic';
import { generateInvoicePdf } from '../utils/pdfGenerator';
import { formatDate, removeDiacritics, calculateCzIban } from '../utils/helpers';

// Hooks imports
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';

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

interface ImportResult {
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

  // PWA Support
  isPwaUpdateAvailable: boolean;
  updatePwa: () => void;
  pushSubscription: PushSubscription | null;
  subscribeToPush: () => Promise<boolean>;
  unsubscribeFromPush: () => Promise<boolean>; 
  isPwa: boolean;
  isPushSupported: boolean;
  vapidKey: string | null;
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

// Variable to track if a refresh is in progress
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.map(cb => cb(token));
  refreshSubscribers = [];
};

// URL Base64 to Uint8Array converter for VAPID key
const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- CORE STATE ---
  const [dataSource, setDataSourceState] = useState<DataSourceMode>(() => {
    // @ts-ignore
    const env = (import.meta as any).env;
    if (env && env.PROD) {
      return 'api';
    }
    return (localStorage.getItem('app_data_source') as DataSourceMode) || 'local';
  });
  
  // @ts-ignore
  const isPreviewEnvironment = (import.meta as any).env ? (import.meta as any).env.DEV : false;

  const [isLoading, setIsLoading] = useState(true);
  const [isOperationPending, setIsOperationPending] = useState(false);
  const [dbConnectionError, setDbConnectionError] = useState(false);
  const [language, setLanguage] = useState<Language>(Language.CS);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [globalNotification, setGlobalNotification] = useState<GlobalNotification | null>(null);
  const [cookieSettings, setCookieSettings] = useState<CookieSettings | null>(() => loadFromStorage('cookie_settings', null));

  // PWA State
  const [isPwaUpdateAvailable, setIsPwaUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  
  // Simple detection of standalone mode
  const isPwa = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  // Capability detection (More robust for enabling notifications in browser)
  const isPushSupported = 'serviceWorker' in navigator && 'PushManager' in window;

  // --- ENTITY STATES ---
  const [orders, setOrders] = useState<Order[]>(() => loadFromStorage('db_orders', MOCK_ORDERS));
  const [products, setProducts] = useState<Product[]>(() => loadFromStorage('db_products', INITIAL_PRODUCTS));
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>(() => loadFromStorage('db_discounts', []));
  const [settings, setSettings] = useState<GlobalSettings>(() => {
      const s = loadFromStorage('db_settings', DEFAULT_SETTINGS);
      if (!s.categories) s.categories = DEFAULT_SETTINGS.categories;
      return s;
  });
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>(() => loadFromStorage('db_dayconfigs', []));
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);

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

  const showNotify = useCallback((message: string, type: 'success' | 'error' = 'success', autoClose: boolean = true) => {
    setGlobalNotification({ message, type, autoClose });
  }, []);

  // --- API / FETCH LOGIC WITH REFRESH TOKEN ---
  const apiCall = useCallback(async (endpoint: string, method: string, body?: any): Promise<any> => {
    const controller = new AbortController();
    setIsOperationPending(true);
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            controller.abort();
            reject(new Error('TIMEOUT_LIMIT_REACHED'));
        }, 8000); 
    });

    const url = getFullApiUrl(endpoint);
    let token = localStorage.getItem('auth_token');

    const makeRequest = async (tokenToUse: string | null) => {
        const headers: any = { 'Content-Type': 'application/json' };
        if (tokenToUse) headers['Authorization'] = `Bearer ${tokenToUse}`;
        
        return await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
        });
    };

    try {
      let res: any = await Promise.race([makeRequest(token), timeoutPromise]);

      if (res.status === 401 || res.status === 403) {
          if (!isRefreshing) {
              isRefreshing = true;
              const refreshToken = localStorage.getItem('refresh_token');
              
              if (refreshToken) {
                  try {
                      const refreshRes = await fetch(getFullApiUrl('/api/users/refresh-token'), {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ refreshToken })
                      });
                      
                      const refreshData = await refreshRes.json();
                      
                      if (refreshData.success && refreshData.token) {
                          localStorage.setItem('auth_token', refreshData.token);
                          onTokenRefreshed(refreshData.token);
                          isRefreshing = false;
                          res = await makeRequest(refreshData.token);
                      } else {
                          isRefreshing = false;
                          localStorage.removeItem('session_user');
                          localStorage.removeItem('auth_token');
                          localStorage.removeItem('refresh_token');
                          window.location.reload(); 
                          throw new Error("Session expired. Please login again.");
                      }
                  } catch (e) {
                      isRefreshing = false;
                      localStorage.removeItem('session_user');
                      localStorage.removeItem('auth_token');
                      localStorage.removeItem('refresh_token');
                      window.location.reload(); 
                      throw e;
                  }
              } else {
                  localStorage.removeItem('session_user');
                  localStorage.removeItem('auth_token');
                  window.location.reload(); 
                  throw new Error("Unauthorized");
              }
          } else {
              const newToken = await new Promise<string>((resolve) => {
                  subscribeTokenRefresh((token) => resolve(token));
              });
              res = await makeRequest(newToken);
          }
      }
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Server vrátil neplatná data.");
      }
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `API Chyba: ${res.status}`);
      return json;
    } catch (e: any) {
      if (e.message === 'TIMEOUT_LIMIT_REACHED' || e.name === 'AbortError') {
         showNotify('Nepodařilo se operaci dokončit z důvodu nedostupnosti DB.', 'error');
         setDbConnectionError(true);
      } else if (e.message.includes('Session expired') || e.message.includes('Unauthorized')) {
         showNotify('Vaše přihlášení vypršelo. Přihlaste se prosím znovu.', 'error');
      } else {
         console.warn(`[API] Call to ${endpoint} failed:`, e);
         showNotify(`Chyba: ${e.message || 'Neznámá chyba'}`, 'error');
      }
      return null;
    } finally {
        setIsOperationPending(false); 
    }
  }, [showNotify]);

  // --- PWA LOGIC ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
        // Handle updates
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) {
                // If waiting worker exists, update is available
                if (reg.waiting) {
                    setWaitingWorker(reg.waiting);
                    setIsPwaUpdateAvailable(true);
                }
                
                // Monitor for future updates
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                setWaitingWorker(newWorker);
                                setIsPwaUpdateAvailable(true);
                            }
                        });
                    }
                });

                // Check existing push subscription
                reg.pushManager.getSubscription().then(sub => {
                    setPushSubscription(sub);
                });
            }
        });

        // Handle controller change (reload after update)
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    }
  }, []);

  const updatePwa = () => {
      if (waitingWorker) {
          waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      }
  };

  const subscribeToPush = async (): Promise<boolean> => {
      if (!isPushSupported) {
          showNotify('Push notifikace nejsou podporovány tímto prohlížečem.', 'error');
          return false;
      }

      // Check Notification Permission
      if (Notification.permission === 'denied') {
          showNotify('Notifikace jsou zakázány. Povolte je prosím v nastavení prohlížeče.', 'error');
          return false;
      }

      try {
          // Explicitly request permission if not granted
          if (Notification.permission !== 'granted') {
              const permission = await Notification.requestPermission();
              if (permission !== 'granted') {
                  showNotify('Notifikace nebyly povoleny.', 'error');
                  return false;
              }
          }

          const reg = await navigator.serviceWorker.ready;
          
          if (!vapidKey) {
              console.warn("VAPID Key missing.");
              showNotify('Chyba: Server neposkytl VAPID klíč.', 'error');
              return false;
          }

          const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey)
          });

          setPushSubscription(sub);

          // Send to backend if connected
          if (dataSource === 'api') {
              await apiCall('/api/notifications/subscribe', 'POST', { subscription: sub });
          }
          
          showNotify('Notifikace zapnuty.', 'success');
          return true;
      } catch (e: any) {
          console.error("Push Subscribe Error:", e);
          showNotify('Nepodařilo se zapnout notifikace.', 'error');
          return false;
      }
  };

  const unsubscribeFromPush = async (): Promise<boolean> => {
      if (!pushSubscription) return true;

      try {
          // 1. Notify Backend
          if (dataSource === 'api') {
              await apiCall('/api/notifications/unsubscribe', 'POST', { endpoint: pushSubscription.endpoint });
          }

          // 2. Unsubscribe locally
          await pushSubscription.unsubscribe();
          setPushSubscription(null);
          showNotify('Notifikace vypnuty.', 'success');
          return true;
      } catch (e) {
          console.error("Push Unsubscribe Error:", e);
          showNotify('Nepodařilo se zrušit notifikace.', 'error');
          return false;
      }
  };

  const fetchData = useCallback(async () => {
      setIsLoading(true);
      setDbConnectionError(false);
      try {
        if (dataSource === 'api') {
          // Clear current
          setProducts([]); setOrders([]); setDiscountCodes([]); setDayConfigs([]);
          
          const data = await apiCall('/api/bootstrap', 'GET');
          if (data && data.success) {
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
              
              // Set dynamic VAPID from server
              if (data.vapidPublicKey) {
                  setVapidKey(data.vapidPublicKey);
              }
          } else {
              if(!data) setDbConnectionError(true);
          }
        } else {
          // Local Storage Load
          setProducts(loadFromStorage('db_products', INITIAL_PRODUCTS));
          setOrders(loadFromStorage('db_orders', MOCK_ORDERS));
          
          const loadedSettings = loadFromStorage('db_settings', DEFAULT_SETTINGS);
          if (!loadedSettings.categories) loadedSettings.categories = DEFAULT_SETTINGS.categories;
          if (!loadedSettings.pickupLocations) loadedSettings.pickupLocations = DEFAULT_SETTINGS.pickupLocations;
          
          setSettings(loadedSettings);
          setDiscountCodes(loadFromStorage('db_discounts', []));
          setDayConfigs(loadFromStorage('db_dayconfigs', []));
          
          // Try loading VAPID from build env if strictly local
          // @ts-ignore
          const localVapid = import.meta.env?.VITE_VAPID_PUBLIC_KEY;
          if (localVapid) setVapidKey(localVapid);
        }
      } catch (err: any) {
        showNotify('Kritická chyba při načítání aplikace: ' + err.message, 'error');
        setDbConnectionError(true);
      } finally {
        setIsLoading(false);
      }
  }, [dataSource, apiCall, showNotify]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- PERSISTENCE FOR LOCAL MODE ---
  useEffect(() => {
    if (dataSource === 'local') {
      localStorage.setItem('db_orders', JSON.stringify(orders));
      localStorage.setItem('db_products', JSON.stringify(products));
      localStorage.setItem('db_discounts', JSON.stringify(discountCodes));
      localStorage.setItem('db_settings', JSON.stringify(settings));
      localStorage.setItem('db_dayconfigs', JSON.stringify(dayConfigs));
    }
  }, [orders, products, discountCodes, settings, dayConfigs, dataSource]);

  // --- SUB-HOOKS ---
  const { cart, cartBump, addToCart, removeFromCart, updateCartItemQuantity, clearCart } = useCart(showNotify);
  
  // Pass isPwa flag to Auth hook for login adjustments
  const { 
      user, allUsers, setAllUsers, login, register, logout, addUser, updateUser, updateUserAdmin, 
      toggleUserBlock, sendPasswordReset, resetPasswordByToken, changePassword, INITIAL_USERS 
  } = useAuth(dataSource, apiCall, showNotify, fetchData, isPwa);

  // Sync Push Subscription if user logs in
  useEffect(() => {
      if (user && pushSubscription && dataSource === 'api') {
          apiCall('/api/notifications/subscribe', 'POST', { subscription: pushSubscription });
      }
  }, [user, pushSubscription, dataSource, apiCall]);

  // Auto-prompt for Push on Login (Uses Capability check now, not strict PWA check)
  useEffect(() => {
      // Check if user is logged in, push is supported, and permission is default (not asked yet)
      if (user && isPushSupported && Notification.permission === 'default' && vapidKey) {
          // Wrap in a small timeout to avoid immediate rejection in some scenarios,
          // though modern browsers might still block this without a gesture.
          // The key fix is allowing the manual button in Profile to work.
          setTimeout(() => {
              subscribeToPush().catch(() => {
                  // Silent catch, let them enable in profile
                  console.log("Auto-subscribe prevented by browser policy.");
              });
          }, 1000);
      }
  }, [user, isPushSupported, vapidKey]);

  // --- SYNC AUTH DATA WITH MAIN FETCH ---
  useEffect(() => {
      if (dataSource === 'local' && allUsers.length === 0) {
          setAllUsers(loadFromStorage('db_users', INITIAL_USERS));
      }
  }, [dataSource]);

  useEffect(() => {
      if (dataSource === 'local') {
          localStorage.setItem('db_users', JSON.stringify(allUsers));
      }
  }, [allUsers, dataSource]);

  // --- ACTIONS & LOGIC ---

  const setDataSource = (mode: DataSourceMode) => {
    localStorage.setItem('app_data_source', mode);
    setDataSourceState(mode);
  };

  const saveCookieSettings = (s: CookieSettings) => {
      setCookieSettings(s);
      localStorage.setItem('cookie_settings', JSON.stringify(s));
  };

  // Translations
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
      if (obj.translations?.[language]?.[key]) return obj.translations[language][key];
      return obj[key] || '';
  };

  // Logic Functions (Delegated to utils)
  
  const validateDiscount = (code: string, currentCart: CartItem[]) => {
      return calculateDiscountAmountLogic(code, currentCart, discountCodes, orders);
  };

  const calculatePackagingFee = (items: CartItem[]) => {
      return calculatePackagingFeeLogic(items, settings.packaging.types, settings.packaging.freeFrom);
  };

  const getDailyLoad = (date: string, excludeOrderId?: string) => {
      return calculateDailyLoad(
          orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED && o.id !== excludeOrderId), 
          products, 
          settings
      );
  };

  // This one specifically re-implements checkAvailabilityLogic but needs access to context state
  const checkAvailability = (date: string, items: CartItem[], excludeOrderId?: string): CheckResult => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const targetDate = new Date(date); targetDate.setHours(0, 0, 0, 0);
      
      if (targetDate < today) return { allowed: false, reason: t('error.past'), status: 'past' };
      
      const maxLeadTime = items.length > 0 ? Math.max(...items.map(i => i.leadTimeDays || 0)) : 0;
      const minPossibleDate = new Date(today); minPossibleDate.setDate(minPossibleDate.getDate() + maxLeadTime);
      if (targetDate < minPossibleDate) return { allowed: false, reason: t('error.too_soon'), status: 'too_soon' };
      
      const hasEventItems = items.some(i => i.isEventProduct);
      if (hasEventItems) {
          const eventSlot = settings.eventSlots?.find(s => s.date === date);
          if (!eventSlot) return { allowed: false, reason: t('cart.event_only'), status: 'closed' };
          
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

      const config = dayConfigs.find(d => d.date === date);
      if (config && !config.isOpen) return { allowed: false, reason: t('error.day_closed'), status: 'closed' };
      
      const standardItems = items.filter(i => !i.isEventProduct);
      if (standardItems.length > 0) {
          const { load } = getDailyLoad(date, excludeOrderId);
          let anyExceeds = false;
          const categoriesInCart = new Set(standardItems.map(i => i.category));
          
          for (const cat of categoriesInCart) {
              const limit = config?.capacityOverrides?.[cat] ?? settings.defaultCapacities[cat] ?? 0;
              const currentLoad = load[cat] || 0;
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

  const getAvailableEventDates = (product: Product) => {
      return getAvailableEventDatesLogic(product, settings, orders, products);
  };

  const isEventCapacityAvailable = (product: Product) => getAvailableEventDates(product).length > 0;

  // Discounts Logic Wrapper
  const applyDiscount = (code: string): { success: boolean; error?: string } => {
    if (appliedDiscounts.some(d => d.code.toUpperCase() === code.toUpperCase())) return { success: false, error: t('discount.applied') };
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

  // Recalculate discounts on cart change
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
      if (removedCodes.length > 0) showNotify(`Slevový kupon ${removedCodes.join(', ')} byl odebrán.`, 'error');
    }
  }, [cart]);

  // Order Management
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

  const updateOrder = async (order: Order, sendNotify?: boolean, isUserEdit?: boolean): Promise<boolean> => {
    let updatedOrder = { ...order };
    if (updatedOrder.items.length === 0 && updatedOrder.status !== OrderStatus.CANCELLED) {
      updatedOrder.status = OrderStatus.CANCELLED;
    }
    
    if (dataSource === 'local') {
       setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
       return true;
    }

    const payload = { ...updatedOrder, sendNotify };
    const res = await apiCall('/api/orders', 'POST', payload);
    if (res && res.success) {
        setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
        return true;
    }
    return false;
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
        return true;
    }
  };

  // Searching (Mostly for Admin)
  const searchOrders = useCallback(async (params: any): Promise<OrdersSearchResult> => {
      if (dataSource === 'api') {
          const query = new URLSearchParams(params).toString();
          const res = await apiCall(`/api/orders?${query}`, 'GET');
          if (res && res.success) return res;
          return { orders: [], total: 0, page: 1, pages: 1 };
      } else {
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

  // Product CRUD
  const addProduct = async (p: Product): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/products', 'POST', p);
        if (res && res.success) { setProducts(prev => [...prev, p]); return true; }
        return false;
    } else {
        setProducts(prev => [...prev, p]); return true;
    }
  };

  const updateProduct = async (p: Product): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/products', 'POST', p);
        if (res && res.success) { setProducts(prev => prev.map(x => x.id === p.id ? p : x)); return true; }
        return false;
    } else {
        setProducts(prev => prev.map(x => x.id === p.id ? p : x)); return true;
    }
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall(`/api/products/${id}`, 'DELETE');
        if (res && res.success) { setProducts(prev => prev.filter(x => x.id !== id)); return true; }
        return false;
    } else {
        setProducts(prev => prev.filter(x => x.id !== id)); return true;
    }
  };

  // Settings & Configs
  const updateSettings = async (s: GlobalSettings): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/settings', 'POST', s);
        if (res && res.success) { setSettings(s); return true; }
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
            return true;
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
        if (res && res.success) { setDayConfigs(prev => prev.filter(d => d.date !== date)); return true; }
        return false;
    } else {
        setDayConfigs(prev => prev.filter(d => d.date !== date)); return true;
    }
  };

  const addDiscountCode = async (c: DiscountCode): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/discounts', 'POST', c);
        if (res && res.success) { setDiscountCodes(prev => [...prev, c]); return true; }
        return false;
    } else {
        setDiscountCodes(prev => [...prev, c]); return true;
    }
  };

  const updateDiscountCode = async (code: DiscountCode): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall('/api/discounts', 'POST', code);
        if (res && res.success) { setDiscountCodes(prev => prev.map(x => x.id === code.id ? code : x)); return true; }
        return false;
    } else {
        setDiscountCodes(prev => prev.map(x => x.id === code.id ? code : x)); return true;
    }
  };

  const deleteDiscountCode = async (id: string): Promise<boolean> => {
    if (dataSource === 'api') {
        const res = await apiCall(`/api/discounts/${id}`, 'DELETE');
        if (res && res.success) { setDiscountCodes(prev => prev.filter(x => x.id !== id)); return true; }
        return false;
    } else {
        setDiscountCodes(prev => prev.filter(x => x.id !== id)); return true;
    }
  };

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

  // Helper getters
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
      await generateInvoicePdf(o, type, settings);
  };
  
  const generateCzIban = calculateCzIban;

  const uploadImage = async (base64: string, name: string) => {
      if (dataSource === 'api') {
          const res = await apiCall('/api/admin/upload', 'POST', { image: base64, name });
          if (res && res.success) return res.url;
          throw new Error('Upload failed');
      } else {
          return base64; 
      }
  };

  const getImageUrl = (path: string) => {
      if (!path) return '';
      if (path.startsWith('data:') || path.startsWith('http')) return path;
      return getFullApiUrl(path);
  };

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);
  const dismissNotification = () => setGlobalNotification(null);

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
      cookieSettings, saveCookieSettings,
      isPwaUpdateAvailable, updatePwa, pushSubscription, subscribeToPush, unsubscribeFromPush, isPwa,
      isPushSupported, vapidKey
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
