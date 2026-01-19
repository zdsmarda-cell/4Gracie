
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { CartItem, Language, Product, User, Order, GlobalSettings, DayConfig, OrderStatus, DiscountCode, AppliedDiscount, DeliveryRegion, PackagingType, CompanyDetails, BackupData, PickupLocation, Ride, EventSlot, CookieSettings, OrdersSearchResult, Ingredient } from '../types';
import { MOCK_ORDERS, PRODUCTS as INITIAL_PRODUCTS, DEFAULT_SETTINGS, EMPTY_SETTINGS } from '../constants';
import { TRANSLATIONS } from '../translations';
import { jsPDF } from 'jspdf';
import { calculatePackagingFeeLogic, calculateDailyLoad, getAvailableEventDatesLogic, calculateDiscountAmountLogic } from '../utils/orderLogic';
import { calculateCzIban, formatDate, removeDiacritics } from '../utils/helpers';

// IMPORT CUSTOM HOOKS
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useProductLogic } from '../hooks/useProductLogic';
import { useSettingsLogic } from '../hooks/useSettingsLogic';
import { useOrderLogic } from './slices/orderLogic';
import { useRideLogic } from './slices/rideLogic';

// --- TYPES REDEFINITION (Exported) ---
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

// --- CONTEXT TYPE ---
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
  refreshUser: () => Promise<void>; 
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
  ingredients: Ingredient[];
  addIngredient: (ingredient: Ingredient) => Promise<boolean>;
  updateIngredient: (ingredient: Ingredient) => Promise<boolean>;
  deleteIngredient: (id: string) => Promise<boolean>;
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
  deleteRide: (rideId: string) => Promise<boolean>;
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
  showNotify: (msg: string, type?: 'success'|'error', autoClose?: boolean) => void;
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
        id: 'user1', name: 'Jan Novák', email: 'jan.novak@example.com', phone: '+420777777777', 
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
    // --- BASIC STATE ---
    const [language, setLanguage] = useState<Language>(Language.CS);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [globalNotification, setGlobalNotification] = useState<GlobalNotification | null>(null);
    const [cookieSettings, setCookieSettings] = useState<CookieSettings | null>(() => loadFromStorage('cookie_settings', null));
    const [isPwa, setIsPwa] = useState(false);
    const [isPwaUpdateAvailable, setIsPwaUpdateAvailable] = useState(false);
    const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
    const [isPushSupported, setIsPushSupported] = useState(false);
    const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
    
    // --- MAIN STATES ---
    const [user, setUser] = useState<User | null>(() => loadFromStorage('session_user', null));
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [cart, setCart] = useState<CartItem[]>(() => loadFromStorage('cart', []));
    const [orders, setOrders] = useState<Order[]>([]);
    const [rides, setRides] = useState<Ride[]>([]);
    const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);

    // --- HELPERS ---
    const t = useCallback((key: string, params?: Record<string, string>) => {
        const langKey = language as Language;
        let text = TRANSLATIONS[langKey]?.[key] || TRANSLATIONS[Language.CS]?.[key] || key;
        if (params) Object.entries(params).forEach(([k, v]) => { text = text.replace(`{${k}}`, v); });
        return text;
    }, [language]);

    const showNotify = useCallback((message: string, type: 'success' | 'error' = 'success', autoClose: boolean = true) => {
        // @ts-ignore
        const isProd = import.meta?.env?.PROD;
        if (isProd && type === 'success') return;
        setGlobalNotification({ message, type, autoClose });
    }, []);

    const getFullApiUrl = useCallback((endpoint: string) => {
        // @ts-ignore
        const env = (import.meta as any).env;
        if (env.DEV) return endpoint;
        let baseUrl = env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${baseUrl}${cleanEndpoint}`;
    }, []);

    // Alias helper
    const generateCzIban = calculateCzIban;

    // --- HOOKS INTEGRATION ---
    
    // CRITICAL FIX: Stabilize handleAuthError to prevent infinite loop in useApi -> StoreContext re-renders
    const handleAuthError = useCallback(() => {
        setUser(null);
        localStorage.removeItem('session_user');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
    }, [setUser]);

    const { 
        dataSource, setDataSource, isLoading, setIsLoading, 
        isOperationPending, dbConnectionError, setDbConnectionError, apiCall 
    } = useApi(
        (localStorage.getItem('app_data_source') as DataSourceMode) || 'local',
        getFullApiUrl,
        handleAuthError, // Pass stable callback
        showNotify
    );

    const {
        login, register, logout, addUser, updateUser, updateUserAdmin, 
        toggleUserBlock, sendPasswordReset, resetPasswordByToken, changePassword
    } = useAuth(
        dataSource, apiCall, showNotify, async () => { /* noop refresh trigger for auth internally */ }, isPwa, allUsers, setAllUsers, user, setUser
    );

    const {
        cartBump, addToCart, removeFromCart, updateCartItemQuantity, clearCart
    } = useCart(cart, setCart, showNotify);

    const {
        products, setProducts, ingredients, setIngredients,
        addProduct, updateProduct, deleteProduct, searchProducts,
        addIngredient, updateIngredient, deleteIngredient
    } = useProductLogic({ dataSource, apiCall, showNotify, t });

    const {
        settings, setSettings, dayConfigs, setDayConfigs, discountCodes, setDiscountCodes,
        updateSettings, updateDayConfig, removeDayConfig, updateEventSlot, removeEventSlot,
        notifyEventSubscribers, addDiscountCode, updateDiscountCode, deleteDiscountCode
    } = useSettingsLogic({ dataSource, apiCall, showNotify, t });

    const { 
        addOrder, updateOrder, updateOrderStatus, searchOrders 
    } = useOrderLogic({ dataSource, apiCall, setOrders, setRides, rides, language, settings, showNotify, t });

    const { 
        updateRide, deleteRide, printRouteSheet 
    } = useRideLogic({ dataSource, apiCall, setRides, orders, products, settings, showNotify });

    // --- LOGISTICS & CALC ---
    const getDailyLoad = useCallback((date: string, excludeOrderId?: string) => {
        const relevantOrders = orders.filter(o => 
            o.deliveryDate === date && 
            o.status !== OrderStatus.CANCELLED && 
            o.status !== OrderStatus.DELIVERED && 
            o.status !== OrderStatus.NOT_PICKED_UP && 
            o.id !== excludeOrderId
        );
        return calculateDailyLoad(relevantOrders, products, settings);
    }, [orders, products, settings]);

    const checkAvailability = useCallback((date: string, cartItems: CartItem[], excludeOrderId?: string): CheckResult => {
        const today = new Date(); today.setHours(0,0,0,0);
        const target = new Date(date); target.setHours(0,0,0,0);
        if (isNaN(target.getTime())) return { allowed: false, reason: 'Invalid Date', status: 'closed' as DayStatus };
        if (target.getTime() < today.getTime()) return { allowed: false, reason: t('error.past'), status: 'past' as DayStatus };
        const maxLead = cartItems.length > 0 ? Math.max(...cartItems.map(i => Number(i.leadTimeDays) || 0)) : 0;
        const minDate = new Date(today.getTime()); minDate.setDate(minDate.getDate() + maxLead);
        if (target.getTime() < minDate.getTime()) return { allowed: false, reason: t('error.too_soon'), status: 'too_soon' as DayStatus };
        
        const config = dayConfigs.find(d => d.date === date);
        if (config && !config.isOpen) return { allowed: false, reason: t('error.day_closed'), status: 'closed' as DayStatus };

        const { load, eventLoad } = getDailyLoad(date, excludeOrderId);
        
        cartItems.forEach(item => {
            const productDef = products.find(p => String(p.id) === String(item.id));
            const workload = Number(productDef?.workload) || Number(item.workload) || 0;
            const overhead = Number(productDef?.workloadOverhead) || Number(item.workloadOverhead) || 0;
            const quantity = Number(item.quantity) || 0;
            const cat = item.category || productDef?.category;
            const isEvent = !!(item.isEventProduct || productDef?.isEventProduct);
            if (cat) {
                if (isEvent) eventLoad[cat] = (eventLoad[cat] || 0) + (workload * quantity) + overhead;
                else load[cat] = (load[cat] || 0) + (workload * quantity) + overhead;
            }
        });

        let anyExceeds = false;
        const catsToCheck = new Set([...settings.categories.map(c => c.id)]);
        for(const cat of catsToCheck) {
            const limit = config?.capacityOverrides?.[cat] ?? settings.defaultCapacities[cat] ?? 0;
            if ((load[cat] || 0) > limit) anyExceeds = true; 
        }
        if (anyExceeds) return { allowed: false, reason: t('error.capacity_exceeded'), status: 'exceeds' as DayStatus };
        
        const hasEventItems = cartItems.some(i => i.isEventProduct);
        if (hasEventItems) {
            const slot = settings.eventSlots?.find(s => s.date === date);
            if (!slot) return { allowed: false, reason: t('cart.event_only'), status: 'closed' as DayStatus }; 
            let eventExceeds = false;
            for(const cat of catsToCheck) {
                const limit = slot.capacityOverrides?.[cat] ?? 0;
                if (limit > 0 && (eventLoad[cat] || 0) > limit) eventExceeds = true;
            }
            if (eventExceeds) return { allowed: false, reason: t('error.capacity_exceeded'), status: 'exceeds' as DayStatus };
        }
        return { allowed: true, status: 'available' as DayStatus };
    }, [dayConfigs, getDailyLoad, settings, products, t]);

    const getDateStatus = (date: string, items: CartItem[]) => checkAvailability(date, items).status;
    const getDeliveryRegion = (zip: string) => settings.deliveryRegions.find(r => r.enabled && r.zips.includes(zip.replace(/\s/g,'')));
    const getRegionInfoForDate = (r: DeliveryRegion, d: string) => { const ex = r.exceptions?.find(e => e.date === d); return ex ? { isOpen: ex.isOpen, timeStart: ex.deliveryTimeStart, timeEnd: ex.deliveryTimeEnd, isException: true } : { isOpen: true, timeStart: r.deliveryTimeStart, timeEnd: r.deliveryTimeEnd, isException: false }; };
    const getPickupPointInfo = (loc: PickupLocation, d: string) => { const ex = loc.exceptions?.find(e => e.date === d); if (ex) return { isOpen: ex.isOpen, timeStart: ex.deliveryTimeStart, timeEnd: ex.deliveryTimeEnd, isException: true }; const day = new Date(d).getDay(); const c = loc.openingHours[day]; if (!c || !c.isOpen) return { isOpen: false, isException: false }; return { isOpen: true, timeStart: c.start, timeEnd: c.end, isException: false }; };
    const getAvailableEventDates = (p: Product) => getAvailableEventDatesLogic(p, settings, orders, products);
    const isEventCapacityAvailable = (p: Product) => getAvailableEventDates(p).length > 0;
    const calculatePackagingFee = (items: CartItem[]) => calculatePackagingFeeLogic(items, settings.packaging.types, settings.packaging.freeFrom);

    const searchUsers = useCallback(async (filters: any) => { if(dataSource === 'api') { const q = new URLSearchParams(filters).toString(); const res = await apiCall(`/api/users?${q}`, 'GET'); if(res&&res.success) return res.users; return []; } return allUsers; }, [dataSource, apiCall, allUsers]);

    // --- DISCOUNT FUNCTIONS ---
    const validateDiscount = (code: string, currentCart: CartItem[]) => {
        return calculateDiscountAmountLogic(code, currentCart, discountCodes, orders);
    };

    const applyDiscount = (code: string) => {
        if (appliedDiscounts.some(d => d.code === code.toUpperCase())) {
            return { success: false, error: t('discount.applied') };
        }
        const res = validateDiscount(code, cart);
        if (res.success && res.amount !== undefined) {
            if (appliedDiscounts.length > 0) {
                 const newIsStackable = res.discount?.isStackable;
                 const existingAreStackable = appliedDiscounts.every(ad => {
                     const d = discountCodes.find(dc => dc.code === ad.code);
                     return d?.isStackable;
                 });
                 if (!newIsStackable || !existingAreStackable) {
                     return { success: false, error: t('discount.not_stackable') };
                 }
            }
            setAppliedDiscounts([...appliedDiscounts, { code: res.discount!.code, amount: res.amount }]);
            return { success: true };
        }
        return { success: false, error: res.error || t('discount.invalid') };
    };

    const removeAppliedDiscount = (code: string) => {
        setAppliedDiscounts(prev => prev.filter(d => d.code !== code));
    };

    // --- DOCUMENTS ---
    const printInvoice = async (order: Order, type: 'proforma' | 'final' = 'proforma') => {
        if (dataSource === 'api') {
             const token = localStorage.getItem('auth_token');
             try {
                 const res = await fetch(getFullApiUrl(`/api/orders/${order.id}/invoice?type=${type}`), {
                     headers: { 'Authorization': `Bearer ${token}` }
                 });
                 if(res.ok) {
                     const blob = await res.blob();
                     const url = window.URL.createObjectURL(blob);
                     const a = document.createElement('a');
                     a.href = url;
                     a.download = `faktura_${order.id}_${type}.pdf`;
                     document.body.appendChild(a);
                     a.click();
                     document.body.removeChild(a);
                 } else {
                     showNotify('Chyba při generování faktury.', 'error');
                 }
             } catch(e) {
                 showNotify('Chyba spojení.', 'error');
             }
        } else {
             showNotify('Tisk faktur je dostupný pouze v online režimu (API).', 'error');
        }
    };

    // --- REFRESH USER LOGIC ---
    const refreshUser = async () => {
        if(dataSource === 'api') {
            const res = await apiCall('/api/users/me', 'GET');
            if(res && res.success) {
                setUser(res.user);
                localStorage.setItem('session_user', JSON.stringify(res.user));
            }
        }
    };

    // --- DATA FETCHING ---
    const fetchData = async () => {
        setIsLoading(true);
        try {
          if (dataSource === 'api') {
            setAllUsers([]); setProducts([]); setOrders([]); setIngredients([]); setDiscountCodes([]); setDayConfigs([]); setRides([]);
            setSettings(EMPTY_SETTINGS);
            
            const data = await apiCall('/api/bootstrap', 'GET');
            
            if (data) {
                setAllUsers(data.users || []);
                setProducts(data.products || []);
                setOrders(data.orders || []);
                if (data.settings) {
                   const dbSettings = { ...DEFAULT_SETTINGS, ...data.settings };
                   if (!dbSettings.categories) dbSettings.categories = DEFAULT_SETTINGS.categories;
                   if (!dbSettings.pickupLocations) dbSettings.pickupLocations = DEFAULT_SETTINGS.pickupLocations;
                   setSettings(dbSettings); 
                }
                setDiscountCodes(data.discountCodes || []);
                setDayConfigs(data.dayConfigs || []);
                setRides(data.rides || []);
                setIngredients(data.ingredients || []);
                if (data.vapidPublicKey) setVapidPublicKey(data.vapidPublicKey);
            }
          } else {
            // @ts-ignore
            const isProd = import.meta?.env?.PROD;
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (isProd && !isLocalhost) { setDbConnectionError(true); return; }
  
            // LOCAL MODE
            const storedUsers = loadFromStorage<User[]>('db_users', []);
            const mergedUsers = [...storedUsers];
            
            INITIAL_USERS.forEach(initUser => {
                const idx = mergedUsers.findIndex(u => u.id === initUser.id);
                if (idx >= 0) {
                    mergedUsers[idx] = initUser;
                } else {
                    mergedUsers.push(initUser);
                }
            });
            setAllUsers(mergedUsers);

            setProducts(loadFromStorage('db_products', INITIAL_PRODUCTS));
            
            // FIX: Ensure mock orders are restored if storage is empty
            let loadedOrders = loadFromStorage<Order[]>('db_orders', MOCK_ORDERS);
            if (!loadedOrders || loadedOrders.length === 0) {
                loadedOrders = MOCK_ORDERS;
            }
            setOrders(loadedOrders);
            
            setSettings(loadFromStorage('db_settings', DEFAULT_SETTINGS));
            setDiscountCodes(loadFromStorage('db_discounts', []));
            setDayConfigs(loadFromStorage('db_dayconfigs', []));
            setRides(loadFromStorage('db_rides', []));
            setIngredients(loadFromStorage('db_ingredients', []));
            
            showNotify("Přepnuto na lokální paměť (Mock Data).", 'success');
          }
        } catch (err: any) {
          console.error("Fetch Data Error", err);
          setDbConnectionError(true);
        } finally {
          setIsLoading(false);
          setIsInitialized(true);
        }
    };

    const [isInitialized, setIsInitialized] = useState(false);

    // Ref to track last sync
    const lastSyncedSubscriptionRef = useRef<string | null>(null);

    useEffect(() => { fetchData(); }, [dataSource]);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                setSwRegistration(registration);
                registration.pushManager.getSubscription().then(sub => {
                    setPushSubscription(sub);
                    
                    if (sub && user && dataSource === 'api') {
                        // Check if we already synced this exact subscription for this user to avoid loop
                        const syncKey = `${user.id}-${sub.endpoint}`;
                        if (lastSyncedSubscriptionRef.current !== syncKey) {
                            apiCall('/api/notifications/subscribe', 'POST', { subscription: sub })
                                .then(() => {
                                    // Mark as synced only on success
                                    lastSyncedSubscriptionRef.current = syncKey;
                                })
                                .catch(e => console.error(e));
                        }
                    }
                });
            });
        }
    }, [user, dataSource, apiCall]); // Added apiCall to deps but it is stable now

    // Safe Storage Helper
    const saveToStorage = (key: string, value: any) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e: any) {
            console.error(`Storage Save Error (${key}):`, e);
            if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
                showNotify(`Chyba: Plná paměť prohlížeče! Položka nebyla uložena.`, 'error');
            }
        }
    };

    // Storage Sync
    useEffect(() => localStorage.setItem('cart', JSON.stringify(cart)), [cart]);
    useEffect(() => localStorage.setItem('session_user', JSON.stringify(user)), [user]);
    useEffect(() => {
        if (dataSource === 'local' && isInitialized) {
            saveToStorage('db_users', allUsers);
            saveToStorage('db_orders', orders);
            saveToStorage('db_products', products);
            saveToStorage('db_discounts', discountCodes);
            saveToStorage('db_settings', settings);
            saveToStorage('db_dayconfigs', dayConfigs);
            saveToStorage('db_rides', rides);
            saveToStorage('db_ingredients', ingredients);
        }
    }, [allUsers, orders, products, discountCodes, settings, dayConfigs, rides, ingredients, dataSource, isInitialized]);

    // --- CART DISCOUNTS ---
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

    // --- DERIVED LOGIC ---
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

    const uploadImage = async (base64: string, name: string): Promise<string> => {
        if (dataSource === 'api') {
            const res = await apiCall('/api/admin/upload', 'POST', { image: base64, name });
            if (res && res.success) return res.url;
            throw new Error(res?.error || 'Upload failed');
        }
        return base64;
    };

    const importDatabase = async (d: BackupData, s: any): Promise<ImportResult> => {
        if (dataSource === 'api') {
            const res = await apiCall('/api/admin/import', 'POST', { data: d, selection: s });
            if (res && res.success) { await fetchData(); return { success: true }; }
            return { success: false, message: res?.error };
        } else {
            return { success: true };
        }
    };

    // Push
    const updatePwa = () => { if (swRegistration && swRegistration.waiting) { swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' }); setIsPwaUpdateAvailable(false); window.location.reload(); } };
    const subscribeToPush = async () => { if (!swRegistration || !vapidPublicKey) return; try { const sub = await swRegistration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidPublicKey }); setPushSubscription(sub); if (dataSource === 'api') await apiCall('/api/notifications/subscribe', 'POST', { subscription: sub }); } catch (e) { console.error("Push subscribe failed", e); } };
    const unsubscribeFromPush = async () => { if (!pushSubscription) return; await pushSubscription.unsubscribe(); setPushSubscription(null); if (dataSource === 'api') await apiCall('/api/notifications/unsubscribe', 'POST', { endpoint: pushSubscription.endpoint }); };

    return (
        <StoreContext.Provider value={{
            dataSource, setDataSource, isLoading, isOperationPending, dbConnectionError,
            isPreviewEnvironment: dataSource === 'local',
            language, setLanguage, cart, cartBump, addToCart, removeFromCart, updateCartItemQuantity, clearCart,
            user, allUsers, refreshUser, login, register, logout, updateUser, updateUserAdmin, toggleUserBlock, sendPasswordReset, resetPasswordByToken, changePassword, addUser,
            orders, addOrder, updateOrderStatus, updateOrder, checkOrderRestoration: () => ({ valid: true, invalidCodes: [] }), searchOrders,
            products, addProduct, updateProduct, deleteProduct, searchProducts,
            ingredients, addIngredient, updateIngredient, deleteIngredient,
            discountCodes, appliedDiscounts, addDiscountCode, updateDiscountCode, deleteDiscountCode, applyDiscount, removeAppliedDiscount, validateDiscount,
            settings, updateSettings, dayConfigs, updateDayConfig, removeDayConfig, updateEventSlot, removeEventSlot, notifyEventSubscribers,
            rides, updateRide, deleteRide, printRouteSheet,
            checkAvailability, getDateStatus, getDailyLoad, getDeliveryRegion, getRegionInfoForDate, getPickupPointInfo, calculatePackagingFee,
            getAvailableEventDates, isEventCapacityAvailable,
            t, tData: (item, field) => language === Language.CS ? item[field] : (item.translations?.[language]?.[field] || item[field]), 
            generateInvoice: (o) => `INV-${o.id}`, printInvoice, generateCzIban, removeDiacritics, formatDate, getImageUrl, getFullApiUrl, uploadImage,
            importDatabase, refreshData: fetchData, globalNotification, dismissNotification: () => setGlobalNotification(null), showNotify,
            isAuthModalOpen, openAuthModal: () => setIsAuthModalOpen(true), closeAuthModal: () => setIsAuthModalOpen(false),
            cookieSettings, saveCookieSettings: (s) => { setCookieSettings(s); localStorage.setItem('cookie_settings', JSON.stringify(s)); },
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
