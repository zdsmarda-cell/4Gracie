
import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import { CartItem, Language, Product, User, Order, GlobalSettings, DayConfig, ProductCategory, OrderStatus, PaymentMethod, DiscountCode, DiscountType, AppliedDiscount, DeliveryRegion, PackagingType, CompanyDetails, BackupData } from '../types';
import { MOCK_ORDERS, PRODUCTS as INITIAL_PRODUCTS, DEFAULT_SETTINGS } from '../constants';
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
}

export type DataSourceMode = 'local' | 'api';

interface StoreContextType {
  dataSource: DataSourceMode;
  setDataSource: (mode: DataSourceMode) => void;
  isLoading: boolean;
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
  register: (name: string, email: string, password?: string) => void;
  logout: () => void;
  updateUser: (user: User) => void; 
  updateUserAdmin: (user: User) => void; 
  toggleUserBlock: (userId: string) => void;
  sendPasswordReset: (email: string) => void;
  resetPasswordByToken: (token: string, newPass: string) => PasswordChangeResult;
  changePassword: (oldPass: string, newPass: string) => PasswordChangeResult;
  addUser: (name: string, email: string, role: 'customer' | 'admin' | 'driver') => void;
  
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderIds: string[], status: OrderStatus, sendNotify?: boolean) => void;
  updateOrder: (order: Order, sendNotify?: boolean) => void;
  checkOrderRestoration: (order: Order) => RestorationCheckResult;
  
  products: Product[];
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  
  discountCodes: DiscountCode[];
  appliedDiscounts: AppliedDiscount[];
  addDiscountCode: (code: DiscountCode) => void;
  updateDiscountCode: (code: DiscountCode) => void;
  deleteDiscountCode: (id: string) => void;
  applyDiscount: (code: string) => { success: boolean; error?: string };
  removeAppliedDiscount: (code: string) => void;
  validateDiscount: (code: string, currentCart: CartItem[]) => ValidateDiscountResult;
  
  settings: GlobalSettings;
  updateSettings: (settings: GlobalSettings) => void;
  dayConfigs: DayConfig[];
  updateDayConfig: (config: DayConfig) => void;
  removeDayConfig: (date: string) => void;
  
  checkAvailability: (date: string, cartItems: CartItem[], excludeOrderId?: string) => CheckResult;
  getDateStatus: (date: string, cartItems: CartItem[]) => DayStatus;
  getDailyLoad: (date: string, excludeOrderId?: string) => Record<ProductCategory, number>;
  getDeliveryRegion: (zip: string) => DeliveryRegion | undefined;
  getRegionInfoForDate: (region: DeliveryRegion, date: string) => RegionDateInfo;
  calculatePackagingFee: (items: CartItem[]) => number;
  
  t: (key: string, params?: Record<string, string>) => string;
  generateInvoice: (order: Order) => string;
  printInvoice: (order: Order) => Promise<void>;
  generateCzIban: (accountStr: string) => string;
  removeDiacritics: (str: string) => string;
  
  importDatabase: (data: BackupData, selection: Record<string, boolean>) => ImportResult;
  
  globalNotification: string | null;
  dismissNotification: () => void;

  // Auth Modal State
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

// API HELPER with Fallback check
const apiCall = async (url: string, method: string, body?: any) => {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    // If response is not JSON (e.g. 404 HTML from proxy), throw
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response type");
    }
    if (!res.ok) throw new Error(`API Error ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn(`[API] Call to ${url} failed or skipped:`, e);
    return null;
  }
};

// Fallback Helper
const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
};

const INITIAL_USERS: User[] = [
  { id: 'admin1', name: 'Admin User', email: 'info@4gracie.cz', role: 'admin', billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword('1234') },
  { id: 'user1', name: 'Jan Novák', email: 'jan.novak@example.com', role: 'customer', billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword('1234') }
];

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dataSource, setDataSourceState] = useState<DataSourceMode>(() => {
    return (localStorage.getItem('app_data_source') as DataSourceMode) || 'local';
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [language, setLanguage] = useState<Language>(Language.CS);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [globalNotification, setGlobalNotification] = useState<string | null>(null);

  // Data State
  const [cart, setCart] = useState<CartItem[]>(() => loadFromStorage('cart', []));
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(() => loadFromStorage('session_user', null));
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>([]);
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);

  // Toggle Data Source
  const setDataSource = (mode: DataSourceMode) => {
    localStorage.setItem('app_data_source', mode);
    setDataSourceState(mode);
  };

  // Initial Fetch logic
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      let loadedFromApi = false;
      
      // Only attempt API call if mode is 'api'
      if (dataSource === 'api') {
        const data = await apiCall('/api/bootstrap', 'GET');
        if (data) {
            setAllUsers(data.users || []);
            setProducts(data.products || []);
            setOrders(data.orders || []);
            if (data.settings) setSettings(data.settings);
            setDiscountCodes(data.discountCodes || []);
            setDayConfigs(data.dayConfigs || []);
            loadedFromApi = true;
        } else {
            setGlobalNotification("Nepodařilo se připojit k databázi. Zobrazuji lokální data.");
        }
      }

      // Fallback or Local Mode
      if (!loadedFromApi) {
        if (dataSource === 'local') console.log('⚡ Running in LOCAL MEMORY mode');
        setAllUsers(loadFromStorage('db_users', INITIAL_USERS));
        setProducts(loadFromStorage('db_products', INITIAL_PRODUCTS));
        setOrders(loadFromStorage('db_orders', MOCK_ORDERS));
        setSettings(loadFromStorage('db_settings', DEFAULT_SETTINGS));
        setDiscountCodes(loadFromStorage('db_discounts', []));
        setDayConfigs(loadFromStorage('db_dayconfigs', []));
      }
      
      setIsLoading(false);
    };
    fetchData();
  }, [dataSource]);

  // --- SYNC TO LOCALSTORAGE (Always sync to keep local copy fresh) ---
  useEffect(() => localStorage.setItem('cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('session_user', JSON.stringify(user)), [user]);
  useEffect(() => localStorage.setItem('db_users', JSON.stringify(allUsers)), [allUsers]);
  useEffect(() => localStorage.setItem('db_orders', JSON.stringify(orders)), [orders]);
  useEffect(() => localStorage.setItem('db_products', JSON.stringify(products)), [products]);
  useEffect(() => localStorage.setItem('db_discounts', JSON.stringify(discountCodes)), [discountCodes]);
  useEffect(() => localStorage.setItem('db_settings', JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem('db_dayconfigs', JSON.stringify(dayConfigs)), [dayConfigs]);

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);
  const dismissNotification = () => setGlobalNotification(null);

  // --- CART FUNCTIONS ---
  const addToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...prev, { ...product, quantity }];
    });
    setGlobalNotification(`Produkt "${product.name}" přidán do košíku`);
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

  // --- RE-CALCULATE DISCOUNTS ON CART CHANGE ---
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
      if (removedCodes.length > 0) setGlobalNotification(`Slevový kupon ${removedCodes.join(', ')} byl odebrán.`);
    }
  }, [cart]);

  const t = (key: string, params?: Record<string, string>) => {
    let text = TRANSLATIONS[language][key] || key;
    if (params) Object.entries(params).forEach(([k, v]) => { text = text.replace(`{${k}}`, v); });
    return text;
  };

  // --- DATA MODIFIERS (Check dataSource before API call) ---

  const addOrder = (order: Order) => {
    const orderWithHistory: Order = {
      ...order,
      language: language,
      companyDetailsSnapshot: JSON.parse(JSON.stringify(settings.companyDetails)),
      statusHistory: [{ status: order.status, date: new Date().toISOString() }]
    };
    setOrders(prev => [orderWithHistory, ...prev]);
    if (dataSource === 'api') apiCall('/api/orders', 'POST', orderWithHistory);
    setGlobalNotification(`Objednávka #${order.id} byla vytvořena.`);
  };

  const updateOrder = (order: Order, sendNotify?: boolean) => {
    let updatedOrder = { ...order };
    if (updatedOrder.items.length === 0) {
      updatedOrder.status = OrderStatus.CANCELLED;
      if (!updatedOrder.statusHistory?.some(h => h.status === OrderStatus.CANCELLED)) {
         updatedOrder.statusHistory = [...(updatedOrder.statusHistory || []), { status: OrderStatus.CANCELLED, date: new Date().toISOString() }];
      }
    }
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    if (dataSource === 'api') apiCall('/api/orders', 'POST', updatedOrder);
    if (updatedOrder.status === OrderStatus.CREATED) setGlobalNotification(`Objednávka #${updatedOrder.id} upravena.`);
  };

  const updateOrderStatus = (ids: string[], status: OrderStatus, notify?: boolean) => {
    setOrders(prev => prev.map(o => {
      if (ids.includes(o.id)) {
        return {
          ...o,
          status,
          statusHistory: [...(o.statusHistory || []), { status, date: new Date().toISOString() }]
        };
      }
      return o;
    }));
    
    if (dataSource === 'api') apiCall('/api/orders/status', 'PUT', { ids, status });
    setGlobalNotification(`Stav objednávek (${ids.length}) změněn na: ${t(`status.${status}`)}`);
  };

  const addProduct = (p: Product) => {
    setProducts(prev => [...prev, p]);
    if (dataSource === 'api') apiCall('/api/products', 'POST', p);
  };
  const updateProduct = (p: Product) => {
    setProducts(prev => prev.map(x => x.id === p.id ? p : x));
    if (dataSource === 'api') apiCall('/api/products', 'POST', p);
  };
  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(x => x.id !== id));
    if (dataSource === 'api') apiCall(`/api/products/${id}`, 'DELETE');
  };

  const addUser = (name: string, email: string, role: 'customer' | 'admin' | 'driver') => {
    if (allUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) { alert('Uživatel již existuje.'); return; }
    const newUser: User = { id: Date.now().toString(), name, email, role, billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword('1234') };
    setAllUsers(prev => [...prev, newUser]);
    if (dataSource === 'api') apiCall('/api/users', 'POST', newUser);
    alert(`Uživatel ${name} vytvořen.`);
  };

  const updateUser = (u: User) => {
    setUser(u);
    setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
    if (dataSource === 'api') apiCall('/api/users', 'POST', u);
  };

  const updateUserAdmin = (u: User) => {
    setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
    if (user && user.id === u.id) setUser(u);
    if (dataSource === 'api') apiCall('/api/users', 'POST', u);
  };

  const updateSettings = (s: GlobalSettings) => {
    setSettings(s);
    if (dataSource === 'api') apiCall('/api/settings', 'POST', s);
  };

  const updateDayConfig = (c: DayConfig) => {
    setDayConfigs(prev => {
      const exists = prev.find(d => d.date === c.date);
      return exists ? prev.map(d => d.date === c.date ? c : d) : [...prev, c];
    });
    if (dataSource === 'api') apiCall('/api/calendar', 'POST', c);
  };

  const removeDayConfig = (date: string) => {
    setDayConfigs(prev => prev.filter(d => d.date !== date));
    if (dataSource === 'api') apiCall(`/api/calendar/${date}`, 'DELETE');
  };

  const addDiscountCode = (c: DiscountCode) => {
    setDiscountCodes(prev => [...prev, c]);
    if (dataSource === 'api') apiCall('/api/discounts', 'POST', c);
  };
  const updateDiscountCode = (code: DiscountCode) => {
    setDiscountCodes(prev => prev.map(x => x.id === code.id ? code : x));
    if (dataSource === 'api') apiCall('/api/discounts', 'POST', code);
  };
  const deleteDiscountCode = (id: string) => {
    setDiscountCodes(prev => prev.filter(x => x.id !== id));
    if (dataSource === 'api') apiCall(`/api/discounts/${id}`, 'DELETE');
  };

  // --- LOGIC ---

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
    if (appliedDiscounts.some(d => d.code === code.toUpperCase())) return { success: false, error: 'Kód již uplatněn.' };
    const result = calculateDiscountAmount(code, cart);
    if (result.success && result.discount && result.amount !== undefined) {
      if (appliedDiscounts.length > 0 && !result.discount.isStackable) return { success: false, error: 'Kód nelze kombinovat.' };
      setAppliedDiscounts([...appliedDiscounts, { code: result.discount.code, amount: result.amount }]);
      return { success: true };
    } else {
      return { success: false, error: result.error || 'Neplatný kód.' };
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
    const load: Record<ProductCategory, number> = { [ProductCategory.WARM]: 0, [ProductCategory.COLD]: 0, [ProductCategory.DESSERT]: 0, [ProductCategory.DRINK]: 0 };
    const usedProductIds = new Set<string>();
    relevantOrders.forEach(order => {
      order.items.forEach(item => {
        if (load[item.category] !== undefined) load[item.category] += (item.workload || 0) * item.quantity;
        if (!usedProductIds.has(item.id)) { if (load[item.category] !== undefined) load[item.category] += (item.workloadOverhead || 0); usedProductIds.add(item.id); }
      });
    });
    return load;
  };

  const checkAvailability = (date: string, items: CartItem[], excludeOrderId?: string): CheckResult => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date); targetDate.setHours(0, 0, 0, 0);
    if (targetDate < today) return { allowed: false, reason: 'Minulost.', status: 'past' };
    const categoriesInCart = new Set(items.map(i => i.category));
    const maxLeadTime = items.length > 0 ? Math.max(...items.map(i => i.leadTimeDays || 0)) : 0;
    const minPossibleDate = new Date(today); minPossibleDate.setDate(minPossibleDate.getDate() + maxLeadTime);
    if (targetDate < minPossibleDate) return { allowed: false, reason: 'Příliš brzy.', status: 'too_soon' };
    const config = dayConfigs.find(d => d.date === date);
    if (config && !config.isOpen) return { allowed: false, reason: t('error.day_closed'), status: 'closed' };

    const load = getDailyLoad(date, excludeOrderId);
    const virtualUsedIds = new Set<string>();
    items.forEach(item => {
       load[item.category] += (item.workload || 0) * item.quantity;
       load[item.category] += (item.workloadOverhead || 0); 
    });

    let anyExceeds = false;
    for (const cat of Object.values(ProductCategory)) {
      if (items.length > 0 && !categoriesInCart.has(cat)) continue;
      const limit = config?.capacityOverrides?.[cat] ?? settings.defaultCapacities[cat];
      if (load[cat] > limit) anyExceeds = true;
    }
    if (anyExceeds) return { allowed: false, reason: 'Kapacita vyčerpána.', status: 'exceeds' };
    return { allowed: true, status: 'available' };
  };

  const getDateStatus = (date: string, items: CartItem[]): DayStatus => {
     const check = checkAvailability(date, items);
     return check.status;
  };

  // Other simple functions
  const login = (email: string, password?: string) => {
    const foundUser = allUsers.find(u => u.email === email);
    if (foundUser) {
      if (foundUser.isBlocked) return { success: false, message: 'Blokován.' };
      if (password && foundUser.passwordHash !== hashPassword(password)) return { success: false, message: 'Chybné heslo.' };
      setUser(foundUser); return { success: true };
    }
    return { success: false, message: 'Nenalezen.' };
  };
  const register = (name: string, email: string, password?: string) => {
    if (allUsers.find(u => u.email === email)) { alert('Existuje.'); return; }
    const newUser: User = { id: Date.now().toString(), name, email, role: 'customer', billingAddresses: [], deliveryAddresses: [], passwordHash: hashPassword(password || '1234') };
    setAllUsers(prev => [...prev, newUser]); setUser(newUser); 
    if (dataSource === 'api') apiCall('/api/users', 'POST', newUser);
  };
  const logout = () => setUser(null);
  const toggleUserBlock = (id: string) => {
     const u = allUsers.find(x => x.id === id);
     if (u) { 
        const updated = { ...u, isBlocked: !u.isBlocked };
        updateUserAdmin(updated); 
     }
  };
  const sendPasswordReset = (email: string) => alert('Reset link odeslán (simulace).');
  const resetPasswordByToken = (t: string, p: string) => ({ success: true, message: 'Heslo změněno' });
  const changePassword = (o: string, n: string) => {
     if (!user) return { success: false, message: 'Login required' };
     if (hashPassword(o) !== user.passwordHash) return { success: false, message: 'Staré heslo nesouhlasí' };
     const u = { ...user, passwordHash: hashPassword(n) };
     updateUser(u);
     return { success: true, message: 'Změněno' };
  };
  const getDeliveryRegion = (zip: string) => settings.deliveryRegions.find(r => r.enabled && r.zips.includes(zip.replace(/\s/g,'')));
  const getRegionInfoForDate = (r: DeliveryRegion, d: string) => {
     const ex = r.exceptions?.find(e => e.date === d);
     return ex ? { isOpen: ex.isOpen, timeStart: ex.deliveryTimeStart, timeEnd: ex.deliveryTimeEnd, isException: true } : { isOpen: true, timeStart: r.deliveryTimeStart, timeEnd: r.deliveryTimeEnd, isException: false };
  };
  const checkOrderRestoration = (o: Order) => ({ valid: true, invalidCodes: [] }); // Simplified for now
  const importDatabase = (d: BackupData, s: any) => ({ success: true }); // Disabled in API mode or implement later
  const generateInvoice = (o: Order) => `API_INVOICE_${o.id}`;
  const printInvoice = async (o: Order) => { const doc = new jsPDF(); doc.text(`Faktura ${o.id}`, 10, 10); doc.save('faktura.pdf'); };
  const generateCzIban = calculateCzIban;

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-400">Načítám data...</div>;

  return (
    <StoreContext.Provider value={{
      dataSource, setDataSource,
      isLoading, language, setLanguage, cart, addToCart, removeFromCart, updateCartItemQuantity, clearCart, 
      user, allUsers, login, logout, register, updateUser, updateUserAdmin, toggleUserBlock, sendPasswordReset, resetPasswordByToken, changePassword, addUser,
      orders, addOrder, updateOrderStatus, updateOrder, checkOrderRestoration, products, addProduct, updateProduct, deleteProduct,
      discountCodes, appliedDiscounts, addDiscountCode, updateDiscountCode, deleteDiscountCode, applyDiscount, removeAppliedDiscount, validateDiscount,
      settings, updateSettings, dayConfigs, updateDayConfig, removeDayConfig, checkAvailability, getDateStatus, getDailyLoad, getDeliveryRegion, getRegionInfoForDate,
      calculatePackagingFee,
      t, generateInvoice, printInvoice, generateCzIban, importDatabase, globalNotification, dismissNotification,
      isAuthModalOpen, openAuthModal, closeAuthModal, removeDiacritics
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
