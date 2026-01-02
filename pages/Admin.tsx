
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { OrderStatus, Product, ProductCategory, Order, DeliveryType, PaymentMethod, DayConfig, DiscountCode, DiscountType, PackagingType, DeliveryRegion, User as UserType, Address, PaymentMethodConfig, Language, GlobalSettings, BackupData, RegionException } from '../types';
import { Check, Truck, X, FileText, Plus, Edit, Trash2, Upload, Calendar, AlertTriangle, Save, Ban, Search, Package, CreditCard, Building, Tag, RefreshCw, Filter, AlertCircle, MapPin, ShoppingBag, Minus, Activity, User, ChevronLeft, ChevronRight, UserPlus, Download, Database, QrCode, MessageSquare, Server, HardDrive, ExternalLink } from 'lucide-react';
import { ALLERGENS } from '../constants';
import * as XLSX from 'xlsx';

// Extracted RegionModal Component to prevent focus loss
const RegionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  region: Partial<DeliveryRegion>;
  onSave: (region: Partial<DeliveryRegion>) => Promise<void>; // Changed to Promise
  orders: Order[];
}> = ({ isOpen, onClose, region: initialRegion, onSave, orders }) => {
  const [editingRegion, setEditingRegion] = useState<Partial<DeliveryRegion>>(initialRegion);
  const [regionZipInput, setRegionZipInput] = useState('');
  
  // Exception management state
  const [newException, setNewException] = useState<RegionException>({ date: '', isOpen: false });

  useEffect(() => {
    setEditingRegion(initialRegion);
    setRegionZipInput(initialRegion.zips?.join(',\n') || '');
  }, [initialRegion, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((editingRegion.price || 0) < 0) {
      alert('Cena dopravy nesmí být záporná.');
      return;
    }
    const rawZips = regionZipInput.split(/[,\n]+/).map(s => s.trim()).filter(s => s !== '');
    const invalidZips = rawZips.filter(z => !/^\d{5}$/.test(z));
    if (invalidZips.length > 0) {
      alert(`Následující PSČ jsou neplatná (musí mít 5 číslic): ${invalidZips.join(', ')}`);
      return;
    }
    // Await the save operation
    await onSave({ ...editingRegion, zips: rawZips });
  };

  const addException = () => {
    if (!newException.date) return;
    
    // VALIDATION: Check if active orders exist for this date and region before closing
    if (!newException.isOpen) {
      const currentZips = regionZipInput.split(/[,\n]+/).map(s => s.trim()).filter(s => s !== '');
      
      const conflictingOrders = orders.filter(o => {
        if (o.deliveryDate !== newException.date) return false;
        if (o.deliveryType !== DeliveryType.DELIVERY) return false;
        if (o.status === OrderStatus.CANCELLED) return false;
        
        const zipMatch = o.deliveryAddress?.match(/\b\d{3}\s?\d{2}\b/);
        if (!zipMatch) return false;
        
        const orderZip = zipMatch[0].replace(/\s/g, '');
        return currentZips.includes(orderZip);
      });

      if (conflictingOrders.length > 0) {
        alert(`Nelze uzavřít rozvoz pro region v den ${newException.date}.\n\nExistuje ${conflictingOrders.length} aktivních objednávek směrujících do tohoto regionu.`);
        return;
      }
    }

    const exceptions = editingRegion.exceptions || [];
    if (exceptions.find(e => e.date === newException.date)) {
      alert('Výjimka pro toto datum již existuje.');
      return;
    }
    setEditingRegion({ ...editingRegion, exceptions: [...exceptions, newException] });
    setNewException({ date: '', isOpen: false });
  };

  const removeException = (date: string) => {
    setEditingRegion({ ...editingRegion, exceptions: editingRegion.exceptions?.filter(e => e.date !== date) });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <form onSubmit={handleSave} className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-lg">{editingRegion.id ? 'Upravit zónu' : 'Nová zóna'}</h3>
        <input type="text" placeholder="Název zóny" required className="w-full border rounded p-2" value={editingRegion.name || ''} onChange={e => setEditingRegion({ ...editingRegion, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1">Cena dopravy</label>
            <input type="number" min="0" required className="w-full border rounded p-2" value={editingRegion.price ?? ''} onChange={e => setEditingRegion({ ...editingRegion, price: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1">Zdarma od (Kč)</label>
            <input type="number" min="0" required className="w-full border rounded p-2" value={editingRegion.freeFrom ?? ''} onChange={e => setEditingRegion({ ...editingRegion, freeFrom: Number(e.target.value) })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1">Rozvoz od (HH:MM)</label>
            <input type="time" className="w-full border rounded p-2" value={editingRegion.deliveryTimeStart || ''} onChange={e => setEditingRegion({ ...editingRegion, deliveryTimeStart: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1">Rozvoz do (HH:MM)</label>
            <input type="time" className="w-full border rounded p-2" value={editingRegion.deliveryTimeEnd || ''} onChange={e => setEditingRegion({ ...editingRegion, deliveryTimeEnd: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 block mb-1">PSČ (oddělené čárkou nebo nový řádek)</label>
          <textarea
            className="w-full border rounded p-2 h-24 text-sm font-mono"
            value={regionZipInput}
            onChange={e => setRegionZipInput(e.target.value)}
            placeholder="11000&#10;12000&#10;13000..."
          />
        </div>

        <div className="bg-gray-50 p-4 rounded border">
          <label className="text-xs font-bold text-gray-400 block mb-2">Výjimky v kalendáři (Region)</label>
          <div className="flex gap-2 mb-2 items-end">
            <div className="flex-1">
              <span className="text-[10px] block text-gray-400">Datum</span>
              <input type="date" className="w-full border rounded p-1 text-xs" value={newException.date} onChange={e => setNewException({ ...newException, date: e.target.value })} />
            </div>
            <div className="flex items-center gap-1 pb-2">
              <input type="checkbox" checked={newException.isOpen} onChange={e => setNewException({ ...newException, isOpen: e.target.checked })} />
              <span className="text-xs">Jezdí se?</span>
            </div>
            {newException.isOpen && (
              <>
                <div className="w-20"><input type="time" className="w-full border rounded p-1 text-xs" value={newException.deliveryTimeStart || ''} onChange={e => setNewException({ ...newException, deliveryTimeStart: e.target.value })} /></div>
                <div className="w-20"><input type="time" className="w-full border rounded p-1 text-xs" value={newException.deliveryTimeEnd || ''} onChange={e => setNewException({ ...newException, deliveryTimeEnd: e.target.value })} /></div>
              </>
            )}
            <button type="button" onClick={addException} className="bg-accent text-white px-3 py-1.5 rounded text-xs font-bold self-end">+</button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {editingRegion.exceptions?.map((ex, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs bg-white p-2 border rounded">
                <span>{ex.date}: <strong>{ex.isOpen ? 'Jezdí se' : 'ZAVŘENO'}</strong> {ex.isOpen && `(${ex.deliveryTimeStart || '?'} - ${ex.deliveryTimeEnd || '?'})`}</span>
                <button type="button" onClick={() => removeException(ex.date)} className="text-red-500"><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t mt-2">
          <input type="checkbox" className="w-5 h-5" checked={editingRegion.enabled ?? true} onChange={e => setEditingRegion({ ...editingRegion, enabled: e.target.checked })} />
          <span className="text-sm font-bold">Aktivní</span>
        </div>

        <div className="flex gap-2 pt-4">
          <button type="button" onClick={onClose} className="flex-1 py-2 bg-gray-100 rounded">Zrušit</button>
          <button type="submit" className="flex-1 py-2 bg-primary text-white rounded">Uložit</button>
        </div>
      </form>
    </div>
  );
};

export const Admin: React.FC = () => {
  const { 
    orders, updateOrderStatus, updateOrder, t, user, allUsers, updateUserAdmin, toggleUserBlock, sendPasswordReset, addUser,
    products, addProduct, updateProduct, deleteProduct,
    discountCodes, addDiscountCode, updateDiscountCode, deleteDiscountCode,
    settings, updateSettings, dayConfigs, updateDayConfig, removeDayConfig, getDailyLoad, importDatabase, checkOrderRestoration, printInvoice, generateCzIban, removeDiacritics,
    dataSource, setDataSource
  } = useStore();
  
  const [activeTab, setActiveTab] = useState<'orders' | 'users' | 'products' | 'capacities' | 'discounts' | 'packaging' | 'operator' | 'payments' | 'load' | 'delivery' | 'backup' | 'db'>('orders');
  
  // Selection & Notifications
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [notifyCustomer, setNotifyCustomer] = useState(false);
  
  // Edit Order States
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  
  // Restoration Warning
  const [restorationWarning, setRestorationWarning] = useState<{order: Order, invalidCodes: string[], newStatus: OrderStatus} | null>(null);

  // Filters
  const [orderFilters, setOrderFilters] = useState({
    id: '', dateFrom: '', dateTo: '', customer: '', priceMin: '', priceMax: '', status: '', paymentStatus: '', icStatus: '', noteStatus: ''
  });

  // Confirmations
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'product' | 'discount' | 'region' | 'packaging' | 'exception';
    id: string; 
    name?: string;
  } | null>(null);

  const [productDeleteError, setProductDeleteError] = useState<string | null>(null);

  // Editing States
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Partial<DiscountCode> | null>(null);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [editingPackaging, setEditingPackaging] = useState<Partial<PackagingType> | null>(null);
  const [isPackagingModalOpen, setIsPackagingModalOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Partial<DeliveryRegion> | null>(null);
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [editingDayConfig, setEditingDayConfig] = useState<DayConfig | null>(null);
  const [isDayConfigModalOpen, setIsDayConfigModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentMethodConfig | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [qrModalOrder, setQrModalOrder] = useState<Order | null>(null);
  const [noteModalContent, setNoteModalContent] = useState<string | null>(null);

  // User Management
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', role: 'customer' as 'customer'|'admin'|'driver' });
  const [userModalTab, setUserModalTab] = useState<'info' | 'addresses' | 'orders'>('info');
  const [editingAddress, setEditingAddress] = useState<Partial<Address> | null>(null);
  const [addressModalType, setAddressModalType] = useState<'billing'|'delivery'|null>(null);

  // Backup
  const [importCandidates, setImportCandidates] = useState<BackupData | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSelection, setImportSelection] = useState<Record<string, boolean>>({
    users: false, orders: false, products: false, discountCodes: false, dayConfigs: false, settings: false
  });

  const [showLoadHistory, setShowLoadHistory] = useState(false);
  const [historyDate, setHistoryDate] = useState(new Date());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // --- MEMOS & LOGIC ---

  const getOrderIc = (order: Order) => {
    const userObj = allUsers.find(u => u.id === order.userId);
    const billingAddrObj = userObj?.billingAddresses.find(a => order.billingAddress?.includes(a.street));
    return billingAddrObj?.ic ? billingAddrObj.ic : null;
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (orderFilters.id && !o.id.toLowerCase().includes(orderFilters.id.toLowerCase())) return false;
      if (orderFilters.dateFrom && o.deliveryDate < orderFilters.dateFrom) return false;
      if (orderFilters.dateTo && o.deliveryDate > orderFilters.dateTo) return false;
      if (orderFilters.customer && !o.userName?.toLowerCase().includes(orderFilters.customer.toLowerCase())) return false;
      if (orderFilters.status && o.status !== orderFilters.status) return false;
      const price = o.totalPrice + o.packagingFee + (o.deliveryFee || 0);
      if (orderFilters.priceMin && price < Number(orderFilters.priceMin)) return false;
      if (orderFilters.priceMax && price > Number(orderFilters.priceMax)) return false;
      
      if (orderFilters.paymentStatus) {
        if (orderFilters.paymentStatus === 'yes' && !o.isPaid) return false;
        if (orderFilters.paymentStatus === 'no' && (o.isPaid || o.paymentMethod === PaymentMethod.CASH)) return false;
        if (orderFilters.paymentStatus === 'cash' && o.paymentMethod !== PaymentMethod.CASH) return false;
      }

      if (orderFilters.icStatus) {
        const hasIc = !!getOrderIc(o);
        if (orderFilters.icStatus === 'yes' && !hasIc) return false;
        if (orderFilters.icStatus === 'no' && hasIc) return false;
      }

      if (orderFilters.noteStatus) {
        const hasNote = !!o.note;
        if (orderFilters.noteStatus === 'yes' && !hasNote) return false;
        if (orderFilters.noteStatus === 'no' && hasNote) return false;
      }

      return true;
    });
  }, [orders, orderFilters, allUsers]);

  const loadDates = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const allDates = Array.from(new Set([
      ...orders.map(o => o.deliveryDate),
      ...dayConfigs.map(c => c.date),
      today
    ])).sort();

    if (!showLoadHistory) {
      return allDates.filter(d => d >= today);
    } else {
      const y = historyDate.getFullYear();
      const m = historyDate.getMonth();
      return allDates.filter(d => {
        const dateObj = new Date(d);
        return dateObj.getFullYear() === y && dateObj.getMonth() === m && d < today;
      });
    }
  }, [orders, dayConfigs, showLoadHistory, historyDate]);

  const getQRDataString = (order: Order) => {
    const iban = generateCzIban(settings.companyDetails.bankAccount).replace(/\s/g,'');
    const bic = settings.companyDetails.bic ? `+${settings.companyDetails.bic}` : '';
    const acc = `ACC:${iban}${bic}`;
    const amount = (Math.max(0, order.totalPrice - (order.appliedDiscounts?.reduce((acc, d) => acc + d.amount, 0) || 0)) + order.packagingFee + (order.deliveryFee||0)).toFixed(2);
    const vs = order.id.replace(/\D/g,'') || '0';
    const msg = removeDiacritics(`Objednavka ${order.id}`);
    return `SPD*1.0*${acc}*AM:${amount}*CC:CZK*X-VS:${vs}*MSG:${msg}`;
  };

  if (user?.role !== 'admin') return <div className="p-8 text-center text-red-500 font-bold uppercase tracking-widest">{t('admin.access_denied')}</div>;

  // --- HANDLERS ---

  const handleProductDeleteCheck = (p: Product) => {
    const isUsed = orders.some(o => o.items.some(i => i.id === p.id));
    if (isUsed) {
      setProductDeleteError(t('error.product_delete_dependency'));
    } else {
      setConfirmDelete({ type: 'product', id: p.id, name: p.name });
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    let success = false;
    switch (confirmDelete.type) {
      case 'product': success = await deleteProduct(confirmDelete.id); break;
      case 'discount': success = await deleteDiscountCode(confirmDelete.id); break;
      case 'region': success = await updateSettings({...settings, deliveryRegions: settings.deliveryRegions.filter(r => r.id !== confirmDelete.id)}); break;
      case 'packaging': success = await updateSettings({...settings, packaging: {...settings.packaging, types: settings.packaging.types.filter(p => p.id !== confirmDelete.id)}}); break;
      case 'exception': success = await removeDayConfig(confirmDelete.id); break;
    }
    if (success) setConfirmDelete(null);
  };

  const handleBulkStatusChange = async (status: OrderStatus) => {
    if (selectedOrders.length === 0 || !status) return;
    const success = await updateOrderStatus(selectedOrders, status, notifyCustomer);
    if (success) {
      setSelectedOrders([]);
      setNotifyCustomer(false); 
    }
  };

  const handleOrderStatusChange = (newStatus: OrderStatus) => {
    if (!editingOrder) return;
    if (editingOrder.status === OrderStatus.CANCELLED && newStatus !== OrderStatus.CANCELLED) {
      const check = checkOrderRestoration(editingOrder);
      if (!check.valid) {
        setRestorationWarning({ order: editingOrder, invalidCodes: check.invalidCodes, newStatus });
        return;
      }
    }
    setEditingOrder({...editingOrder, status: newStatus});
  };

  const confirmRestoration = () => {
    if (!restorationWarning) return;
    const { order, invalidCodes, newStatus } = restorationWarning;
    const updatedDiscounts = order.appliedDiscounts?.filter(ad => !invalidCodes.includes(ad.code)) || [];
    setEditingOrder({
      ...order,
      appliedDiscounts: updatedDiscounts,
      status: newStatus
    });
    setRestorationWarning(null);
  };

  const openOrderModal = (order: Order) => {
    setEditingOrder(JSON.parse(JSON.stringify(order)));
    setIsOrderModalOpen(true);
  };

  const getDayCapacityLimit = (date: string, category: ProductCategory) => {
    const override = dayConfigs.find(d => d.date === date)?.capacityOverrides?.[category];
    return override !== undefined ? override : settings.defaultCapacities[category];
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (editingProduct) setEditingProduct({...editingProduct, images: [...(editingProduct.images || []), base64]});
      };
      reader.readAsDataURL(files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUserAddressSave = async () => {
    if(!editingUser || !editingAddress || !addressModalType) return;
    if (!editingAddress.street || !editingAddress.city || !editingAddress.zip) {
      alert("Vyplňte povinná pole (Ulice, Město, PSČ)");
      return;
    }
    const newAddr = { ...editingAddress, id: editingAddress.id || `addr-${Date.now()}` } as Address;
    const key = addressModalType === 'billing' ? 'billingAddresses' : 'deliveryAddresses';
    const updatedAddresses = editingAddress.id 
      ? editingUser[key].map(a => a.id === editingAddress.id ? newAddr : a)
      : [...editingUser[key], newAddr];
    const updatedUser = { ...editingUser, [key]: updatedAddresses };
    setEditingUser(updatedUser);
    const success = await updateUserAdmin(updatedUser);
    if(success) {
      setAddressModalType(null);
      setEditingAddress(null);
    }
  };

  const deleteUserAddress = async (type: 'billing'|'delivery', addrId: string) => {
    if(!editingUser) return;
    const key = type === 'billing' ? 'billingAddresses' : 'deliveryAddresses';
    const updatedUser = { ...editingUser, [key]: editingUser[key].filter(a => a.id !== addrId) };
    setEditingUser(updatedUser);
    await updateUserAdmin(updatedUser);
  };

  const handleOrderAddProduct = (p: Product) => {
    if (!editingOrder) return;
    const existing = editingOrder.items.find(i => i.id === p.id);
    let updatedItems;
    if (existing) {
      updatedItems = editingOrder.items.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
    } else {
      updatedItems = [...editingOrder.items, { ...p, quantity: 1 }];
    }
    const subtotal = updatedItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
    setEditingOrder({ ...editingOrder, items: updatedItems, totalPrice: subtotal });
  };

  const handleOrderUpdateQuantity = (id: string, delta: number) => {
    if (!editingOrder) return;
    const updatedItems = editingOrder.items.map(i => {
      if (i.id === id) {
        return { ...i, quantity: Math.max(0, i.quantity + delta) };
      }
      return i;
    }).filter(i => i.quantity > 0);
    const subtotal = updatedItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
    setEditingOrder({ ...editingOrder, items: updatedItems, totalPrice: subtotal });
  };

  const changeHistoryMonth = (offset: number) => {
    const newDate = new Date(historyDate.getFullYear(), historyDate.getMonth() + offset, 1);
    const today = new Date();
    if (newDate > today) return; 
    setHistoryDate(newDate);
  };

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    const addSheet = (data: any[], name: string) => {
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, name);
    };
    const usersSheet = allUsers.map(u => ({ 
      ...u, 
      billingAddresses: u.billingAddresses ? JSON.stringify(u.billingAddresses) : '[]', 
      deliveryAddresses: u.deliveryAddresses ? JSON.stringify(u.deliveryAddresses) : '[]' 
    }));
    const productsSheet = products.map(p => ({ ...p, images: JSON.stringify(p.images), allergens: JSON.stringify(p.allergens), visibility: JSON.stringify(p.visibility) }));
    const ordersSheet = orders.map(o => ({ ...o, items: JSON.stringify(o.items), appliedDiscounts: JSON.stringify(o.appliedDiscounts), statusHistory: JSON.stringify(o.statusHistory) }));
    const discountsSheet = discountCodes.map(d => ({ ...d, applicableCategories: JSON.stringify(d.applicableCategories) }));
    const dayConfigsSheet = dayConfigs.map(d => ({ ...d, capacityOverrides: JSON.stringify(d.capacityOverrides) }));
    addSheet(usersSheet, 'Users'); addSheet(ordersSheet, 'Orders'); addSheet(productsSheet, 'Products'); addSheet(discountsSheet, 'Discounts'); addSheet(dayConfigsSheet, 'DayConfigs');
    const settingsData = [{ key: 'defaultCapacities', value: JSON.stringify(settings.defaultCapacities) }, { key: 'companyDetails', value: JSON.stringify(settings.companyDetails) }, { key: 'paymentMethods', value: JSON.stringify(settings.paymentMethods) }, { key: 'deliveryRegions', value: JSON.stringify(settings.deliveryRegions) }, { key: 'packaging', value: JSON.stringify(settings.packaging) }];
    addSheet(settingsData, 'Settings');
    XLSX.writeFile(wb, `4gracie_backup_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToAccounting = () => {
    const ordersToExport = selectedOrders.length > 0 ? orders.filter(o => selectedOrders.includes(o.id)) : filteredOrders;
    const data = ordersToExport.map(order => {
      let totalExVat = 0, totalVat = 0, totalIncVat = 0;
      order.items.forEach(item => {
        const rate = item.vatRateTakeaway || 12;
        const gross = item.price * item.quantity;
        const vatAmount = Math.round((gross * rate / (100 + rate)) * 100) / 100;
        const base = Math.round((gross - vatAmount) * 100) / 100;
        totalExVat += base; totalVat += vatAmount; totalIncVat += gross;
      });
      const servicesGross = (order.deliveryFee || 0) + order.packagingFee;
      if (servicesGross > 0) {
        const serviceRate = 21;
        const serviceVat = Math.round((servicesGross * serviceRate / (100 + serviceRate)) * 100) / 100;
        const serviceBase = Math.round((servicesGross - serviceVat) * 100) / 100;
        totalExVat += serviceBase; totalVat += serviceVat; totalIncVat += servicesGross;
      }
      const discountSum = order.appliedDiscounts?.reduce((sum, d) => sum + d.amount, 0) || 0;
      const finalTotal = Math.max(0, totalIncVat - discountSum);
      const userObj = allUsers.find(u => u.id === order.userId);
      const billingAddrObj = userObj?.billingAddresses.find(a => order.billingAddress?.includes(a.street));
      return { 'ID Objednávky': order.id, 'Datum': order.createdAt.split('T')[0], 'Zákazník': order.userName, 'Fakturační Adresa': order.billingAddress, 'IČ': billingAddrObj?.ic || '', 'DIČ': billingAddrObj?.dic || '', 'Cena bez DPH': totalExVat.toFixed(2), 'DPH': totalVat.toFixed(2), 'Cena celkem': finalTotal.toFixed(2) };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ucetnictvi");
    XLSX.writeFile(wb, `export_ucetnictvi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const parsedData: BackupData = {};
      const parseSheet = (sheetName: string) => {
        const ws = wb.Sheets[sheetName];
        if (!ws) return undefined;
        const data = XLSX.utils.sheet_to_json(ws);
        if (sheetName === 'Users') { 
          data.forEach((r: any) => { 
            if (r.billingAddresses) { try { r.billingAddresses = JSON.parse(r.billingAddresses); } catch { r.billingAddresses = []; } } else { r.billingAddresses = []; }
            if (r.deliveryAddresses) { try { r.deliveryAddresses = JSON.parse(r.deliveryAddresses); } catch { r.deliveryAddresses = []; } } else { r.deliveryAddresses = []; }
          }); 
        }
        if (sheetName === 'Products') { data.forEach((r: any) => { try { r.images = JSON.parse(r.images); } catch { r.images = []; } try { r.allergens = JSON.parse(r.allergens); } catch { r.allergens = []; } if (typeof r.visibility === 'string') { try { r.visibility = JSON.parse(r.visibility); } catch { r.visibility = { online: true, store: true, stand: false }; } } else if (!r.visibility) { r.visibility = { online: true, store: true, stand: false }; } }); }
        if (sheetName === 'Orders') { data.forEach((r: any) => { try { r.items = JSON.parse(r.items); } catch { r.items = []; } try { r.appliedDiscounts = JSON.parse(r.appliedDiscounts); } catch { r.appliedDiscounts = []; } try { r.statusHistory = JSON.parse(r.statusHistory); } catch { r.statusHistory = []; } }); }
        if (sheetName === 'Discounts') { data.forEach((r: any) => { try { r.applicableCategories = JSON.parse(r.applicableCategories); } catch { r.applicableCategories = []; } }); }
        if (sheetName === 'DayConfigs') { data.forEach((r: any) => { try { r.capacityOverrides = JSON.parse(r.capacityOverrides); } catch { r.capacityOverrides = {}; } }); }
        if (sheetName === 'Settings') { const reconstructedSettings: any = {}; data.forEach((r: any) => { try { reconstructedSettings[r.key] = JSON.parse(r.value); } catch { console.error('Failed to parse setting:', r.key); } }); return reconstructedSettings; }
        return data as any[];
      };
      parsedData.users = parseSheet('Users'); parsedData.orders = parseSheet('Orders'); parsedData.products = parseSheet('Products'); parsedData.discountCodes = parseSheet('Discounts'); parsedData.dayConfigs = parseSheet('DayConfigs'); parsedData.settings = parseSheet('Settings') as GlobalSettings;
      setImportCandidates(parsedData); setImportErrors([]); setImportSelection({ users: !!parsedData.users, orders: !!parsedData.orders, products: !!parsedData.products, discountCodes: !!parsedData.discountCodes, dayConfigs: !!parsedData.dayConfigs, settings: !!parsedData.settings });
    };
    reader.readAsBinaryString(file);
    if(importInputRef.current) importInputRef.current.value = '';
  };

  const executeImport = () => {
    if (!importCandidates) return;
    const result = importDatabase(importCandidates, importSelection);
    if (result.success) { setImportCandidates(null); setImportErrors([]); } else { setImportErrors(result.collisions || [t('admin.import_fail')]); }
  };

  // Region Save Logic
  const saveRegion = async (updatedRegion: Partial<DeliveryRegion>) => {
    let success = false;
    if (updatedRegion.id) {
      success = await updateSettings({
        ...settings,
        deliveryRegions: settings.deliveryRegions.map(r => r.id === updatedRegion.id ? updatedRegion as DeliveryRegion : r)
      });
    } else {
      success = await updateSettings({
        ...settings,
        deliveryRegions: [...settings.deliveryRegions, { ...updatedRegion, id: 'reg' + Date.now(), enabled: true } as DeliveryRegion]
      });
    }
    if (success) {
      setIsRegionModalOpen(false);
      setEditingRegion(null); // Reset form state
    }
  };

  // --- RENDER ---

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* ... Headers ... */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h1 className="text-3xl font-serif font-bold text-gray-800 tracking-tight">{t('admin.dashboard')}</h1>
        <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl shadow-sm overflow-x-auto">
           {(['orders', 'users', 'load', 'products', 'delivery', 'capacities', 'discounts', 'packaging', 'operator', 'payments', 'backup', 'db'] as const).map(tab => (
             <button 
               key={tab}
               onClick={() => setActiveTab(tab)} 
               className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition whitespace-nowrap ${activeTab === tab ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:bg-white/50'}`}
             >
               {tab === 'db' ? 'DB' : t(`admin.${tab}`)}
             </button>
           ))}
        </div>
      </div>

      {activeTab === 'db' && (
        <div className="animate-fade-in space-y-8">
           <div className="bg-white p-8 rounded-2xl border shadow-sm max-w-2xl mx-auto text-center">
              <h2 className="text-2xl font-bold mb-6 flex items-center justify-center gap-2">
                 <Database className="text-accent" /> Databázové připojení
              </h2>
              <p className="text-gray-500 mb-8 text-sm">
                 Vyberte zdroj dat pro aplikaci.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                 <button 
                    onClick={() => {
                        if (dataSource !== 'api') setDataSource('local');
                    }}
                    disabled={dataSource === 'api'}
                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${dataSource === 'local' ? 'border-accent bg-yellow-50/50' : dataSource === 'api' ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed' : 'border-gray-200 hover:bg-gray-50'}`}
                 >
                    <div className={`p-4 rounded-full ${dataSource === 'local' ? 'bg-accent text-white' : 'bg-gray-100 text-gray-400'}`}>
                       <HardDrive size={32} />
                    </div>
                    <div>
                       <h3 className="font-bold text-lg">Interní paměť</h3>
                       <p className="text-xs text-gray-400">LocalStorage</p>
                    </div>
                    {dataSource === 'local' && <Check className="text-green-500" />}
                 </button>

                 <button 
                    onClick={() => setDataSource('api')}
                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${dataSource === 'api' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}
                 >
                    <div className={`p-4 rounded-full ${dataSource === 'api' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                       <Server size={32} />
                    </div>
                    <div>
                       <h3 className="font-bold text-lg">MariaDB</h3>
                       <p className="text-xs text-gray-400">API Backend</p>
                    </div>
                    {dataSource === 'api' && <Check className="text-green-500" />}
                 </button>
              </div>

              {dataSource === 'local' && (
                 <div className="mt-8 p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm text-left flex items-start">
                    <AlertTriangle className="mr-3 flex-shrink-0" size={20} />
                    <div>
                       <strong>Režim Preview:</strong> Všechny změny (objednávky, produkty, uživatelé) se ukládají pouze do paměti vašeho prohlížeče. Pokud vymažete cache nebo otevřete aplikaci v anonymním okně, data zmizí.
                    </div>
                 </div>
              )}
           </div>
        </div>
      )}

      {/* Rest of the Tabs (Truncated for brevity, logic remains identical to previous file content but wrapped in {activeTab === ...}) */}
      {activeTab === 'users' && (
        <div className="animate-fade-in space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-primary flex items-center"><User className="mr-2 text-accent" /> {t('admin.user_management')}</h2>
            <button onClick={() => setIsAddUserModalOpen(true)} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"><UserPlus size={16} className="mr-2"/> {t('admin.new_user')}</button>
          </div>
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <table className="min-w-full divide-y">
              <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                <tr>
                  <th className="px-6 py-4 text-left">{t('common.name')}</th>
                  <th className="px-6 py-4 text-left">{t('common.email')}</th>
                  <th className="px-6 py-4 text-left">{t('common.role')}</th>
                  <th className="px-6 py-4 text-center">{t('admin.orders')}</th>
                  <th className="px-6 py-4 text-right">{t('common.spent')}</th>
                  <th className="px-6 py-4 text-center">{t('common.status')}</th>
                  <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                {allUsers.map(u => {
                  const userOrders = orders.filter(o => o.userId === u.id);
                  const totalSpent = userOrders.reduce((sum, o) => sum + o.totalPrice + o.packagingFee + (o.deliveryFee||0), 0);
                  return (
                    <tr key={u.id} className={`hover:bg-gray-50 ${u.isBlocked ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4 font-bold">{u.name}</td>
                      <td className="px-6 py-4 text-gray-600">{u.email}</td>
                      <td className="px-6 py-4 uppercase font-bold text-[10px]">{u.role}</td>
                      <td className="px-6 py-4 text-center">{userOrders.length}</td>
                      <td className="px-6 py-4 text-right font-mono">{totalSpent} Kč</td>
                      <td className="px-6 py-4 text-center">
                        {u.isBlocked ? <span className="text-red-600 font-bold flex items-center justify-center"><Ban size={14} className="mr-1"/> {t('common.blocked')}</span> : <span className="text-green-600 font-bold">{t('common.active')}</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => { setEditingUser(u); setIsUserModalOpen(true); }} className="text-blue-600 font-bold hover:underline">{t('common.detail_edit')}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="animate-fade-in space-y-4">
          <div className="flex justify-between mb-4">
            <button onClick={exportToAccounting} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow-sm"><FileText size={16} className="mr-2 text-green-600" /> {t('admin.export')}</button>
            {selectedOrders.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-accent/10 px-3 py-1 rounded-lg border border-accent/20">
                  <span className="text-[10px] font-bold text-primary mr-3">{t('admin.orders')}: {selectedOrders.length}</span>
                  <select className="text-[10px] border rounded bg-white p-1 mr-2" onChange={e => handleBulkStatusChange(e.target.value as OrderStatus)}>
                    <option value="">{t('admin.status_update')}...</option>
                    {Object.values(OrderStatus).map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
                  </select>
                </div>
                <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer select-none bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">
                  <input type="checkbox" checked={notifyCustomer} onChange={e => setNotifyCustomer(e.target.checked)} className="rounded text-accent" />
                  <span>{t('admin.notify_customer')}</span>
                </label>
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4 text-center"><input type="checkbox" onChange={e => setSelectedOrders(e.target.checked ? filteredOrders.map(o => o.id) : [])} checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0} /></th>
                  <th className="px-6 py-4 text-left">
                    <div className="mb-1">{t('filter.id')}</div>
                    <input type="text" placeholder={t('filter.id_placeholder')} className="w-full border rounded p-1 text-[9px] font-normal normal-case" value={orderFilters.id} onChange={e => setOrderFilters({...orderFilters, id: e.target.value})} />
                  </th>
                  <th className="px-6 py-4 text-left">
                    <div className="mb-1">{t('common.date')}</div>
                    <div className="flex gap-1">
                      <input type="text" placeholder="Od" className="w-16 border rounded p-1 text-[9px] font-normal normal-case" value={orderFilters.dateFrom} onChange={e => setOrderFilters({...orderFilters, dateFrom: e.target.value})} />
                      <input type="text" placeholder="Do" className="w-16 border rounded p-1 text-[9px] font-normal normal-case" value={orderFilters.dateTo} onChange={e => setOrderFilters({...orderFilters, dateTo: e.target.value})} />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <div className="mb-1">{t('filter.customer')}</div>
                    <input type="text" placeholder={t('filter.customer_placeholder')} className="w-full border rounded p-1 text-[9px] font-normal normal-case" value={orderFilters.customer} onChange={e => setOrderFilters({...orderFilters, customer: e.target.value})} />
                  </th>
                  <th className="px-6 py-4 text-left">
                    <div className="mb-1">{t('filter.ic')}</div>
                    <select className="w-full border rounded p-1 text-[9px] font-normal normal-case bg-white" value={orderFilters.icStatus} onChange={e => setOrderFilters({...orderFilters, icStatus: e.target.value})}>
                      <option value="">{t('filter.all')}</option>
                      <option value="yes">{t('common.yes')}</option>
                      <option value="no">{t('common.no')}</option>
                    </select>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <div className="mb-1">{t('common.price')} (Kč)</div>
                    <div className="flex gap-1">
                      <input type="number" placeholder={t('filter.price_min')} className="w-16 border rounded p-1 text-[9px] font-normal normal-case" value={orderFilters.priceMin} onChange={e => setOrderFilters({...orderFilters, priceMin: e.target.value})} />
                      <input type="number" placeholder={t('filter.price_max')} className="w-16 border rounded p-1 text-[9px] font-normal normal-case" value={orderFilters.priceMax} onChange={e => setOrderFilters({...orderFilters, priceMax: e.target.value})} />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <div className="mb-1">{t('filter.payment')}</div>
                    <select className="w-full border rounded p-1 text-[9px] font-normal normal-case bg-white" value={orderFilters.paymentStatus} onChange={e => setOrderFilters({...orderFilters, paymentStatus: e.target.value})}>
                      <option value="">{t('filter.all')}</option>
                      <option value="yes">{t('common.yes')}</option>
                      <option value="no">{t('common.no')}</option>
                      <option value="cash">{t('common.cash')}</option>
                    </select>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <div className="mb-1">{t('filter.status')}</div>
                    <select className="w-full border rounded p-1 text-[9px] font-normal normal-case bg-white" value={orderFilters.status} onChange={e => setOrderFilters({...orderFilters, status: e.target.value})}>
                      <option value="">{t('filter.all')}</option>
                      {Object.values(OrderStatus).map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
                    </select>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <div className="mb-1">{t('filter.note')}</div>
                    <select className="w-full border rounded p-1 text-[9px] font-normal normal-case bg-white" value={orderFilters.noteStatus} onChange={e => setOrderFilters({...orderFilters, noteStatus: e.target.value})}>
                      <option value="">{t('filter.all')}</option>
                      <option value="yes">{t('common.yes')}</option>
                      <option value="no">{t('common.no')}</option>
                    </select>
                  </th>
                  <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y text-[11px]">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-center"><input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => setSelectedOrders(prev => prev.includes(order.id) ? prev.filter(x => x !== order.id) : [...prev, order.id])} /></td>
                    <td className="px-6 py-4 font-bold">{order.id}</td>
                    <td className="px-6 py-4 font-mono">{order.deliveryDate}</td>
                    <td className="px-6 py-4">{order.userName}</td>
                    <td className="px-6 py-4 text-center">
                      {getOrderIc(order) ? <span className="font-bold text-xs">{t('common.yes')}</span> : <span className="text-gray-300 text-xs">{t('common.no')}</span>}
                    </td>
                    <td className="px-6 py-4 font-bold">{order.totalPrice + order.packagingFee + (order.deliveryFee || 0)} Kč</td>
                    <td className="px-6 py-4">
                      {order.paymentMethod === PaymentMethod.CASH ? (
                        <span className="px-2 py-0.5 rounded-full font-bold uppercase text-[9px] bg-yellow-100 text-yellow-800">{t('common.cash')}</span>
                      ) : order.isPaid ? (
                        <span className="px-2 py-0.5 rounded-full font-bold uppercase text-[9px] bg-green-100 text-green-700">{t('common.paid')}</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full font-bold uppercase text-[9px] bg-red-100 text-red-700">{t('common.unpaid')}</span>
                      )}
                    </td>
                    <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${order.status === OrderStatus.CANCELLED ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>{t(`status.${order.status}`)}</span></td>
                    <td className="px-6 py-4 text-center">
                      {order.note ? <button onClick={() => setNoteModalContent(order.note || '')} title={order.note}><MessageSquare size={16} className="text-blue-500 mx-auto" /></button> : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setQrModalOrder(order)} className="text-gray-400 hover:text-primary" title="QR Platba"><QrCode size={16}/></button>
                          <button onClick={() => printInvoice(order)} className="text-gray-400 hover:text-primary" title="Faktura PDF"><FileText size={16}/></button>
                          <button onClick={() => openOrderModal(order)} className="text-blue-600 font-bold hover:underline">{t('common.detail_edit')}</button>
                       </div>
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && (
                  <tr><td colSpan={10} className="px-6 py-8 text-center text-gray-400 italic">{t('admin.no_data')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="animate-fade-in space-y-6">
           <div className="flex justify-between items-center"><h2 className="text-xl font-bold flex items-center text-primary"><ShoppingBag className="mr-2 text-accent"/> {t('admin.products')}</h2><button onClick={() => { setEditingProduct({visibility:{online:true, store:true, stand:false}, allergens:[], workload: 0, volume: 0, shelfLifeDays: 1, leadTimeDays: 1, images: [], vatRateInner: 12, vatRateTakeaway: 12, minOrderQuantity: 1, workloadOverhead: 0}); setIsProductModalOpen(true); }} className="bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-black shadow-lg transition">+ {t('admin.add_product')}</button></div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(p => (
                <div key={p.id} className="bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
                   <div className="flex justify-between mb-3">
                      <div className="flex items-center">
                         <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden mr-3"><img src={p.images?.[0] || 'https://via.placeholder.com/100'} className="w-full h-full object-cover" /></div>
                         <div><h3 className="font-bold text-gray-900 leading-tight">{p.name}</h3><span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{p.category ? t(`cat.${p.category}`) : 'N/A'}</span></div>
                      </div>
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition">
                         <button onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={16}/></button>
                         <button onClick={() => handleProductDeleteCheck(p)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                      </div>
                   </div>
                   <div className="flex justify-between items-end pt-4 border-t border-gray-50">
                      <div><span className="text-lg font-bold text-accent">{p.price} Kč</span><span className="text-[10px] text-gray-400 ml-1">/ {p.unit}</span></div>
                      <div className="text-right text-[9px] text-gray-400 font-bold uppercase space-y-1">
                        <div>{t('common.vat')}: {p.vatRateTakeaway}%</div>
                        <div>Min. qty: {p.minOrderQuantity}</div>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'capacities' && (
        <div className="animate-fade-in space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center text-primary"><Calendar className="mr-2 text-accent" /> {t('admin.settings')}</h2>
            <button onClick={() => { setEditingDayConfig({ date: '', isOpen: false, capacityOverrides: {} }); setIsDayConfigModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold">+ {t('admin.exception_add')}</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <h3 className="font-bold text-sm mb-4 border-b pb-2">{t('admin.global_limits')}</h3>
              <div className="space-y-4">
                {Object.entries(settings.defaultCapacities).map(([cat, val]) => (
                  <div key={cat} className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-500 uppercase">{t(`cat.${cat}`)}</span>
                    <input 
                      type="number" 
                      className="w-20 border rounded p-1 text-right text-sm" 
                      value={val} 
                      onChange={async e => {
                         const val = Number(e.target.value);
                         await updateSettings({ ...settings, defaultCapacities: { ...settings.defaultCapacities, [cat]: val } });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 bg-white p-6 rounded-2xl border shadow-sm">
              <h3 className="font-bold text-sm mb-4 border-b pb-2">{t('admin.exceptions')}</h3>
              {dayConfigs.length === 0 ? <p className="text-gray-400 text-xs italic">Žádné výjimky.</p> : (
                <div className="space-y-2">
                  {dayConfigs.map(c => (
                    <div key={c.date} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                      <div>
                        <div className="font-bold text-sm">{c.date}</div>
                        <div className={`text-xs font-bold ${c.isOpen ? 'text-green-600' : 'text-red-600'}`}>{c.isOpen ? t('admin.exception_open') : t('admin.exception_closed')}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingDayConfig(c); setIsDayConfigModalOpen(true); }} className="p-2 hover:bg-white rounded border"><Edit size={14}/></button>
                        <button onClick={() => setConfirmDelete({type: 'exception', id: c.date})} className="p-2 hover:bg-white rounded border text-red-500"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'discounts' && (
        <div className="animate-fade-in space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center text-primary"><Tag className="mr-2 text-accent" /> {t('admin.discounts')}</h2>
            <button onClick={() => { setEditingDiscount({applicableCategories: [], maxUsage: 0, minOrderValue: 0, isStackable: false, enabled: true, type: DiscountType.PERCENTAGE}); setIsDiscountModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold">+ {t('admin.add_discount')}</button>
          </div>
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <table className="min-w-full divide-y text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400">
                <tr><th className="px-4 py-3 text-left">{t('discount.code')}</th><th className="px-4 py-3 text-left">{t('common.price')}</th><th className="px-4 py-3 text-left">{t('common.date')}</th><th className="px-4 py-3 text-left">{t('admin.usage')}</th><th className="px-4 py-3 text-left">{t('admin.total_saved')}</th><th className="px-4 py-3 text-right">{t('common.actions')}</th></tr>
              </thead>
              <tbody className="divide-y">
                {discountCodes.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold">{d.code} {d.enabled ? <span className="text-green-500 text-[10px] ml-1">●</span> : <span className="text-red-300 text-[10px] ml-1">●</span>}</td>
                    <td className="px-4 py-3">{d.value} {d.type === DiscountType.PERCENTAGE ? '%' : 'Kč'}</td>
                    <td className="px-4 py-3 text-xs">{d.validFrom} - {d.validTo}</td>
                    <td className="px-4 py-3 text-xs">{d.usageCount} / {d.maxUsage > 0 ? d.maxUsage : '∞'}</td>
                    <td className="px-4 py-3 text-xs font-mono">{d.totalSaved || 0} Kč</td>
                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                      <button onClick={() => { setEditingDiscount(d); setIsDiscountModalOpen(true); }} className="text-blue-600 hover:underline"><Edit size={14}/></button>
                      <button onClick={() => setConfirmDelete({type: 'discount', id: d.id})} className="text-red-500 hover:underline"><Trash2 size={14}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'delivery' && (
        <div className="animate-fade-in space-y-6">
          <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold flex items-center text-primary"><Truck className="mr-2 text-accent" /> {t('admin.delivery')}</h2><button onClick={() => { setEditingRegion({}); setIsRegionModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold">+ {t('admin.zone_new')}</button></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settings.deliveryRegions.map(r => (
              <div key={r.id} className={`bg-white p-5 rounded-2xl border shadow-sm ${!r.enabled ? 'opacity-60 bg-gray-50' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold flex items-center gap-2">
                    {r.name}
                    {r.enabled ? <span className="w-2 h-2 rounded-full bg-green-500" title={t('common.active')}></span> : <span className="w-2 h-2 rounded-full bg-red-300" title={t('common.inactive')}></span>}
                  </h3>
                  <div className="text-xs font-bold bg-gray-100 px-2 py-1 rounded">{r.price} Kč</div>
                </div>
                <div className="text-xs text-gray-500 mb-2 h-10 overflow-hidden text-ellipsis">{r.zips.join(', ')}</div>
                
                {/* Regular Times */}
                {(r.deliveryTimeStart || r.deliveryTimeEnd) && (
                   <div className="text-[10px] text-blue-600 font-bold mb-2 bg-blue-50 px-2 py-1 rounded inline-block">
                     {t('admin.zone_time')}: {r.deliveryTimeStart || '?'} - {r.deliveryTimeEnd || '?'}
                   </div>
                )}

                {/* Exceptions Indicator */}
                {r.exceptions && r.exceptions.length > 0 && (
                  <div className="mb-4">
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">
                      {r.exceptions.length} výjimek
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center border-t pt-2 mt-2">
                  <span className="text-[10px] text-gray-400">{t('admin.zone_free')}: {r.freeFrom} Kč</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingRegion(r); setIsRegionModalOpen(true); }} className="p-1 hover:bg-gray-50 rounded text-blue-600"><Edit size={14}/></button>
                    <button onClick={() => setConfirmDelete({type: 'region', id: r.id})} className="p-1 hover:bg-gray-50 rounded text-red-500"><Trash2 size={14}/></button>
                  </div>
                </div>
                {!r.enabled && <div className="mt-2 text-[10px] text-red-500 font-bold uppercase tracking-widest text-center">{t('common.inactive')}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'packaging' && (
        <div className="animate-fade-in space-y-6">
          <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold flex items-center text-primary"><Package className="mr-2 text-accent" /> {t('admin.packaging')}</h2><button onClick={() => { setEditingPackaging({}); setIsPackagingModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold">+ {t('admin.pkg_new')}</button></div>
          <div className="bg-white p-6 rounded-2xl border shadow-sm mb-6 flex items-center justify-between">
            <span className="font-bold text-sm">{t('admin.pkg_limit')} (Kč)</span>
            <input type="number" min="0" className="border rounded p-2 w-32 text-right" value={settings.packaging.freeFrom} onChange={e => updateSettings({ ...settings, packaging: { ...settings.packaging, freeFrom: Number(e.target.value) } })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {settings.packaging.types.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-xl border flex justify-between items-center">
                <div><div className="font-bold">{p.name}</div><div className="text-xs text-gray-500">{p.volume} ml / {p.price} Kč</div></div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingPackaging(p); setIsPackagingModalOpen(true); }} className="p-2 hover:bg-gray-100 rounded"><Edit size={14}/></button>
                  <button onClick={() => setConfirmDelete({type: 'packaging', id: p.id})} className="p-2 hover:bg-gray-100 rounded text-red-500"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'operator' && (
        <div className="animate-fade-in space-y-6">
          <h2 className="text-xl font-bold flex items-center text-primary mb-4"><Building className="mr-2 text-accent" /> {t('admin.company_data')}</h2>
          <div className="bg-white p-8 rounded-2xl border shadow-sm max-w-2xl space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Název firmy</label><input type="text" className="w-full border rounded p-2 text-sm" value={settings.companyDetails.name} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, name: e.target.value}})} /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.email')}</label><input type="text" className="w-full border rounded p-2 text-sm" value={settings.companyDetails.email} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, email: e.target.value}})} /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.ic')}</label><input type="text" className="w-full border rounded p-2 text-sm" value={settings.companyDetails.ic} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, ic: e.target.value}})} /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.dic')}</label><input type="text" className="w-full border rounded p-2 text-sm" value={settings.companyDetails.dic} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, dic: e.target.value}})} /></div>
              <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.street')}</label><input type="text" className="w-full border rounded p-2 text-sm" value={settings.companyDetails.street} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, street: e.target.value}})} /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.city')}</label><input type="text" className="w-full border rounded p-2 text-sm" value={settings.companyDetails.city} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, city: e.target.value}})} /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.zip')}</label><input type="text" className="w-full border rounded p-2 text-sm" value={settings.companyDetails.zip} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, zip: e.target.value}})} /></div>
              <div className="col-span-1"><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.bank_acc')}</label><input type="text" className="w-full border rounded p-2 text-sm font-mono" value={settings.companyDetails.bankAccount} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, bankAccount: e.target.value}})} /></div>
              <div className="col-span-1"><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">BIC (SWIFT)</label><input type="text" placeholder="např. KOMBCZPP" className="w-full border rounded p-2 text-sm font-mono uppercase" value={settings.companyDetails.bic || ''} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, bic: e.target.value.toUpperCase()}})} /></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="animate-fade-in space-y-6">
          <h2 className="text-xl font-bold flex items-center text-primary mb-4"><CreditCard className="mr-2 text-accent" /> {t('admin.payment_methods')}</h2>
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden max-w-2xl">
            <div className="divide-y">
              {settings.paymentMethods.map(pm => (
                <div key={pm.id} className="p-4 flex items-center justify-between group">
                  <div className="flex-1">
                    <div className="font-bold flex items-center gap-2">
                      {pm.label}
                      <button onClick={() => { setEditingPayment(pm); setIsPaymentModalOpen(true); }} className="text-blue-500 opacity-0 group-hover:opacity-100 transition"><Edit size={14}/></button>
                    </div>
                    <div className="text-xs text-gray-500">{pm.description}</div>
                  </div>
                  <button 
                    onClick={() => updateSettings({...settings, paymentMethods: settings.paymentMethods.map(x => x.id === pm.id ? {...x, enabled: !x.enabled} : x)})} 
                    className={`w-12 h-6 rounded-full p-1 transition ${pm.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition transform ${pm.enabled ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'load' && (
        <div className="animate-fade-in space-y-4">
           <div className="flex justify-between items-center bg-white p-4 rounded-2xl border shadow-sm">
             <div className="flex items-center gap-4">
               <span className="font-bold text-sm">{t('admin.view_mode')}</span>
               <button onClick={() => setShowLoadHistory(false)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${!showLoadHistory ? 'bg-accent text-white' : 'bg-gray-100'}`}>{t('admin.view_current')}</button>
               <button onClick={() => setShowLoadHistory(true)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${showLoadHistory ? 'bg-accent text-white' : 'bg-gray-100'}`}>{t('admin.view_history')}</button>
             </div>
             {showLoadHistory && (
               <div className="flex items-center gap-2">
                 <button onClick={() => changeHistoryMonth(-1)} className="p-1 hover:bg-gray-100 rounded-full"><ChevronLeft size={20}/></button>
                 <span className="font-bold text-sm min-w-[120px] text-center">{historyDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                 <button onClick={() => changeHistoryMonth(1)} className="p-1 hover:bg-gray-100 rounded-full disabled:opacity-30" disabled={new Date(historyDate.getFullYear(), historyDate.getMonth() + 1, 1) > new Date()}><ChevronRight size={20}/></button>
               </div>
             )}
           </div>
           <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
             <table className="min-w-full divide-y">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4 border-r text-left">{t('common.date')}</th>
                    <th className="px-6 py-4 text-center border-r text-blue-600">{t('admin.orders')}</th>
                    {Object.values(ProductCategory).map(cat => <th key={cat} className="px-6 py-4 text-center">{t(`cat.${cat}`)}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y text-[11px]">
                  {loadDates.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 italic">{t('admin.no_data')}</td></tr>
                  ) : (
                    loadDates.map(date => {
                      const load = getDailyLoad(date);
                      const orderCount = orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED).length;
                      return (
                        <tr key={date} className="hover:bg-gray-50">
                          <td className="px-6 py-3 font-mono font-bold text-gray-900 border-r">{date}</td>
                          <td 
                            className="px-6 py-3 text-center border-r font-bold text-blue-600 bg-blue-50/50 cursor-pointer hover:bg-blue-100 underline decoration-blue-300 decoration-dotted underline-offset-4"
                            onClick={() => {
                              setActiveTab('orders');
                              setOrderFilters({ ...orderFilters, dateFrom: date, dateTo: date });
                            }}
                            title="Zobrazit objednávky pro tento den"
                          >
                            {orderCount} <ExternalLink size={10} className="inline ml-1 opacity-50"/>
                          </td>
                          {Object.values(ProductCategory).map(cat => {
                            const current = load[cat], limit = getDayCapacityLimit(date, cat), perc = limit > 0 ? (current/limit)*100 : 0;
                            return <td key={cat} className={`px-6 py-3 text-center font-bold border-r last:border-r-0 ${perc >= 100 ? 'bg-red-50 text-red-600' : perc > 80 ? 'text-orange-500' : 'text-gray-600'}`}>{current} / {limit}</td>;
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
             </table>
           </div>
        </div>
      )}

      {/* ... Rest of existing modals ... */}
      {/* (Keeping existing code for modals exactly as it was, just ensuring the file ends correctly) */}
      
      {/* ... (Existing modals: backup, delete confirm, product error, note, order edit, add item, qr, product, day config, discount, payment, packaging, region, user, add user) ... */}
      
      {/* CONFIRM DELETE MODAL */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto"><AlertTriangle size={24}/></div>
            <h3 className="font-bold text-lg">{t('confirm.delete_title')}</h3>
            <p className="text-sm text-gray-500">{t('confirm.delete_message')} <strong>{confirmDelete.name || confirmDelete.id}</strong></p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 bg-gray-100 rounded font-bold text-sm">{t('admin.cancel')}</button>
              <button onClick={executeDelete} className="flex-1 py-2 bg-red-600 text-white rounded font-bold text-sm">{t('admin.delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT DELETE ERROR MODAL */}
      {productDeleteError && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto"><Ban size={24}/></div>
            <h3 className="font-bold text-lg">{t('error.delete_title')}</h3>
            <p className="text-sm text-gray-500">{productDeleteError}</p>
            <button onClick={() => setProductDeleteError(null)} className="w-full py-2 bg-gray-100 rounded font-bold text-sm mt-2">Rozumím</button>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {noteModalContent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4" onClick={() => setNoteModalContent(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 relative shadow-xl" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full" onClick={() => setNoteModalContent(null)}><X size={20}/></button>
            <h3 className="font-bold text-lg mb-4 flex items-center"><MessageSquare className="mr-2 text-accent" size={20}/> {t('admin.note_content')}</h3>
            <div className="p-4 bg-gray-50 rounded-xl text-sm whitespace-pre-wrap">{noteModalContent}</div>
          </div>
        </div>
      )}

      {/* Order Modal */}
      {isOrderModalOpen && editingOrder && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
             <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
             <div className="p-6 border-b flex justify-between items-center bg-gray-50">
               <h2 className="text-2xl font-serif font-bold text-primary">{t('admin.edit_order')} #{editingOrder.id}</h2>
               <button onClick={() => setIsOrderModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={24}/></button>
             </div>
             <div className="p-8 overflow-y-auto space-y-8 flex-grow">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest border-b pb-2">{t('checkout.delivery')} & {t('filter.customer')}</h3>
                    <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
                       <div><label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('filter.customer_placeholder')}</label><input type="text" className="w-full border rounded p-2 text-sm" value={editingOrder.userName} onChange={e => setEditingOrder({...editingOrder, userName: e.target.value})}/></div>
                       <div className="grid grid-cols-2 gap-2">
                         <div><label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('common.date')}</label><input type="date" className="w-full border rounded p-2 text-sm" value={editingOrder.deliveryDate} onChange={e => setEditingOrder({...editingOrder, deliveryDate: e.target.value})}/></div>
                         <div><label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('checkout.delivery')}</label><select className="w-full border rounded p-2 text-sm" value={editingOrder.deliveryType} onChange={e => setEditingOrder({...editingOrder, deliveryType: e.target.value as DeliveryType})}><option value={DeliveryType.PICKUP}>{t('checkout.pickup')}</option><option value={DeliveryType.DELIVERY}>{t('admin.delivery')}</option></select></div>
                       </div>
                       <div><label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('common.street')}</label><textarea className="w-full border rounded p-2 text-sm h-20" value={editingOrder.deliveryAddress} onChange={e => setEditingOrder({...editingOrder, deliveryAddress: e.target.value})}/></div>
                       <div>
                         <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('admin.comm_lang')}</label>
                         <select className="w-full border rounded p-2 text-sm" value={editingOrder.language || Language.CS} onChange={e => setEditingOrder({...editingOrder, language: e.target.value as Language})}>
                           {Object.values(Language).map(lang => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
                         </select>
                       </div>
                    </div>
                 </div>
                 <div className="space-y-4">
                    <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest border-b pb-2">{t('checkout.payment')} & {t('common.status')}</h3>
                    <div className="p-4 bg-gray-50 rounded-2xl space-y-4">
                       <div><label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('common.status')}</label><select className="w-full border rounded-lg p-2 font-bold bg-white" value={editingOrder.status} onChange={e => handleOrderStatusChange(e.target.value as OrderStatus)}>{Object.values(OrderStatus).map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</select></div>
                       <div className="grid grid-cols-2 gap-2">
                         <div><label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('checkout.payment')}</label><select className="w-full border rounded p-2 text-sm" value={editingOrder.paymentMethod} onChange={e => setEditingOrder({...editingOrder, paymentMethod: e.target.value as PaymentMethod})}>{Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}</select></div>
                         <div className="flex flex-col justify-end"><label className="flex items-center space-x-2 text-xs font-bold cursor-pointer"><input type="checkbox" className="w-5 h-5 rounded text-accent" checked={editingOrder.isPaid} onChange={e => setEditingOrder({...editingOrder, isPaid: e.target.checked})}/><span>{t('filter.payment')}?</span></label></div>
                       </div>
                       <div><label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('common.street')} (Fakturační)</label><textarea className="w-full border rounded p-2 text-sm h-20" value={editingOrder.billingAddress} onChange={e => setEditingOrder({...editingOrder, billingAddress: e.target.value})}/></div>
                    </div>
                 </div>
                 <div className="col-span-1 md:col-span-2">
                    <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('common.note')}</label>
                    <textarea className="w-full border rounded p-2 text-sm h-16 bg-gray-50" value={editingOrder.note || ''} readOnly />
                 </div>
               </div>
               <div className="space-y-4">
                 <div className="flex justify-between items-center border-b pb-2"><h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest">{t('common.items')}</h3><button onClick={() => setIsAddItemModalOpen(true)} className="text-xs bg-accent text-white px-3 py-1 rounded font-bold hover:bg-yellow-600 transition">+ {t('common.add_item')}</button></div>
                 <div className="border rounded-2xl overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y">
                      <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <tr><th className="px-6 py-3 text-left">{t('admin.products')}</th><th className="px-6 py-3 text-center">Množství</th><th className="px-6 py-3 text-right">{t('common.price')}</th><th className="px-6 py-3 text-right">{t('common.total')}</th><th className="px-6 py-3"></th></tr>
                      </thead>
                      <tbody className="divide-y text-xs">
                        {editingOrder.items.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3 font-bold flex items-center gap-3">
                              {item.images && item.images.length > 0 && (
                                <img src={item.images[0]} alt={item.name} className="w-8 h-8 rounded object-cover border" />
                              )}
                              {item.name}
                            </td>
                            <td className="px-6 py-3 text-center">
                               <div className="flex items-center justify-center space-x-2">
                                 <button onClick={() => handleOrderUpdateQuantity(item.id, -1)} className="p-1 hover:bg-gray-200 rounded"><Minus size={12}/></button>
                                 <span className="font-bold w-8">{item.quantity}</span>
                                 <button onClick={() => handleOrderUpdateQuantity(item.id, 1)} className="p-1 hover:bg-gray-200 rounded"><Plus size={12}/></button>
                                </div>
                            </td>
                            <td className="px-6 py-3 text-right">{item.price} Kč</td>
                            <td className="px-6 py-3 text-right font-bold">{item.price * item.quantity} Kč</td>
                            <td className="px-6 py-3 text-right"><button onClick={() => handleOrderUpdateQuantity(item.id, -item.quantity)} className="text-red-300 hover:text-red-500"><X size={14}/></button></td>
                          </tr>
                        ))}
                        <tr className="bg-gray-100 font-bold border-t-2 border-primary">
                          <td className="px-6 py-4" colSpan={3}>Součet položek</td>
                          <td className="px-6 py-4 text-right">{editingOrder.totalPrice} Kč</td>
                          <td></td>
                        </tr>
                        <tr className="bg-white"><td className="px-6 py-2 text-gray-400" colSpan={3}>Doprava</td><td className="px-6 py-2 text-right"><input type="number" className="w-20 text-right border p-1" value={editingOrder.deliveryFee} onChange={e => setEditingOrder({...editingOrder, deliveryFee: Number(e.target.value)})}/> Kč</td><td></td></tr>
                        <tr className="bg-white"><td className="px-6 py-2 text-gray-400" colSpan={3}>{t('common.packaging')}</td><td className="px-6 py-2 text-right"><input type="number" className="w-20 text-right border p-1" value={editingOrder.packagingFee} onChange={e => setEditingOrder({...editingOrder, packagingFee: Number(e.target.value)})}/> Kč</td><td></td></tr>
                        
                        {editingOrder.appliedDiscounts && editingOrder.appliedDiscounts.length > 0 && (
                          <tr className="bg-green-50/50 text-green-700 font-bold">
                            <td className="px-6 py-2" colSpan={3}>
                              <div className="flex flex-col">
                                <span>Uplatněné slevy:</span>
                                {editingOrder.appliedDiscounts.map(d => <span key={d.code} className="text-[10px] font-normal uppercase ml-2">• {d.code}: -{d.amount} Kč</span>)}
                              </div>
                            </td>
                            <td className="px-6 py-2 text-right">-{editingOrder.appliedDiscounts.reduce((acc, d) => acc + d.amount, 0)} Kč</td>
                            <td></td>
                          </tr>
                        )}

                        <tr className="bg-primary text-white font-bold"><td className="px-6 py-4 text-lg" colSpan={3}>CELKEM K ÚHRADĚ</td><td className="px-6 py-4 text-right text-accent text-xl">{Math.max(0, editingOrder.totalPrice - (editingOrder.appliedDiscounts?.reduce((acc, d) => acc + d.amount, 0) || 0)) + editingOrder.packagingFee + editingOrder.deliveryFee} Kč</td><td></td></tr>
                      </tbody>
                    </table>
                 </div>
               </div>
             </div>
             <div className="p-6 bg-gray-50 border-t flex gap-4"><button onClick={() => setIsOrderModalOpen(false)} className="flex-1 py-3 bg-white border rounded-xl font-bold text-sm uppercase transition">{t('admin.cancel')}</button><button onClick={async () => { const success = await updateOrder(editingOrder); if(success) setIsOrderModalOpen(false); }} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm uppercase shadow-lg transition">{t('admin.save_changes')}</button></div>
          </div>
         </div>
      )}
      
      {/* ADD ITEM MODAL */}
      {isAddItemModalOpen && (
         <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[250] p-4">
             <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4">
            <h3 className="font-bold text-lg">{t('common.add_item')}</h3>
            <div className="max-h-96 overflow-y-auto divide-y">
              {products.map(p => (
                <div key={p.id} className="flex justify-between items-center py-2">
                  <div><span className="font-bold">{p.name}</span><br/><span className="text-xs text-gray-400">{p.price} Kč / {p.unit}</span></div>
                  <button onClick={() => { handleOrderAddProduct(p); setIsAddItemModalOpen(false); }} className="bg-accent text-white px-3 py-1 rounded-xs font-bold">+</button>
                </div>
              ))}
            </div>
            <button onClick={() => setIsAddItemModalOpen(false)} className="w-full bg-gray-100 py-2 rounded font-bold text-sm">{t('admin.cancel')}</button>
          </div>
         </div>
      )}

      {/* QR MODAL */}
      {qrModalOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[250] p-4 backdrop-blur-sm animate-in zoom-in-95 duration-200" onClick={() => setQrModalOrder(null)}>
          <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200" onClick={() => setQrModalOrder(null)}><X size={20}/></button>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-6">QR Platba</h2>
              <div className="bg-white p-2 rounded-xl border inline-block mb-6 shadow-sm">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(getQRDataString(qrModalOrder))}`} 
                  alt="QR Code" 
                  className="w-48 h-48"
                />
              </div>
              <div className="text-left bg-gray-50 p-4 rounded-xl space-y-2 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">{t('common.bank_acc')}</span>
                  <span className="font-bold">{settings.companyDetails.bankAccount}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Var. symbol</span>
                  <span className="font-bold">{qrModalOrder.id.replace(/\D/g, '') || '0'}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-gray-500">{t('common.total')}</span>
                  <span className="font-bold text-lg text-primary">
                    {(Math.max(0, qrModalOrder.totalPrice - (qrModalOrder.appliedDiscounts?.reduce((acc, d) => acc + d.amount, 0) || 0)) + qrModalOrder.packagingFee + (qrModalOrder.deliveryFee||0)).toFixed(2)} Kč
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT MODAL */}
      {isProductModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
           <form onSubmit={async (e) => { 
             e.preventDefault(); 
             if ((editingProduct.price || 0) < 0 || (editingProduct.workload || 0) < 0 || (editingProduct.volume || 0) < 0) {
               alert('Cena, pracnost a objem nesmí být záporné.');
               return;
             }
             let success = false;
             if(editingProduct.id) {
                success = await updateProduct(editingProduct as Product);
             } else {
                success = await addProduct({...editingProduct, id: 'p' + Date.now()} as Product);
             }
             if(success) {
                setIsProductModalOpen(false); 
                setEditingProduct(null); // Clear form
             }
           }} className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl p-8 space-y-6 overflow-y-auto max-h-[90vh]">
             <h2 className="text-2xl font-serif font-bold text-primary">{editingProduct.id ? t('admin.edit_product') : t('admin.add_product')}</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('product.name')}</label><input type="text" required className="w-full border rounded-lg p-3 text-sm" value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}/></div>
                <div className="col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('product.description')}</label><textarea className="w-full border rounded-lg p-3 text-sm h-20" value={editingProduct.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}/></div>
                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Kategorie</label><select className="w-full border rounded-lg p-3 text-sm bg-white" value={editingProduct.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value as ProductCategory})}>{Object.values(ProductCategory).map(c => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.price')} (Kč)</label><input type="number" min="0" required className="w-full border rounded-lg p-3 text-sm" value={editingProduct.price || 0} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})}/></div>
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.unit')}</label><select className="w-full border rounded-lg p-3 text-sm bg-white" value={editingProduct.unit} onChange={e => setEditingProduct({...editingProduct, unit: e.target.value as 'ks' | 'kg'})}><option value="ks">ks</option><option value="kg">kg</option></select></div>
                </div>
                
                {/* VAT Fields */}
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl border col-span-2 md:col-span-1">
                   <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.vat')} Spotřeba na místě (%)</label><input type="number" min="0" required className="w-full border rounded-lg p-3 text-sm" value={editingProduct.vatRateInner ?? 12} onChange={e => setEditingProduct({...editingProduct, vatRateInner: Number(e.target.value)})}/></div>
                   <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.vat')} S sebou / E-shop (%)</label><input type="number" min="0" required className="w-full border rounded-lg p-3 text-sm" value={editingProduct.vatRateTakeaway ?? 12} onChange={e => setEditingProduct({...editingProduct, vatRateTakeaway: Number(e.target.value)})}/></div>
                </div>

                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.workload')}</label><input type="number" min="0" className="w-full border rounded-lg p-3 text-sm" value={editingProduct.workload || 0} onChange={e => setEditingProduct({...editingProduct, workload: Number(e.target.value)})}/></div>
                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.workloadOverhead')}</label><input type="number" min="0" className="w-full border rounded-lg p-3 text-sm" value={editingProduct.workloadOverhead || 0} onChange={e => setEditingProduct({...editingProduct, workloadOverhead: Number(e.target.value)})}/></div>
                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.volume')}</label><input type="number" min="0" className="w-full border rounded-lg p-3 text-sm" value={editingProduct.volume || 0} onChange={e => setEditingProduct({...editingProduct, volume: Number(e.target.value)})}/></div>
                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.leadTime')}</label><input type="number" className="w-full border rounded-lg p-3 text-sm" value={editingProduct.leadTimeDays || 1} onChange={e => setEditingProduct({...editingProduct, leadTimeDays: Number(e.target.value)})}/></div>
                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.shelf_life')}</label><input type="number" className="w-full border rounded-lg p-3 text-sm" value={editingProduct.shelfLifeDays || 1} onChange={e => setEditingProduct({...editingProduct, shelfLifeDays: Number(e.target.value)})}/></div>
                <div><label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">{t('common.min_qty')}</label><input type="number" min="1" className="w-full border rounded-lg p-3 text-sm" value={editingProduct.minOrderQuantity || 1} onChange={e => setEditingProduct({...editingProduct, minOrderQuantity: Number(e.target.value)})}/></div>
                
                <div className="col-span-2 bg-gray-50 p-4 rounded-xl border">
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2">{t('common.visibility')}</label>
                  <div className="flex gap-4">
                    <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editingProduct.visibility?.online ?? true} 
                        onChange={e => setEditingProduct({
                          ...editingProduct, 
                          visibility: { ...editingProduct.visibility, online: e.target.checked }
                        })} 
                        className="rounded text-accent" 
                      />
                      <span>E-shop (Online)</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editingProduct.visibility?.store ?? true} 
                        onChange={e => setEditingProduct({
                          ...editingProduct, 
                          visibility: { ...editingProduct.visibility, store: e.target.checked }
                        })} 
                        className="rounded text-accent" 
                      />
                      <span>Prodejna</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={editingProduct.visibility?.stand ?? false} 
                        onChange={e => setEditingProduct({
                          ...editingProduct, 
                          visibility: { ...editingProduct.visibility, stand: e.target.checked }
                        })} 
                        className="rounded text-accent" 
                      />
                      <span>Stánek</span>
                    </label>
                  </div>
                </div>

                <div className="col-span-2">
                   <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2">{t('common.allergens')}</label>
                   <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border p-2 rounded-lg">
                     {ALLERGENS.map(a => (
                       <button key={a.id} type="button" onClick={() => {
                         const current = editingProduct.allergens || [];
                         const updated = current.includes(a.id) ? current.filter(id => id !== a.id) : [...current, a.id];
                         setEditingProduct({...editingProduct, allergens: updated});
                       }} className={`flex items-center p-2 rounded text-left transition ${editingProduct.allergens?.includes(a.id) ? 'bg-accent text-white' : 'bg-gray-50 hover:bg-gray-100'}`}>
                         <span className="font-bold text-xs w-6">{a.code}</span>
                         <span className="text-[10px] truncate">{a.name}</span>
                       </button>
                     ))}
                   </div>
                </div>
                <div className="col-span-2">
                   <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2">{t('common.images')}</label>
                   <div className="flex flex-wrap gap-3">
                      {editingProduct.images?.map((img, idx) => (
                        <div key={idx} className="relative w-20 h-20 bg-gray-100 rounded-lg overflow-hidden group">
                          <img src={img} className="w-full h-full object-cover" />
                          <button onClick={() => setEditingProduct({...editingProduct, images: editingProduct.images?.filter((_, i) => i !== idx)})} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"><X size={12}/></button>
                        </div>
                      ))}
                      <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-300 cursor-pointer hover:border-accent hover:text-accent transition">
                        <Upload size={20}/><span className="text-[8px] font-bold mt-1">{t('common.upload')}</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageFileChange} ref={fileInputRef}/>
                      </label>
                   </div>
                </div>
             </div>
             <div className="flex gap-4 pt-4"><button type="button" onClick={() => setIsProductModalOpen(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold uppercase text-xs">{t('admin.cancel')}</button><button type="submit" className="flex-1 py-3 bg-accent text-white rounded-xl font-bold uppercase text-xs shadow-lg">{t('common.save')}</button></div>
           </form>
        </div>
      )}

      {/* Day Config Modal */}
      {isDayConfigModalOpen && editingDayConfig && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
          <form onSubmit={async (e) => { 
            e.preventDefault(); 
            if(editingDayConfig.date) {
               const success = await updateDayConfig(editingDayConfig);
               if(success) {
                 setIsDayConfigModalOpen(false);
                 setEditingDayConfig(null);
               }
            } 
          }} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-lg">{t('admin.exceptions')}</h3>
            <input type="date" required className="w-full border rounded p-2" value={editingDayConfig.date} onChange={e => setEditingDayConfig({...editingDayConfig, date: e.target.value})} disabled={!!dayConfigs.find(d => d.date === editingDayConfig.date && d !== editingDayConfig)} />
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={editingDayConfig.isOpen} onChange={e => setEditingDayConfig({...editingDayConfig, isOpen: e.target.checked})} />
              <span className="font-bold text-sm">Otevřeno pro objednávky?</span>
            </div>
            {editingDayConfig.isOpen && (
              <div className="bg-gray-50 p-4 rounded border">
                <h4 className="text-xs font-bold uppercase mb-2">Upravit kapacity (nevyplněné = default)</h4>
                {Object.values(ProductCategory).map(cat => (
                  <div key={cat} className="flex justify-between items-center mb-1">
                    <span className="text-xs">{t(`cat.${cat}`)}</span>
                    <input type="number" className="w-20 border rounded p-1 text-right text-xs" value={editingDayConfig.capacityOverrides?.[cat] ?? ''} placeholder={settings.defaultCapacities[cat].toString()} onChange={e => setEditingDayConfig({...editingDayConfig, capacityOverrides: {...editingDayConfig.capacityOverrides, [cat]: e.target.value ? Number(e.target.value) : undefined}})} />
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2"><button type="button" onClick={() => setIsDayConfigModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">{t('admin.cancel')}</button><button type="submit" className="flex-1 py-2 bg-primary text-white rounded">{t('common.save')}</button></div>
          </form>
        </div>
      )}

      {/* ... (Rest of existing modals: discount, payment, packaging, region, user, add user) ... */}
      
      {/* Discount Modal */}
      {isDiscountModalOpen && editingDiscount && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
          <form onSubmit={async (e) => { 
            e.preventDefault(); 
            if(editingDiscount.value && editingDiscount.value < 0) return alert('Hodnota slevy nesmí být záporná.');
            
            const normalizedCode = editingDiscount.code?.toUpperCase().trim();
            const duplicate = discountCodes.find(d => d.code === normalizedCode && d.id !== editingDiscount.id);
            if (duplicate) {
              alert('Slevový kód s tímto názvem již existuje.');
              return;
            }

            let success = false;
            if(editingDiscount.id) {
               success = await updateDiscountCode(editingDiscount as DiscountCode); 
            } else {
               success = await addDiscountCode({...editingDiscount, id: 'd'+Date.now(), usageCount: 0, totalSaved: 0, enabled: true} as DiscountCode); 
            }
            
            if(success) {
               setIsDiscountModalOpen(false);
               setEditingDiscount(null);
            }
          }} className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg">{editingDiscount.id ? t('admin.edit_discount') : t('admin.add_discount')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input type="text" placeholder="Kód (např. JARO2023)" required className="w-full border rounded p-2 uppercase font-bold" value={editingDiscount.code || ''} onChange={e => setEditingDiscount({...editingDiscount, code: e.target.value.toUpperCase()})} />
                <p className="text-[10px] text-gray-400 mt-1">Unikátní kód, který zákazník zadá v košíku.</p>
              </div>
              <div>
                <select className="w-full border rounded p-2" value={editingDiscount.type} onChange={e => setEditingDiscount({...editingDiscount, type: e.target.value as DiscountType})}>
                  <option value={DiscountType.PERCENTAGE}>Procentuální (%)</option><option value={DiscountType.FIXED}>Fixní částka (Kč)</option>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Typ slevy.</p>
              </div>
              <div>
                <input type="number" min="0" placeholder="Hodnota" required className="w-full border rounded p-2" value={editingDiscount.value || ''} onChange={e => setEditingDiscount({...editingDiscount, value: Number(e.target.value)})} />
                <p className="text-[10px] text-gray-400 mt-1">Výše slevy (např. 10).</p>
              </div>
              <div>
                <input type="number" min="0" placeholder="Min. objednávka (Kč)" className="w-full border rounded p-2" value={editingDiscount.minOrderValue || 0} onChange={e => setEditingDiscount({...editingDiscount, minOrderValue: Number(e.target.value)})} />
                <p className="text-[10px] text-gray-400 mt-1">Minimální částka pro uplatnění.</p>
              </div>
              <div>
                <input type="date" className="w-full border rounded p-2" value={editingDiscount.validFrom || ''} onChange={e => setEditingDiscount({...editingDiscount, validFrom: e.target.value})} />
                <p className="text-[10px] text-gray-400 mt-1">Platnost od.</p>
              </div>
              <div>
                <input type="date" className="w-full border rounded p-2" value={editingDiscount.validTo || ''} onChange={e => setEditingDiscount({...editingDiscount, validTo: e.target.value})} />
                <p className="text-[10px] text-gray-400 mt-1">Platnost do.</p>
              </div>
              <div className="col-span-2">
                <input type="number" min="0" placeholder="Max použití (0 = neomezeně)" className="w-full border rounded p-2" value={editingDiscount.maxUsage || 0} onChange={e => setEditingDiscount({...editingDiscount, maxUsage: Number(e.target.value)})} />
                <p className="text-[10px] text-gray-400 mt-1">Kolikrát lze tento kód celkově uplatnit.</p>
              </div>
              
              <div className="col-span-2 p-3 bg-gray-50 rounded border">
                <label className="text-xs font-bold block mb-2">Platí pro kategorie (nevybráno = všechny)</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(ProductCategory).map(cat => (
                    <label key={cat} className="flex items-center gap-2 text-xs">
                      <input 
                        type="checkbox" 
                        checked={editingDiscount.applicableCategories?.includes(cat) || false}
                        onChange={e => {
                          const current = editingDiscount.applicableCategories || [];
                          const updated = e.target.checked ? [...current, cat] : current.filter(c => c !== cat);
                          setEditingDiscount({...editingDiscount, applicableCategories: updated});
                        }}
                      />
                      {t(`cat.${cat}`)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2"><input type="checkbox" checked={editingDiscount.isStackable || false} onChange={e => setEditingDiscount({...editingDiscount, isStackable: e.target.checked})} /><span className="text-sm">Kombinovatelné s jinými?</span></div>
              <div className="flex items-center gap-2"><input type="checkbox" checked={editingDiscount.enabled ?? true} onChange={e => setEditingDiscount({...editingDiscount, enabled: e.target.checked})} /><span className="text-sm">{t('common.active')}?</span></div>
            </div>
            <div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsDiscountModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">{t('admin.cancel')}</button><button type="submit" className="flex-1 py-2 bg-primary text-white rounded">{t('common.save')}</button></div>
          </form>
        </div>
      )}

      {/* Payment Method Edit Modal */}
      {isPaymentModalOpen && editingPayment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
          <form onSubmit={async (e) => { 
            e.preventDefault(); 
            const success = await updateSettings({
              ...settings, 
              paymentMethods: settings.paymentMethods.map(pm => pm.id === editingPayment.id ? editingPayment : pm)
            });
            if(success) {
              setIsPaymentModalOpen(false);
              setEditingPayment(null);
            }
          }} className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-lg">Upravit platební metodu</h3>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">{t('common.name')}</label>
              <input type="text" required className="w-full border rounded p-2" value={editingPayment.label} onChange={e => setEditingPayment({...editingPayment, label: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">{t('product.description')}</label>
              <textarea required className="w-full border rounded p-2 h-20 text-sm" value={editingPayment.description} onChange={e => setEditingPayment({...editingPayment, description: e.target.value})} />
            </div>
            <div className="flex gap-2"><button type="button" onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">{t('admin.cancel')}</button><button type="submit" className="flex-1 py-2 bg-primary text-white rounded">{t('common.save')}</button></div>
          </form>
        </div>
      )}

      {/* Packaging Modal */}
      {isPackagingModalOpen && editingPackaging && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
          <form onSubmit={async (e) => { 
            e.preventDefault(); 
            if ((editingPackaging.volume || 0) < 0 || (editingPackaging.price || 0) < 0) {
              alert('Cena ani objem nesmí být záporné.');
              return;
            }
            let success = false;
            if(editingPackaging.id) {
               success = await updateSettings({...settings, packaging: {...settings.packaging, types: settings.packaging.types.map(t => t.id === editingPackaging.id ? editingPackaging as PackagingType : t)}}); 
            } else {
               success = await updateSettings({...settings, packaging: {...settings.packaging, types: [...settings.packaging.types, {...editingPackaging, id: 'pkg'+Date.now()} as PackagingType]}}); 
            }
            if(success) {
               setIsPackagingModalOpen(false);
               setEditingPackaging(null);
            }
          }} className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-lg">{t('admin.pkg_new')}</h3>
            <input type="text" placeholder="Název" required className="w-full border rounded p-2" value={editingPackaging.name || ''} onChange={e => setEditingPackaging({...editingPackaging, name: e.target.value})} />
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">{t('common.volume')} (ml)</label>
              <input type="number" min="0" required className="w-full border rounded p-2" value={editingPackaging.volume ?? ''} onChange={e => setEditingPackaging({...editingPackaging, volume: Number(e.target.value)})} />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">{t('common.price')} (Kč)</label>
              <input type="number" min="0" required className="w-full border rounded p-2" value={editingPackaging.price ?? ''} onChange={e => setEditingPackaging({...editingPackaging, price: Number(e.target.value)})} />
            </div>
            <div className="flex gap-2"><button type="button" onClick={() => setIsPackagingModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">{t('admin.cancel')}</button><button type="submit" className="flex-1 py-2 bg-primary text-white rounded">{t('common.save')}</button></div>
          </form>
        </div>
      )}

      {/* Use the extracted RegionModal */}
      <RegionModal 
        isOpen={isRegionModalOpen} 
        onClose={() => setIsRegionModalOpen(false)} 
        region={editingRegion || {}} 
        onSave={saveRegion}
        orders={orders} // Passing orders for validation
      />

      {/* User Modal */}
      {isUserModalOpen && editingUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold flex items-center gap-2"><User size={24}/> {editingUser.name}</h2>
              <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20}/></button>
            </div>
            <div className="flex border-b">
              <button onClick={() => setUserModalTab('info')} className={`flex-1 py-3 text-sm font-bold ${userModalTab === 'info' ? 'border-b-2 border-primary text-primary' : 'text-gray-400'}`}>Info</button>
              <button onClick={() => setUserModalTab('addresses')} className={`flex-1 py-3 text-sm font-bold ${userModalTab === 'addresses' ? 'border-b-2 border-primary text-primary' : 'text-gray-400'}`}>Adresy</button>
              <button onClick={() => setUserModalTab('orders')} className={`flex-1 py-3 text-sm font-bold ${userModalTab === 'orders' ? 'border-b-2 border-primary text-primary' : 'text-gray-400'}`}>Objednávky</button>
            </div>
            <div className="p-6 overflow-y-auto">
              {userModalTab === 'info' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-gray-400 block">{t('common.name')}</label><input type="text" className="w-full border rounded p-2" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-gray-400 block">{t('common.email')}</label><input type="email" className="w-full border rounded p-2" value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} /></div>
                    <div><label className="text-xs font-bold text-gray-400 block">{t('common.role')}</label><select className="w-full border rounded p-2" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as 'customer'|'admin'|'driver'})}><option value="customer">Customer</option><option value="admin">Admin</option><option value="driver">Driver</option></select></div>
                    
                    <div className="col-span-2 flex items-center justify-between p-3 bg-gray-50 rounded-lg border mt-2">
                        <span className="text-sm font-bold text-gray-700">Stav účtu</span>
                        <button onClick={() => toggleUserBlock(editingUser.id)} className={`px-3 py-1 rounded text-xs font-bold ${editingUser.isBlocked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {editingUser.isBlocked ? t('admin.unblock_user') : t('admin.block_user')}
                        </button>
                    </div>

                    <div className="col-span-2 flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <span className="text-sm font-bold text-gray-700">Heslo</span>
                        <button onClick={() => sendPasswordReset(editingUser.email)} className="text-blue-600 hover:underline text-xs font-bold">{t('admin.reset_password')}</button>
                    </div>
                  </div>
                </div>
              )}

              {userModalTab === 'addresses' && (
                 <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-center mb-2"><h4 className="font-bold text-sm text-gray-500 uppercase">Doručovací adresy</h4><button onClick={() => { setAddressModalType('delivery'); setEditingAddress({}); }} className="text-xs text-blue-600 font-bold">+ Přidat</button></div>
                      {editingUser.deliveryAddresses.length === 0 ? <p className="text-xs italic text-gray-400">Žádné adresy.</p> : (
                        <div className="space-y-2">
                          {editingUser.deliveryAddresses.map(a => (
                            <div key={a.id} className="p-3 border rounded-lg flex justify-between items-center bg-gray-50">
                               <div><div className="font-bold text-sm">{a.name}</div><div className="text-xs text-gray-500">{a.street}, {a.city}, {a.zip}</div><div className="text-[10px] text-gray-400">{a.phone}</div></div>
                               <div className="flex gap-2">
                                  <button onClick={() => { setEditingAddress(a); setAddressModalType('delivery'); }} className="text-blue-500 hover:bg-blue-50 p-1 rounded"><Edit size={14}/></button>
                                  <button onClick={() => deleteUserAddress('delivery', a.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14}/></button>
                               </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2"><h4 className="font-bold text-sm text-gray-500 uppercase">Fakturační adresy</h4><button onClick={() => { setAddressModalType('billing'); setEditingAddress({}); }} className="text-xs text-blue-600 font-bold">+ Přidat</button></div>
                      {editingUser.billingAddresses.length === 0 ? <p className="text-xs italic text-gray-400">Žádné adresy.</p> : (
                        <div className="space-y-2">
                          {editingUser.billingAddresses.map(a => (
                            <div key={a.id} className="p-3 border rounded-lg flex justify-between items-center bg-gray-50">
                               <div><div className="font-bold text-sm">{a.name}</div><div className="text-xs text-gray-500">{a.street}, {a.city}</div>{a.ic && <div className="text-xs text-gray-400">IČ: {a.ic}</div>}</div>
                               <div className="flex gap-2">
                                  <button onClick={() => { setEditingAddress(a); setAddressModalType('billing'); }} className="text-blue-500 hover:bg-blue-50 p-1 rounded"><Edit size={14}/></button>
                                  <button onClick={() => deleteUserAddress('billing', a.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14}/></button>
                               </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Inner Address Modal */}
                    {addressModalType && (
                      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[220]">
                         <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm space-y-3">
                           <h4 className="font-bold">{addressModalType === 'billing' ? 'Fakturační adresa' : 'Doručovací adresa'}</h4>
                           <input placeholder="Jméno" className="w-full border p-2 rounded text-sm" value={editingAddress?.name || ''} onChange={e => setEditingAddress({...editingAddress, name: e.target.value})}/>
                           <input placeholder="Ulice" className="w-full border p-2 rounded text-sm" value={editingAddress?.street || ''} onChange={e => setEditingAddress({...editingAddress, street: e.target.value})}/>
                           <div className="grid grid-cols-2 gap-2">
                             <input placeholder="Město" className="border p-2 rounded text-sm" value={editingAddress?.city || ''} onChange={e => setEditingAddress({...editingAddress, city: e.target.value})}/>
                             <input placeholder="PSČ" className="border p-2 rounded text-sm" value={editingAddress?.zip || ''} onChange={e => setEditingAddress({...editingAddress, zip: e.target.value})}/>
                           </div>
                           {/* Phone for Delivery */}
                           <input placeholder="Kontaktní telefon" className="w-full border p-2 rounded text-sm" required={addressModalType === 'delivery'} value={editingAddress?.phone || ''} onChange={e => setEditingAddress({...editingAddress, phone: e.target.value})}/>
                           
                           {addressModalType === 'billing' && (
                             <div className="grid grid-cols-2 gap-2">
                               <input placeholder="IČ" className="border p-2 rounded text-sm" value={editingAddress?.ic || ''} onChange={e => setEditingAddress({...editingAddress, ic: e.target.value})}/>
                               <input placeholder="DIČ" className="border p-2 rounded text-sm" value={editingAddress?.dic || ''} onChange={e => setEditingAddress({...editingAddress, dic: e.target.value})}/>
                             </div>
                           )}
                           <div className="flex gap-2 pt-2">
                             <button onClick={() => { setAddressModalType(null); setEditingAddress(null); }} className="flex-1 bg-gray-100 py-2 rounded text-sm font-bold">Zrušit</button>
                             <button onClick={handleUserAddressSave} className="flex-1 bg-primary text-white py-2 rounded text-sm font-bold">Uložit</button>
                           </div>
                         </div>
                      </div>
                    )}
                 </div>
              )}

              {userModalTab === 'orders' && (
                 <div>
                    {orders.filter(o => o.userId === editingUser.id).length === 0 ? <p className="text-center text-gray-400 py-8 italic">Žádné objednávky.</p> : (
                      <table className="min-w-full divide-y text-xs">
                        <thead className="bg-gray-50 text-gray-400 uppercase font-bold"><tr><th className="px-4 py-2 text-left">ID</th><th className="px-4 py-2 text-left">Datum</th><th className="px-4 py-2 text-right">Cena</th><th className="px-4 py-2 text-center">Stav</th></tr></thead>
                        <tbody className="divide-y">
                          {orders.filter(o => o.userId === editingUser.id).map(o => (
                            <tr key={o.id}>
                              <td className="px-4 py-2 font-bold">{o.id}</td>
                              <td className="px-4 py-2">{o.deliveryDate}</td>
                              <td className="px-4 py-2 text-right font-bold text-accent">{o.totalPrice} Kč</td>
                              <td className="px-4 py-2 text-center">{t(`status.${o.status}`)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                 </div>
              )}
            </div>
            <div className="p-6 bg-gray-50 border-t flex gap-4">
               <button onClick={() => setIsUserModalOpen(false)} className="flex-1 py-3 bg-white border rounded-xl font-bold uppercase text-xs">{t('admin.cancel')}</button>
               <button onClick={async () => { const success = await updateUserAdmin(editingUser); if(success) setIsUserModalOpen(false); }} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold uppercase text-xs shadow-lg">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-lg">{t('admin.new_user')}</h3>
            <div><label className="text-xs font-bold text-gray-400 block mb-1">{t('common.name')}</label><input type="text" className="w-full border rounded p-2" value={newUserForm.name} onChange={e => setNewUserForm({...newUserForm, name: e.target.value})} /></div>
            <div><label className="text-xs font-bold text-gray-400 block mb-1">{t('common.email')}</label><input type="email" className="w-full border rounded p-2" value={newUserForm.email} onChange={e => setNewUserForm({...newUserForm, email: e.target.value})} /></div>
            <div><label className="text-xs font-bold text-gray-400 block mb-1">{t('common.role')}</label><select className="w-full border rounded p-2" value={newUserForm.role} onChange={e => setNewUserForm({...newUserForm, role: e.target.value as any})}><option value="customer">Customer</option><option value="admin">Admin</option><option value="driver">Driver</option></select></div>
            <div className="bg-blue-50 p-3 rounded text-xs text-blue-700">Uživateli bude odeslán email s odkazem pro nastavení hesla.</div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setIsAddUserModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded text-sm font-bold">{t('admin.cancel')}</button>
              <button onClick={async () => { 
                const success = await addUser(newUserForm.name, newUserForm.email, newUserForm.role); 
                if(success) {
                  setIsAddUserModalOpen(false); 
                  setNewUserForm({ name: '', email: '', role: 'customer' }); // Reset form
                }
              }} className="flex-1 py-2 bg-primary text-white rounded text-sm font-bold">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
