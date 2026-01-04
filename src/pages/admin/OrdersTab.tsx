
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus, DeliveryType, Product, Address, User } from '../../types';
import { FileText, X, AlertCircle, Plus, Minus, Trash2, Search, ImageIcon, QrCode, Mail, FileCheck, ChevronDown, Save, AlertTriangle } from 'lucide-react';
import { CustomCalendar } from '../../components/CustomCalendar';

interface OrdersTabProps {
    initialDate?: string | null;
    onClearInitialDate?: () => void;
}

// Internal Confirmation Modal Component
const ConfirmationModal: React.FC<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onClose: () => void;
}> = ({ isOpen, title, message, onConfirm, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
                        <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-sm text-gray-500 mb-6">{message}</p>
                    <div className="flex gap-3 w-full">
                        <button onClick={onClose} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200 transition">Zrušit</button>
                        <button onClick={onConfirm} className="flex-1 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-black transition">Potvrdit</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const OrdersTab: React.FC<OrdersTabProps> = ({ initialDate, onClearInitialDate }) => {
    const { searchOrders, allUsers, t, updateOrder, updateOrderStatus, formatDate, settings, getDeliveryRegion, getRegionInfoForDate, getPickupPointInfo, checkAvailability, products, calculatePackagingFee, validateDiscount, printInvoice, generateCzIban, removeDiacritics, dataSource, updateUserAdmin } = useStore();
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [limit] = useState(25); // Items per page

    const [fetchedOrders, setFetchedOrders] = useState<Order[]>([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);

    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const [notifyCustomer, setNotifyCustomer] = useState(false);
    const [orderFilters, setOrderFilters] = useState({ id: '', dateFrom: '', dateTo: '', customer: '', status: '', ic: '' });
    
    // Bulk Action State
    const [bulkActionValue, setBulkActionValue] = useState("");
    const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);

    // Load data handler with pagination
    const loadOrders = useCallback(async () => {
        setIsLoadingOrders(true);
        try {
            const data = await searchOrders({
                id: orderFilters.id,
                dateFrom: orderFilters.dateFrom,
                dateTo: orderFilters.dateTo,
                status: orderFilters.status,
                customer: orderFilters.customer,
                ic: orderFilters.ic === 'yes' ? 'yes' : orderFilters.ic === 'no' ? 'no' : undefined,
                page: currentPage,
                limit: limit
            });
            setFetchedOrders(data.orders || []);
            setTotalPages(data.pages || 1);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingOrders(false);
        }
    }, [searchOrders, orderFilters, currentPage, limit]);

    // Initial Load & Filter Change
    useEffect(() => {
        const timer = setTimeout(loadOrders, 300);
        return () => clearTimeout(timer);
    }, [loadOrders]);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [orderFilters]);

    // Handle Initial Date from Props (Navigation from Load Tab)
    useEffect(() => {
        if (initialDate) {
            setOrderFilters(prev => ({
                ...prev,
                dateFrom: initialDate,
                dateTo: initialDate,
                id: '',
                customer: '',
                status: '',
                ic: ''
            }));
            if (onClearInitialDate) onClearInitialDate();
        }
    }, [initialDate, onClearInitialDate]);

    // Modal State
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [orderSaveError, setOrderSaveError] = useState<string | null>(null);
    
    // Address Selection State
    const [targetUser, setTargetUser] = useState<User | undefined>(undefined);
    
    // Address Modal State (Admin editing user's address)
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [addressModalMode, setAddressModalMode] = useState<'create' | 'edit'>('create');
    const [addressModalType, setAddressModalType] = useState<'delivery' | 'billing'>('delivery');
    const [addressForm, setAddressForm] = useState<Partial<Address>>({});
    const [addressError, setAddressError] = useState<string | null>(null);
    
    // Items Editing
    const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
    const [productSearch, setProductSearch] = useState('');

    // Discount State for Admin
    const [discountInput, setDiscountInput] = useState('');
    const [discountError, setDiscountError] = useState('');

    // QR Modal State
    const [qrModalOrder, setQrModalOrder] = useState<Order | null>(null);

    // Invoice Dropdown State
    const [openInvoiceMenuId, setOpenInvoiceMenuId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{top: number, left: number} | null>(null);

    // Close menu on scroll or click outside
    useEffect(() => {
        const closeMenu = () => setOpenInvoiceMenuId(null);
        window.addEventListener('click', closeMenu);
        window.addEventListener('scroll', closeMenu, true); // Capture scroll on any element
        return () => {
            window.removeEventListener('click', closeMenu);
            window.removeEventListener('scroll', closeMenu, true);
        };
    }, []);

    const displayOrders = useMemo(() => {
        let result = fetchedOrders;
        if (dataSource === 'local' && orderFilters.ic) {
             result = result.filter(o => {
                const hasIcInAddr = o.billingIc || (o.billingName && o.billingName.toLowerCase().includes('ič'));
                if (orderFilters.ic === 'yes') return hasIcInAddr;
                if (orderFilters.ic === 'no') return !hasIcInAddr;
                return true;
            });
        }
        return result;
    }, [fetchedOrders, orderFilters.ic, dataSource]);

    // Derived region for validation
    const derivedRegion = useMemo(() => {
        if (!editingOrder || editingOrder.deliveryType !== DeliveryType.DELIVERY) return undefined;
        return editingOrder.deliveryZip ? getDeliveryRegion(editingOrder.deliveryZip) : undefined;
    }, [editingOrder?.deliveryType, editingOrder?.deliveryZip]);

    const derivedPickupLocation = useMemo(() => {
        if (!editingOrder || editingOrder.deliveryType !== DeliveryType.PICKUP || !editingOrder.pickupLocationId) return undefined;
        return settings.pickupLocations?.find(l => l.id === editingOrder.pickupLocationId);
    }, [editingOrder?.pickupLocationId, editingOrder?.deliveryType, settings.pickupLocations]);

    // NEW: Handle Bulk Update via Button click triggers Modal
    const handleBulkUpdateClick = () => {
        if (!bulkActionValue || selectedOrders.length === 0) return;
        setIsBulkConfirmOpen(true);
    };

    const performBulkUpdate = async () => {
        const status = bulkActionValue as OrderStatus;
        await updateOrderStatus(selectedOrders, status, notifyCustomer);
        setSelectedOrders([]);
        setNotifyCustomer(false);
        setBulkActionValue(""); 
        setIsBulkConfirmOpen(false);
        loadOrders();
    };

    const toggleInvoiceMenu = (e: React.MouseEvent, orderId: string) => {
        e.stopPropagation();
        if (openInvoiceMenuId === orderId) {
            setOpenInvoiceMenuId(null);
        } else {
            const rect = e.currentTarget.getBoundingClientRect();
            // Calculate position: align right edge of menu with right edge of button
            // rect.right is the right edge of button. 
            // We'll set 'left' and translate or just do calculations.
            setMenuPosition({
                top: rect.bottom + window.scrollY + 2, // Slight offset
                left: rect.right + window.scrollX
            });
            setOpenInvoiceMenuId(orderId);
        }
    };

    const openOrderModal = (o: Order) => {
        setEditingOrder(JSON.parse(JSON.stringify(o)));
        setOrderSaveError(null);
        setDiscountInput('');
        setDiscountError('');
        
        // Find the user to populate context if needed (though billing dropdown removed)
        const user = allUsers.find(u => u.id === o.userId);
        setTargetUser(user);
        
        setIsOrderModalOpen(true);
    };

    // ITEM MANIPULATION
    const handleEditItemQuantity = (itemId: string, delta: number) => {
        if (!editingOrder) return;
        const updatedItems = editingOrder.items.map(i => {
            if (i.id === itemId) return { ...i, quantity: Math.max(0, i.quantity + delta) };
            return i;
        }).filter(i => i.quantity > 0);
        recalculateOrderTotals(updatedItems, editingOrder.appliedDiscounts || []);
    };

    const handleAddProductToOrder = (p: Product) => {
        if (!editingOrder) return;
        const existing = editingOrder.items.find(i => i.id === p.id);
        let updatedItems;
        if (existing) {
            updatedItems = editingOrder.items.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
        } else {
            updatedItems = [...editingOrder.items, { ...p, quantity: 1 }];
        }
        recalculateOrderTotals(updatedItems, editingOrder.appliedDiscounts || []);
    };

    const handleApplyDiscount = () => {
        if (!editingOrder || !discountInput) return;
        setDiscountError('');
        if (editingOrder.appliedDiscounts?.some(d => d.code.toUpperCase() === discountInput.toUpperCase())) {
            setDiscountError('Tento kód je již uplatněn.');
            return;
        }
        const result = validateDiscount(discountInput, editingOrder.items);
        if (result.success && result.amount !== undefined) {
            const newDiscounts = [...(editingOrder.appliedDiscounts || []), { code: result.discount!.code, amount: result.amount }];
            recalculateOrderTotals(editingOrder.items, newDiscounts);
            setDiscountInput('');
        } else {
            setDiscountError(result.error || 'Neplatný kód.');
        }
    };

    const handleRemoveDiscount = (code: string) => {
        if (!editingOrder) return;
        const newDiscounts = editingOrder.appliedDiscounts?.filter(d => d.code !== code) || [];
        recalculateOrderTotals(editingOrder.items, newDiscounts);
    };

    const recalculateOrderTotals = (items: any[], discounts: any[]) => {
        if (!editingOrder) return;
        
        let validDiscounts: any[] = [];
        for(const d of discounts) {
             const res = validateDiscount(d.code, items);
             if(res.success && res.amount !== undefined) {
                 validDiscounts.push({ code: d.code, amount: res.amount });
             }
        }
        
        const itemsTotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
        const packagingFee = calculatePackagingFee(items);
        
        // Recalculate Delivery Fee dynamically based on region rules and new total
        let deliveryFee = editingOrder.deliveryFee;
        if (editingOrder.deliveryType === DeliveryType.DELIVERY) {
            // Try to find region from current zip
            const zip = editingOrder.deliveryZip?.replace(/\s/g, '');
            const region = zip ? getDeliveryRegion(zip) : undefined;
            
            if (region) {
                const totalForLimit = itemsTotal - validDiscounts.reduce((sum, d) => sum + d.amount, 0);
                deliveryFee = totalForLimit >= region.freeFrom ? 0 : region.price;
            }
        } else if (editingOrder.deliveryType === DeliveryType.PICKUP) {
            deliveryFee = 0;
        }
        
        setEditingOrder({ 
            ...editingOrder, 
            items, 
            appliedDiscounts: validDiscounts,
            totalPrice: itemsTotal,
            packagingFee,
            deliveryFee
        });
    };

    const handleOrderSave = async () => {
        if (!editingOrder) return;
        setOrderSaveError(null);
        
        // Validation...
        if (editingOrder.deliveryType === DeliveryType.PICKUP) {
            if (!editingOrder.pickupLocationId) { setOrderSaveError('Vyberte odběrné místo.'); return; }
            const loc = settings.pickupLocations?.find(l => l.id === editingOrder.pickupLocationId);
            if (!loc) { setOrderSaveError('Neplatné odběrné místo.'); return; }
            const info = getPickupPointInfo(loc, editingOrder.deliveryDate);
            if (!info.isOpen) { setOrderSaveError(`Odběrné místo má ${formatDate(editingOrder.deliveryDate)} zavřeno.`); return; }
        } else {
            if (!editingOrder.deliveryStreet || !editingOrder.deliveryCity || !editingOrder.deliveryZip) {
                setOrderSaveError('Vyplňte kompletní doručovací adresu.'); return;
            }
            // Parse zip from address string for validation
            const zipMatch = editingOrder.deliveryZip.replace(/\s/g, '');
            if (zipMatch) {
                const region = getDeliveryRegion(zipMatch);
                if (!region) { setOrderSaveError(`Pro PSČ ${zipMatch} neexistuje rozvozový region.`); return; }
                const info = getRegionInfoForDate(region, editingOrder.deliveryDate);
                if (!info.isOpen) { setOrderSaveError(`Region "${region.name}" nerozváží dne ${formatDate(editingOrder.deliveryDate)}.`); return; }
            }
        }

        const availability = checkAvailability(editingOrder.deliveryDate, editingOrder.items, editingOrder.id);
        if (!availability.allowed && availability.status !== 'available') {
            setOrderSaveError(`Kapacita: ${availability.reason || 'Termín není dostupný'}`);
            return;
        }

        const success = await updateOrder(editingOrder);
        if (success) {
            // Immediate update of local list to reflect price changes without fetch delay
            setFetchedOrders(prev => prev.map(o => o.id === editingOrder.id ? editingOrder : o));
            setIsOrderModalOpen(false);
        }
        else setOrderSaveError('Chyba při ukládání (API Error).');
    };

    const getQRDataString = (order: Order) => {
        const iban = generateCzIban(settings.companyDetails.bankAccount).replace(/\s/g,'');
        const bic = settings.companyDetails.bic ? `+${settings.companyDetails.bic}` : '';
        const acc = `ACC:${iban}${bic}`;
        const amount = (Math.max(0, order.totalPrice - (order.appliedDiscounts?.reduce((acc, d) => acc + d.amount, 0) || 0)) + order.packagingFee + (order.deliveryFee||0)).toFixed(2);
        const vs = order.id.replace(/\D/g,'') || '0';
        const msg = removeDiacritics(`Objednavka ${order.id}`);
        return `SPD*1.0*${acc}*AM:${amount}*CC:CZK*X-VS:${vs}*MSG:${msg}`;
    };

    // --- Address Modal (Admin creating/editing for user) ---

    const openAddressModal = (mode: 'create' | 'edit', type: 'delivery' | 'billing') => {
        if (!targetUser) { alert("Není vybrán uživatel."); return; }
        
        setAddressModalMode(mode);
        setAddressModalType(type);
        setAddressError(null);
        
        // Logic only for creating new address for user record
        setAddressForm({});
        setIsAddressModalOpen(true);
    };

    const handleAddressModalSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!targetUser) return;
        setAddressError(null);
        
        // Validation
        if (!addressForm.name || addressForm.name.length < 3) { setAddressError(t('validation.name_length')); return; }
        if (!addressForm.street) { setAddressError(t('validation.street_required')); return; }
        if (!addressForm.city) { setAddressError(t('validation.city_required')); return; }
        if (!addressForm.zip || !/^\d{5}$/.test(addressForm.zip.replace(/\s/g, ''))) { setAddressError(t('validation.zip_format')); return; }
        if (!addressForm.phone) { setAddressError(t('validation.phone_format')); return; }

        const newAddr = { ...addressForm, id: addressForm.id || Date.now().toString() } as Address;
        const key = addressModalType === 'delivery' ? 'deliveryAddresses' : 'billingAddresses';
        
        let updatedList;
        if (addressModalMode === 'edit') {
            updatedList = targetUser[key].map(a => a.id === newAddr.id ? newAddr : a);
        } else {
            updatedList = [...targetUser[key], newAddr];
        }

        // 1. Update User via Admin API
        const updatedUser = { ...targetUser, [key]: updatedList };
        const success = await updateUserAdmin(updatedUser);
        
        if (success) {
            setTargetUser(updatedUser); // Update local reference
            
            // 2. Auto-fill the form in order modal
            if (addressModalType === 'billing') {
                setEditingOrder(prev => prev ? {
                    ...prev,
                    billingName: newAddr.name,
                    billingStreet: newAddr.street,
                    billingCity: newAddr.city,
                    billingZip: newAddr.zip,
                    billingIc: newAddr.ic,
                    billingDic: newAddr.dic
                } : null);
            }
            setIsAddressModalOpen(false);
        } else {
            setAddressError('Chyba při ukládání uživatele.');
        }
    };

    return (
        <div className="animate-fade-in space-y-4">
            {/* ... (Header and filters unchanged) ... */}
            <div className="flex justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-primary mr-4">{t('admin.orders')}</span>
                    {selectedOrders.length > 0 && (
                    <div className="flex items-center gap-4 animate-in fade-in bg-white p-2 rounded-xl shadow-sm border border-accent/20">
                        <span className="text-xs font-bold text-primary">Vybráno: {selectedOrders.length}</span>
                        {/* Controlled Select for Bulk Action */}
                        <select 
                            className="text-xs border rounded bg-white p-2 font-bold focus:ring-accent outline-none" 
                            onChange={e => setBulkActionValue(e.target.value)}
                            value={bulkActionValue}
                        >
                            <option value="">{t('admin.status_update')}...</option>
                            {Object.values(OrderStatus).map(s => <option key={s as string} value={s as string}>{t(`status.${s}`)}</option>)}
                        </select>
                        <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer select-none border-l pl-4 border-gray-200">
                            <input type="checkbox" checked={notifyCustomer} onChange={e => setNotifyCustomer(e.target.checked)} className="rounded text-accent focus:ring-accent w-4 h-4" />
                            <div className="flex items-center gap-1"><Mail size={14} className={notifyCustomer ? "text-accent" : "text-gray-400"} /><span className={notifyCustomer ? "text-gray-800" : "text-gray-500"}>{t('admin.notify_customer')}</span></div>
                        </label>
                        {/* Bulk Action Trigger Button */}
                        <button 
                            onClick={handleBulkUpdateClick}
                            disabled={!bulkActionValue}
                            className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save size={14} className="mr-1"/> Uložit
                        </button>
                    </div>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal 
                isOpen={isBulkConfirmOpen}
                title="Hromadná změna stavu"
                message={`Opravdu chcete změnit stav ${selectedOrders.length} objednávek na "${t(`status.${bulkActionValue}`)}"?${notifyCustomer ? ' (Bude odeslán informační email)' : ''}`}
                onConfirm={performBulkUpdate}
                onClose={() => setIsBulkConfirmOpen(false)}
            />

            {/* Filters ... (kept same) */}
            <div className="bg-white p-4 rounded-xl border shadow-sm grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                <div className="md:col-span-1"><label className="text-xs font-bold text-gray-400 block mb-1">ID</label><input type="text" className="w-full border rounded p-2 text-xs" placeholder="Filtr ID" value={orderFilters.id} onChange={e => setOrderFilters({...orderFilters, id: e.target.value})} /></div>
                <div className="md:col-span-1"><label className="text-xs font-bold text-gray-400 block mb-1">{t('filter.date_from')}</label><input type="date" className="w-full border rounded p-2 text-xs" value={orderFilters.dateFrom} onChange={e => setOrderFilters({...orderFilters, dateFrom: e.target.value})} /></div>
                <div className="md:col-span-1"><label className="text-xs font-bold text-gray-400 block mb-1">{t('filter.date_to')}</label><input type="date" className="w-full border rounded p-2 text-xs" value={orderFilters.dateTo} onChange={e => setOrderFilters({...orderFilters, dateTo: e.target.value})} /></div>
                <div className="md:col-span-1"><label className="text-xs font-bold text-gray-400 block mb-1">Zákazník</label><input type="text" className="w-full border rounded p-2 text-xs" placeholder="Jméno" value={orderFilters.customer} onChange={e => setOrderFilters({...orderFilters, customer: e.target.value})} /></div>
                <div className="md:col-span-1"><label className="text-xs font-bold text-gray-400 block mb-1">Stav</label><select className="w-full border rounded p-2 text-xs bg-white" value={orderFilters.status} onChange={e => setOrderFilters({...orderFilters, status: e.target.value})}><option value="">Všechny stavy</option>{Object.values(OrderStatus).map(s => <option key={s as string} value={s as string}>{t(`status.${s}`)}</option>)}</select></div>
                <div className="md:col-span-1"><label className="text-xs font-bold text-gray-400 block mb-1">IČ</label><select className="w-full border rounded p-2 text-xs bg-white" value={orderFilters.ic} onChange={e => setOrderFilters({...orderFilters, ic: e.target.value})}><option value="">{t('filter.all')}</option><option value="yes">{t('common.yes')}</option><option value="no">{t('common.no')}</option></select></div>
            </div>

            {isLoadingOrders ? (
                <div className="text-center py-8 text-gray-400">Načítám data...</div>
            ) : (
            <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto relative">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <tr>
                    <th className="px-6 py-4 text-center"><input type="checkbox" onChange={e => setSelectedOrders(e.target.checked ? displayOrders.map(o => o.id) : [])} checked={selectedOrders.length === displayOrders.length && displayOrders.length > 0} /></th>
                    <th className="px-6 py-4 text-left">{t('filter.id')}</th>
                    <th className="px-6 py-4 text-left">{t('common.date')}</th>
                    <th className="px-6 py-4 text-left">{t('filter.customer')}</th>
                    <th className="px-6 py-4 text-left">{t('common.price')} (Kč)</th>
                    <th className="px-6 py-4 text-left">{t('filter.payment')}</th>
                    <th className="px-6 py-4 text-center">IČ</th>
                    <th className="px-6 py-4 text-left">{t('filter.status')}</th>
                    <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y text-[11px]">
                    {displayOrders.map(order => {
                        const hasIc = !!order.billingIc;
                        return (
                            <tr key={order.id} className="hover:bg-gray-50 transition relative group">
                                <td className="px-6 py-4 text-center"><input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => setSelectedOrders(prev => prev.includes(order.id) ? prev.filter(x => x !== order.id) : [...prev, order.id])} /></td>
                                <td className="px-6 py-4 font-bold">{order.id}</td>
                                <td className="px-6 py-4 font-mono">{formatDate(order.deliveryDate)}</td>
                                <td className="px-6 py-4">{order.userName}</td>
                                <td className="px-6 py-4 font-bold">{order.totalPrice + order.packagingFee + (order.deliveryFee || 0)} Kč</td>
                                <td className="px-6 py-4">
                                {order.isPaid ? <span className="text-green-600 font-bold">{t('common.paid')}</span> : <span className="text-red-600 font-bold">{t('common.unpaid')}</span>}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {hasIc ? <span className="text-gray-900 font-bold">ANO</span> : <span className="text-gray-400">NE</span>}
                                </td>
                                <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${order.status === OrderStatus.CANCELLED ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>{t(`status.${order.status}`)}</span></td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 items-center">
                                        <div className="relative inline-block">
                                            <button 
                                                onClick={(e) => toggleInvoiceMenu(e, order.id)} 
                                                className={`p-1 text-gray-500 hover:text-primary flex items-center gap-1 ${openInvoiceMenuId === order.id ? 'text-primary' : ''}`}
                                                title="Stáhnout fakturu"
                                            >
                                                <FileText size={16}/> <ChevronDown size={10}/>
                                            </button>
                                        </div>
                                        <button onClick={() => setQrModalOrder(order)} className="p-1 text-gray-500 hover:text-primary" title="QR Platba"><QrCode size={16}/></button>
                                        <button onClick={() => openOrderModal(order)} className="text-blue-600 font-bold hover:underline ml-2">{t('common.detail_edit')}</button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                </table>
            </div>
            )}

            {/* FIXED POSITION INVOICE MENU using Portal-like strategy */}
            {openInvoiceMenuId && menuPosition && (
                <div 
                    className="fixed bg-white border rounded-xl shadow-xl z-[9999] py-1 overflow-hidden animate-in zoom-in-95 duration-200"
                    style={{ 
                        top: menuPosition.top, 
                        left: menuPosition.left, 
                        width: '160px',
                        transform: 'translateX(-100%)' // Align right edge with button right edge
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {(() => {
                        const order = fetchedOrders.find(o => o.id === openInvoiceMenuId);
                        if (!order) return null;
                        return (
                            <>
                                <button onClick={() => { printInvoice(order, 'proforma'); setOpenInvoiceMenuId(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-xs flex items-center gap-2 text-gray-700">
                                    <FileText size={14}/> Zálohová
                                </button>
                                {order.finalInvoiceDate && (
                                    <button onClick={() => { printInvoice(order, 'final'); setOpenInvoiceMenuId(null); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-xs flex items-center gap-2 text-green-700 font-bold border-t border-gray-100">
                                        <FileCheck size={14}/> Daňový doklad
                                    </button>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* QR Modal */}
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

            {isOrderModalOpen && editingOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                    <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="text-2xl font-serif font-bold text-primary">{t('admin.edit_order')} #{editingOrder.id}</h2>
                    <button onClick={() => setIsOrderModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={24}/></button>
                    </div>
                    <div className="p-8 overflow-y-auto space-y-8 flex-grow">
                        {orderSaveError && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700 text-sm font-bold flex items-center">
                                <AlertCircle size={18} className="mr-2"/> {orderSaveError}
                            </div>
                        )}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
                                    <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest border-b pb-2">Zákazník & Termín</h3>
                                    <div><label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Jméno</label><input type="text" className="w-full border rounded p-2 text-sm" value={editingOrder.userName} onChange={e => setEditingOrder({...editingOrder, userName: e.target.value})}/></div>
                                    <div>
                                        <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('common.date')}</label>
                                        <CustomCalendar 
                                            cart={editingOrder.items}
                                            checkAvailability={checkAvailability}
                                            onSelect={(date) => setEditingOrder({ ...editingOrder, deliveryDate: date })}
                                            selectedDate={editingOrder.deliveryDate}
                                            region={derivedRegion}
                                            getRegionInfo={getRegionInfoForDate}
                                            pickupLocation={derivedPickupLocation}
                                            getPickupInfo={getPickupPointInfo}
                                            excludeOrderId={editingOrder.id}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        <div><label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('checkout.delivery')}</label><select className="w-full border rounded p-2 text-sm" value={editingOrder.deliveryType} onChange={e => setEditingOrder({...editingOrder, deliveryType: e.target.value as DeliveryType})}><option value={DeliveryType.PICKUP}>{t('checkout.pickup')}</option><option value={DeliveryType.DELIVERY}>{t('admin.delivery')}</option></select></div>
                                    </div>

                                    {/* Pickup Selection */}
                                    {editingOrder.deliveryType === DeliveryType.PICKUP && (
                                        <div>
                                            <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Odběrné místo</label>
                                            <select 
                                                className="w-full border rounded p-2 text-sm" 
                                                value={editingOrder.pickupLocationId || ''} 
                                                onChange={e => {
                                                    const loc = settings.pickupLocations?.find(l => l.id === e.target.value);
                                                    setEditingOrder({...editingOrder, pickupLocationId: e.target.value});
                                                }}
                                            >
                                                <option value="">Vyberte místo...</option>
                                                {settings.pickupLocations?.filter(l => l.enabled).map(l => (
                                                    <option key={l.id} value={l.id}>{l.name} ({l.street})</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Delivery Address - MANUAL ONLY */}
                                    {editingOrder.deliveryType === DeliveryType.DELIVERY && (
                                        <div className="space-y-2 p-3 bg-white border rounded-lg">
                                            <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Doručovací adresa</div>
                                            <input placeholder="Jméno / Firma" className="w-full border rounded p-2 text-xs" value={editingOrder.deliveryName || ''} onChange={e => setEditingOrder({...editingOrder, deliveryName: e.target.value})} />
                                            <input placeholder="Ulice a č.p." className="w-full border rounded p-2 text-xs" value={editingOrder.deliveryStreet || ''} onChange={e => setEditingOrder({...editingOrder, deliveryStreet: e.target.value})} />
                                            <div className="grid grid-cols-2 gap-2">
                                                <input placeholder="Město" className="border rounded p-2 text-xs" value={editingOrder.deliveryCity || ''} onChange={e => setEditingOrder({...editingOrder, deliveryCity: e.target.value})} />
                                                <input placeholder="PSČ" className="border rounded p-2 text-xs" value={editingOrder.deliveryZip || ''} onChange={e => setEditingOrder({...editingOrder, deliveryZip: e.target.value})} />
                                            </div>
                                            <input placeholder="Telefon (+420...)" className="w-full border rounded p-2 text-xs" value={editingOrder.deliveryPhone || ''} onChange={e => setEditingOrder({...editingOrder, deliveryPhone: e.target.value})} />
                                        </div>
                                    )}

                                    {/* Billing Address - MANUAL ONLY - Selector Removed */}
                                    <div className="border-t pt-2 mt-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[9px] font-bold text-gray-400 uppercase">Fakturační adresa</label>
                                            {targetUser && (
                                                <div className="flex gap-2">
                                                    <button onClick={() => openAddressModal('create', 'billing')} className="text-[9px] font-bold text-green-600 hover:underline">+ Nová</button>
                                                </div>
                                            )}
                                        </div>
                                        {/* Billing Fields */}
                                        <div className="space-y-2 p-3 bg-white border rounded-lg">
                                            <input placeholder="Jméno / Firma" className="w-full border rounded p-2 text-xs" value={editingOrder.billingName || ''} onChange={e => setEditingOrder({...editingOrder, billingName: e.target.value})} />
                                            <input placeholder="Ulice a č.p." className="w-full border rounded p-2 text-xs" value={editingOrder.billingStreet || ''} onChange={e => setEditingOrder({...editingOrder, billingStreet: e.target.value})} />
                                            <div className="grid grid-cols-2 gap-2">
                                                <input placeholder="Město" className="border rounded p-2 text-xs" value={editingOrder.billingCity || ''} onChange={e => setEditingOrder({...editingOrder, billingCity: e.target.value})} />
                                                <input placeholder="PSČ" className="border rounded p-2 text-xs" value={editingOrder.billingZip || ''} onChange={e => setEditingOrder({...editingOrder, billingZip: e.target.value})} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input placeholder="IČ" className="border rounded p-2 text-xs" value={editingOrder.billingIc || ''} onChange={e => setEditingOrder({...editingOrder, billingIc: e.target.value})} />
                                                <input placeholder="DIČ" className="border rounded p-2 text-xs" value={editingOrder.billingDic || ''} onChange={e => setEditingOrder({...editingOrder, billingDic: e.target.value})} />
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
                                    <table className="min-w-full divide-y">
                                        <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                                            <tr><th className="px-3 py-2 text-left">Název</th><th className="px-3 py-2 text-center">Ks</th><th className="px-3 py-2 text-right">Cena</th><th className="px-3 py-2"></th></tr>
                                        </thead>
                                        <tbody className="divide-y text-xs">
                                            {editingOrder.items.map(item => (
                                                <tr key={item.id}>
                                                    <td className="px-3 py-2 font-bold">{item.name}</td>
                                                    <td className="px-3 py-2 text-center"><div className="flex items-center justify-center space-x-1"><button onClick={() => handleEditItemQuantity(item.id, -1)} className="p-1 hover:bg-gray-100 rounded"><Minus size={10}/></button><span className="w-6 text-center font-bold">{item.quantity}</span><button onClick={() => handleEditItemQuantity(item.id, 1)} className="p-1 hover:bg-gray-100 rounded"><Plus size={10}/></button></div></td>
                                                    <td className="px-3 py-2 text-right font-mono">{item.price * item.quantity}</td>
                                                    <td className="px-3 py-2 text-right"><button onClick={() => handleEditItemQuantity(item.id, -item.quantity)} className="text-red-400"><Trash2 size={12}/></button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <button onClick={() => setIsAddProductModalOpen(true)} className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-600 border-t">+ Přidat produkt</button>
                                </div>
                                
                                <div className="bg-gray-50 p-4 rounded-2xl space-y-2">
                                    {/* Discount Input */}
                                    <div className="flex gap-2 mb-3">
                                        <input 
                                            type="text" 
                                            placeholder="Kód slevy" 
                                            className="flex-1 border rounded p-2 text-xs uppercase"
                                            value={discountInput}
                                            onChange={e => setDiscountInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleApplyDiscount()}
                                        />
                                        <button 
                                            onClick={handleApplyDiscount} 
                                            className="bg-accent text-white px-3 py-1 rounded text-xs font-bold hover:bg-black transition"
                                        >
                                            <Plus size={14}/>
                                        </button>
                                    </div>
                                    {discountError && <p className="text-[10px] text-red-500 font-bold mb-2">{discountError}</p>}

                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>Zboží:</span>
                                        <span>{editingOrder.totalPrice} Kč</span>
                                    </div>
                                    {editingOrder.appliedDiscounts?.map(d => (
                                        <div key={d.code} className="flex justify-between items-center text-xs text-green-600">
                                            <span>Sleva ({d.code}):</span>
                                            <div className="flex items-center gap-2">
                                                <span>-{d.amount} Kč</span>
                                                <button onClick={() => handleRemoveDiscount(d.code)} className="text-red-400 hover:text-red-600"><X size={12}/></button>
                                            </div>
                                        </div>
                                    ))}
                                    {editingOrder.packagingFee > 0 && (
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>Balné:</span>
                                            <span>{editingOrder.packagingFee} Kč</span>
                                        </div>
                                    )}
                                    {editingOrder.deliveryFee > 0 && (
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>Doprava:</span>
                                            <span>{editingOrder.deliveryFee} Kč</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-2">
                                        <span className="font-bold text-sm">CELKEM:</span>
                                        <span className="font-bold text-lg text-accent">{Math.max(0, editingOrder.totalPrice - (editingOrder.appliedDiscounts?.reduce((sum, d) => sum + d.amount, 0) || 0) + editingOrder.packagingFee + (editingOrder.deliveryFee || 0))} Kč</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 border-t flex gap-4"><button onClick={() => setIsOrderModalOpen(false)} className="flex-1 py-3 bg-white border rounded-xl font-bold text-sm uppercase transition">{t('admin.cancel')}</button><button onClick={handleOrderSave} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm uppercase shadow-lg transition">{t('admin.save_changes')}</button></div>
                </div>
                </div>
            )}

            {/* Address Modal (Admin creating/editing for user) */}
            {isAddressModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[250] p-4">
                    <form onSubmit={handleAddressModalSave} className="bg-white p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold">{addressModalMode === 'create' ? 'Nová adresa zákazníka' : 'Upravit adresu zákazníka'}</h3>
                        
                        {addressError && (
                            <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-xs font-bold flex items-center">
                                <AlertCircle size={16} className="mr-2 flex-shrink-0"/> {addressError}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Jméno / Firma</label>
                            <input className="w-full border rounded p-2 text-sm" value={addressForm.name || ''} onChange={e => setAddressForm({...addressForm, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ulice a č.p.</label>
                            <input className="w-full border rounded p-2 text-sm" value={addressForm.street || ''} onChange={e => setAddressForm({...addressForm, street: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Město</label>
                                <input className="w-full border rounded p-2 text-sm" value={addressForm.city || ''} onChange={e => setAddressForm({...addressForm, city: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">PSČ</label>
                                <input className="w-full border rounded p-2 text-sm" value={addressForm.zip || ''} onChange={e => setAddressForm({...addressForm, zip: e.target.value})} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefon</label>
                            <input className="w-full border rounded p-2 text-sm" value={addressForm.phone || ''} onChange={e => setAddressForm({...addressForm, phone: e.target.value})} />
                        </div>
                        
                        {addressModalType === 'billing' && (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">IČ</label>
                                    <input className="w-full border rounded p-2 text-sm" value={addressForm.ic || ''} onChange={e => setAddressForm({...addressForm, ic: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">DIČ</label>
                                    <input className="w-full border rounded p-2 text-sm" value={addressForm.dic || ''} onChange={e => setAddressForm({...addressForm, dic: e.target.value})} />
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-4">
                            <button type="button" onClick={() => setIsAddressModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded text-sm font-bold">Zrušit</button>
                            <button type="submit" className="flex-1 py-2 bg-primary text-white rounded text-sm font-bold">Uložit</button>
                        </div>
                    </form>
                </div>
            )}

            {/* ADD PRODUCT MODAL ... (kept same) */}
            {isAddProductModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[250] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center"><h3 className="font-bold text-lg">{t('common.add_item')}</h3><button onClick={() => setIsAddProductModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20}/></button></div>
                        <div className="relative"><Search size={16} className="absolute left-3 top-3 text-gray-400"/><input className="w-full border rounded-lg pl-9 p-2 text-sm" placeholder="Hledat produkt..." value={productSearch} onChange={e => setProductSearch(e.target.value)} autoFocus/></div>
                        <div className="overflow-y-auto divide-y flex-grow">
                            {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                                <div key={p.id} className="flex justify-between items-center py-2 hover:bg-gray-50 px-2 rounded">
                                    <div className="flex items-center gap-3">{p.images && p.images[0] ? <img src={p.images[0]} alt={p.name} className="w-10 h-10 rounded object-cover"/> : <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center"><ImageIcon size={16} className="text-gray-300"/></div>}<div><span className="font-bold text-sm block">{p.name}</span><span className="text-xs text-gray-400">{p.price} Kč / {p.unit}</span></div></div>
                                    <button onClick={() => { handleAddProductToOrder(p); setIsAddProductModalOpen(false); }} className="bg-accent text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-yellow-600 transition">Přidat</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
