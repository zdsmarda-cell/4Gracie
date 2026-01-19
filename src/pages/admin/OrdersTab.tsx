
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus, DeliveryType, Language, PaymentMethod } from '../../types';
import { Pagination } from '../../components/Pagination';
import { MultiSelect } from '../../components/MultiSelect';
import { FileText, Check, X, Filter, QrCode, FileCheck, Edit, Save, ImageIcon, Minus, Plus, AlertCircle, ArrowUp, ArrowDown, ArrowUpDown, Zap } from 'lucide-react';
import { CustomCalendar } from '../../components/CustomCalendar';

interface OrdersTabProps {
    initialDate?: string | null;
    initialEventOnly?: boolean;
    initialActiveOnly?: boolean;
    onClearFilters?: () => void;
}

const StatusConfirmModal: React.FC<{
    isOpen: boolean;
    count: number;
    status: OrderStatus;
    onConfirm: () => void;
    onClose: () => void;
    t: (key: string) => string;
}> = ({ isOpen, count, status, onConfirm, onClose, t }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                <h3 className="text-lg font-bold mb-4 text-center">Změna stavu objednávek</h3>
                <p className="text-sm text-gray-600 mb-6 text-center">
                    Opravdu chcete změnit stav <strong>{count}</strong> objednávek na <strong>{t(`status.${status}`)}</strong>?
                </p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2 bg-gray-100 rounded-lg font-bold text-sm">Zrušit</button>
                    <button onClick={onConfirm} className="flex-1 py-2 bg-primary text-white rounded-lg font-bold text-sm">Potvrdit</button>
                </div>
            </div>
        </div>
    );
};

const InvoiceSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: 'proforma' | 'final') => void;
}> = ({ isOpen, onClose, onSelect }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full"><X size={18}/></button>
                <h3 className="text-lg font-bold mb-2 text-center">Výběr dokladu</h3>
                <p className="text-sm text-gray-500 mb-6 text-center">Tato objednávka je již doručena. Který doklad chcete vygenerovat?</p>
                
                <div className="space-y-3">
                    <button 
                        onClick={() => onSelect('final')} 
                        className="w-full flex items-center justify-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition group"
                    >
                        <div className="bg-green-500 text-white p-2 rounded-full group-hover:scale-110 transition"><FileCheck size={20}/></div>
                        <div className="text-left">
                            <span className="block font-bold text-green-800">Daňový doklad</span>
                            <span className="block text-[10px] text-green-600 uppercase font-bold">Finální faktura</span>
                        </div>
                    </button>

                    <button 
                        onClick={() => onSelect('proforma')} 
                        className="w-full flex items-center justify-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition group"
                    >
                        <div className="bg-gray-400 text-white p-2 rounded-full group-hover:scale-110 transition"><FileText size={20}/></div>
                        <div className="text-left">
                            <span className="block font-bold text-gray-800">Zálohová faktura</span>
                            <span className="block text-[10px] text-gray-500 uppercase font-bold">Proforma</span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export const OrdersTab: React.FC<OrdersTabProps> = ({ initialDate, initialEventOnly, initialActiveOnly, onClearFilters }) => {
    const { searchOrders, t, updateOrderStatus, formatDate, settings, generateCzIban, removeDiacritics, printInvoice, updateOrder, getImageUrl, products, checkAvailability, getDeliveryRegion, getRegionInfoForDate, getPickupPointInfo, calculatePackagingFee, validateDiscount, orders, dataSource } = useStore();
    
    const [displayOrders, setDisplayOrders] = useState<Order[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [totalPages, setTotalPages] = useState(1);

    const [onlyActive, setOnlyActive] = useState(initialActiveOnly || false);

    // Filters
    const [filters, setFilters] = useState({
        id: '',
        dateFrom: initialDate || '',
        dateTo: initialDate || '',
        createdFrom: '',
        createdTo: '',
        status: '', 
        customer: '',
        isEvent: initialEventOnly ? 'yes' : 'all', 
        isPaid: 'all',
        hasIc: 'all'
    });

    // Sorting State: key + direction
    const [sort, setSort] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const [notifyCustomer, setNotifyCustomer] = useState(false);
    const [sendPush, setSendPush] = useState(false); 
    const [qrModalOrder, setQrModalOrder] = useState<Order | null>(null);
    const [invoiceModalOrder, setInvoiceModalOrder] = useState<Order | null>(null);
    const [confirmStatus, setConfirmStatus] = useState<{ isOpen: boolean, status: OrderStatus | null }>({ isOpen: false, status: null });

    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
    const [orderSaveError, setOrderSaveError] = useState<string | null>(null);
    const [productSearch, setProductSearch] = useState('');
    const [discountInput, setDiscountInput] = useState(''); 
    const [discountError, setDiscountError] = useState<string | null>(null);

    const derivedRegion = useMemo(() => {
        if (!editingOrder || editingOrder.deliveryType !== DeliveryType.DELIVERY) return undefined;
        return editingOrder.deliveryZip ? getDeliveryRegion(editingOrder.deliveryZip) : undefined;
    }, [editingOrder?.deliveryType, editingOrder?.deliveryZip, getDeliveryRegion]);
  
    const derivedPickupLocation = useMemo(() => {
        if (!editingOrder || editingOrder.deliveryType !== DeliveryType.PICKUP || !editingOrder.pickupLocationId) return undefined;
        return settings.pickupLocations?.find(l => l.id === editingOrder.pickupLocationId);
    }, [editingOrder?.pickupLocationId, editingOrder?.deliveryType, settings.pickupLocations]);

    useEffect(() => {
        if (initialDate || initialEventOnly || initialActiveOnly !== undefined) {
            setFilters(prev => ({
                ...prev,
                dateFrom: initialDate || prev.dateFrom,
                dateTo: initialDate || prev.dateTo,
                isEvent: initialEventOnly ? 'yes' : prev.isEvent
            }));
            if (initialActiveOnly !== undefined) {
                setOnlyActive(initialActiveOnly);
            }
            setCurrentPage(1);
        }
    }, [initialDate, initialEventOnly, initialActiveOnly]);

    const loadData = useCallback(async () => {
        setIsLoadingOrders(true);
        try {
            // Determine statuses to fetch
            const activeStatuses = [OrderStatus.CREATED, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.ON_WAY].join(',');
            const statusFilter = onlyActive ? activeStatuses : filters.status;

            const res = await searchOrders({
                page: currentPage,
                limit: limit,
                sort: sort?.key,
                order: sort?.direction,
                ...filters,
                status: statusFilter
            });
            setDisplayOrders(res.orders);
            setTotalRecords(res.total);
            setTotalPages(res.pages);
        } catch (error) {
            console.error("LoadData Error:", error);
        } finally {
            setIsLoadingOrders(false);
        }
    }, [currentPage, limit, filters, sort, searchOrders, onlyActive]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    };

    // 3-state sort handler
    const handleSort = (key: string) => {
        setSort(prev => {
            if (prev?.key === key) {
                // If currently DESC, switch to ASC
                if (prev.direction === 'desc') return { key, direction: 'asc' };
                // If currently ASC, remove sort
                return null; 
            }
            // Default first click: DESC
            return { key, direction: 'desc' };
        });
        setCurrentPage(1);
    };

    const getSortIcon = (key: string) => {
        if (sort?.key !== key) return <ArrowUpDown size={14} className="text-gray-300 ml-1 inline" />;
        return sort.direction === 'asc' 
            ? <ArrowUp size={14} className="text-primary ml-1 inline" />
            : <ArrowDown size={14} className="text-primary ml-1 inline" />;
    };

    const handleBulkStatusChangeRequest = (status: OrderStatus) => {
        if (!status || selectedOrders.length === 0) return;
        setConfirmStatus({ isOpen: true, status });
    };

    const confirmBulkStatusChange = async () => {
        if (confirmStatus.status) {
            await updateOrderStatus(selectedOrders, confirmStatus.status, notifyCustomer, sendPush);
            setSelectedOrders([]);
            loadData();
        }
        setConfirmStatus({ isOpen: false, status: null });
    };

    const handleInvoiceClick = (order: Order) => {
        if (order.status === OrderStatus.DELIVERED) {
            setInvoiceModalOrder(order);
        } else {
            printInvoice(order, 'proforma');
        }
    };

    const exportToAccounting = () => { 
        // 1. Determine which orders to export
        let dataToExport = displayOrders;
        
        if (selectedOrders.length > 0) {
            // Priority: Selected orders
            // Try to find them in displayOrders first (fastest)
            // If not found (e.g. cross-page selection if implemented later), fall back to global 'orders' cache
            // Note: 'orders' from context might contain more history or be used as cache.
            dataToExport = selectedOrders.map(id => 
                displayOrders.find(o => o.id === id) || orders.find(o => o.id === id)
            ).filter(Boolean) as Order[];
        }

        if (dataToExport.length === 0) {
            alert("Žádná data k exportu.");
            return;
        }

        // 2. Prepare Headers
        const headers = ["ID", "Vytvořeno", "Datum dodání", "Zákazník", "Cena celkem (s DPH)", "Stav", "Zaplaceno", "Poznámka", "Doprava (Typ)", "Telefon"];
        
        // 3. Prepare Rows
        const rows = dataToExport.map(o => {
            const total = o.totalPrice + o.packagingFee + (o.deliveryFee || 0);
            
            // Safe string handling for CSV (escape quotes)
            const safeName = (o.userName || o.deliveryName || '').replace(/"/g, '""');
            const safeNote = (o.note || '').replace(/"/g, '""');
            const created = o.createdAt ? new Date(o.createdAt).toLocaleDateString('cs-CZ') : '';
            const delivDate = formatDate(o.deliveryDate);
            const status = t(`status.${o.status}`);
            const paid = o.isPaid ? 'ANO' : 'NE';
            const deliveryType = o.deliveryType === 'delivery' ? 'Rozvoz' : 'Osobní odběr';
            const phone = (o.deliveryPhone || '').replace(/"/g, '""');

            return `"${o.id}","${created}","${delivDate}","${safeName}",${total},"${status}","${paid}","${safeNote}","${deliveryType}","${phone}"`;
        });

        // 4. Construct CSV Content with BOM for Excel compatibility
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
            + headers.join(",") + "\n"
            + rows.join("\n");

        // 5. Trigger Download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `export_objednavek_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

    const statusOptions = Object.values(OrderStatus).map(s => ({ value: s, label: t(`status.${s}`) }));

    const openEditModal = (order: Order) => {
        setEditingOrder(JSON.parse(JSON.stringify(order))); 
        setOrderSaveError(null);
        setDiscountInput(''); 
        setDiscountError(null);
        setIsEditModalOpen(true);
    };

    const recalculateOrderTotals = (items: any[], discounts: any[]) => {
        if (!editingOrder) return;
        let validDiscounts: any[] = [];
        for(const d of discounts) {
             const res = validateDiscount(d.code, items);
             if(res.success && res.amount !== undefined) validDiscounts.push({ code: d.code, amount: res.amount });
        }
        const itemsTotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
        const packagingFee = calculatePackagingFee(items);
        let deliveryFee = editingOrder.deliveryFee;
        if (editingOrder.deliveryType === DeliveryType.DELIVERY && derivedRegion) {
             const totalForFreeLimit = itemsTotal - validDiscounts.reduce((acc, d) => acc + d.amount, 0);
             deliveryFee = totalForFreeLimit >= derivedRegion.freeFrom ? 0 : derivedRegion.price;
        } else if (editingOrder.deliveryType === DeliveryType.PICKUP) {
             deliveryFee = 0;
        }
        setEditingOrder({ ...editingOrder, items, appliedDiscounts: validDiscounts, totalPrice: itemsTotal, packagingFee, deliveryFee });
    };

    const handleEditOrderQuantity = (itemId: string, delta: number) => {
        if (!editingOrder) return;
        const updatedItems = editingOrder.items.map(i => {
          if (i.id === itemId) return { ...i, quantity: Math.max(0, i.quantity + delta) };
          return i;
        }).filter(i => i.quantity > 0);
        recalculateOrderTotals(updatedItems, editingOrder.appliedDiscounts || []);
    };

    const handleAddProductToOrder = (p: any) => {
        if (!editingOrder) return;
        const existing = editingOrder.items.find(i => i.id === p.id);
        let updatedItems;
        if (existing) { updatedItems = editingOrder.items.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i); } 
        else { updatedItems = [...editingOrder.items, { ...p, quantity: 1 }]; }
        recalculateOrderTotals(updatedItems, editingOrder.appliedDiscounts || []);
    };

    const handleAddEditDiscount = () => {
        if (!editingOrder || !discountInput) return;
        setDiscountError(null);
        if (editingOrder.appliedDiscounts?.some(d => d.code.toUpperCase() === discountInput.toUpperCase())) { setDiscountError('Tento kód je již použit.'); return; }
        const res = validateDiscount(discountInput, editingOrder.items);
        if (res.success && res.amount !== undefined) {
            const newDiscounts = [...(editingOrder.appliedDiscounts || []), { code: res.discount!.code, amount: res.amount }];
            recalculateOrderTotals(editingOrder.items, newDiscounts);
            setDiscountInput('');
        } else { setDiscountError(res.error || 'Neplatný kód'); }
    };

    const handleRemoveEditDiscount = (code: string) => {
        if (!editingOrder) return;
        const newDiscounts = (editingOrder.appliedDiscounts || []).filter(d => d.code !== code);
        recalculateOrderTotals(editingOrder.items, newDiscounts);
    };

    const handleSaveOrder = async () => {
        if(!editingOrder) return;
        setOrderSaveError(null);

        // 1. Validate Delivery
        if (editingOrder.deliveryType === DeliveryType.PICKUP) {
            if (!editingOrder.pickupLocationId) {
                setOrderSaveError('Vyberte odběrné místo.');
                return;
            }
            const loc = settings.pickupLocations?.find(l => l.id === editingOrder.pickupLocationId);
            if (!loc) {
                setOrderSaveError('Neplatné odběrné místo.');
                return;
            }
            const info = getPickupPointInfo(loc, editingOrder.deliveryDate);
            if (!info.isOpen) {
                setOrderSaveError(`Odběrné místo má ${formatDate(editingOrder.deliveryDate)} zavřeno.`);
                return;
            }
            // Populate pickup address info
            editingOrder.deliveryName = loc.name;
            editingOrder.deliveryStreet = loc.street;
            editingOrder.deliveryCity = loc.city;
            editingOrder.deliveryZip = loc.zip;
            editingOrder.deliveryAddress = `Osobní odběr: ${loc.name}, ${loc.street}, ${loc.city}`;

        } else {
            // Delivery Validation
            if (!editingOrder.deliveryName || editingOrder.deliveryName.length < 3) { setOrderSaveError(t('validation.name_length')); return; }
            if (!editingOrder.deliveryStreet) { setOrderSaveError(t('validation.street_required')); return; }
            if (!editingOrder.deliveryCity) { setOrderSaveError(t('validation.city_required')); return; }
            if (!editingOrder.deliveryZip || !/^\d{5}$/.test(editingOrder.deliveryZip.replace(/\s/g, ''))) { setOrderSaveError(t('validation.zip_format')); return; }
            
            const region = getDeliveryRegion(editingOrder.deliveryZip);
            if (!region) {
                setOrderSaveError(`Pro PSČ ${editingOrder.deliveryZip} neexistuje rozvozový region.`);
                return;
            }
            const info = getRegionInfoForDate(region, editingOrder.deliveryDate);
            if (!info.isOpen) {
                setOrderSaveError(`Region "${region.name}" nerozváží dne ${formatDate(editingOrder.deliveryDate)}.`);
                return;
            }
        }

        // 2. Check Capacity (Allow admin to bypass? No, strict per instruction)
        const availability = checkAvailability(editingOrder.deliveryDate, editingOrder.items, editingOrder.id);
        if (!availability.allowed && availability.status !== 'available') {
             setOrderSaveError(availability.reason || 'Vybraný termín není dostupný.');
             return;
        }

        const finalOrder = { ...editingOrder }; 
        const success = await updateOrder(finalOrder, true, true); 
        if (success) { setIsEditModalOpen(false); loadData(); } 
        else { setOrderSaveError('Chyba při ukládání.'); }
    };

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between mb-4">
                <button onClick={exportToAccounting} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow-sm">
                    <FileText size={16} className="mr-2 text-green-600" /> {t('admin.export')}
                </button>
                {selectedOrders.length > 0 && (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-accent/10 px-3 py-1 rounded-lg border border-accent/20">
                            <span className="text-[10px] font-bold text-primary mr-3">{t('admin.orders')}: {selectedOrders.length}</span>
                            <select className="text-[10px] border rounded bg-white p-1 mr-2" onChange={e => handleBulkStatusChangeRequest(e.target.value as OrderStatus)}>
                                <option value="">{t('admin.status_update')}...</option>
                                {Object.values(OrderStatus).map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
                            </select>
                        </div>
                        <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer select-none bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">
                            <input type="checkbox" checked={notifyCustomer} onChange={e => setNotifyCustomer(e.target.checked)} className="rounded text-accent" />
                            <span>{t('admin.notify_customer')}</span>
                        </label>
                        <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer select-none bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">
                            <input type="checkbox" checked={sendPush} onChange={e => setSendPush(e.target.checked)} className="rounded text-accent" />
                            <span>Push Notifikace</span>
                        </label>
                    </div>
                )}
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border shadow-sm grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                <div><label className="text-xs font-bold text-gray-400 block mb-1">ID</label><input type="text" className="w-full border rounded p-2 text-xs" placeholder="Filtr ID" value={filters.id} onChange={e => handleFilterChange('id', e.target.value)} /></div>
                <div><label className="text-xs font-bold text-gray-400 block mb-1">Dodání Od</label><input type="date" className="w-full border rounded p-2 text-xs" value={filters.dateFrom} onChange={e => handleFilterChange('dateFrom', e.target.value)} /></div>
                <div><label className="text-xs font-bold text-gray-400 block mb-1">Dodání Do</label><input type="date" className="w-full border rounded p-2 text-xs" value={filters.dateTo} onChange={e => handleFilterChange('dateTo', e.target.value)} /></div>
                <div><label className="text-xs font-bold text-gray-400 block mb-1">Vytvořeno Od</label><input type="date" className="w-full border rounded p-2 text-xs" value={filters.createdFrom} onChange={e => handleFilterChange('createdFrom', e.target.value)} /></div>
                <div><label className="text-xs font-bold text-gray-400 block mb-1">Vytvořeno Do</label><input type="date" className="w-full border rounded p-2 text-xs" value={filters.createdTo} onChange={e => handleFilterChange('createdTo', e.target.value)} /></div>
                <div><label className="text-xs font-bold text-gray-400 block mb-1">Zákazník</label><input type="text" className="w-full border rounded p-2 text-xs" placeholder="Jméno" value={filters.customer} onChange={e => handleFilterChange('customer', e.target.value)} /></div>
                
                {/* Status or Active Toggle */}
                {onlyActive ? (
                    <div className="md:col-span-2 flex items-center h-full pt-4">
                        <div className="w-full bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center">
                            <Zap size={14} className="mr-2"/> Zobrazeny pouze aktivní objednávky (kapacita)
                        </div>
                    </div>
                ) : (
                    <div className="md:col-span-2">
                        <MultiSelect 
                            label="Stav"
                            options={statusOptions}
                            selectedValues={filters.status ? filters.status.split(',') : []}
                            onChange={(values) => handleFilterChange('status', values.join(','))}
                        />
                    </div>
                )}

                {/* IC Filter */}
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Typ zákazníka</label>
                    <select 
                        className="w-full border rounded p-2 text-xs"
                        value={filters.hasIc}
                        onChange={e => handleFilterChange('hasIc', e.target.value)}
                    >
                        <option value="all">Vše</option>
                        <option value="yes">Firemní (s IČ)</option>
                        <option value="no">Koncový (bez IČ)</option>
                    </select>
                </div>
                
                {/* Active Only Toggle & Clear */}
                <div className="flex flex-col justify-end gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-600 hover:text-primary">
                        <input 
                            type="checkbox" 
                            checked={onlyActive} 
                            onChange={e => {
                                setOnlyActive(e.target.checked);
                                setCurrentPage(1);
                            }}
                            className="rounded text-accent focus:ring-accent"
                        />
                        Jen aktivní (Kapacita)
                    </label>
                    
                    <button onClick={() => {
                        setFilters({ id: '', dateFrom: '', dateTo: '', createdFrom: '', createdTo: '', status: '', customer: '', isEvent: 'all', isPaid: 'all', hasIc: 'all' });
                        setOnlyActive(false);
                        setCurrentPage(1);
                        setSort(null);
                        if(onClearFilters) onClearFilters();
                    }} className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center mb-1">
                        <X size={14} className="mr-1"/> Zrušit filtry
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <tr>
                            <th className="px-6 py-4 text-center"><input type="checkbox" onChange={e => setSelectedOrders(e.target.checked ? displayOrders.map(o => o.id) : [])} checked={selectedOrders.length === displayOrders.length && displayOrders.length > 0} /></th>
                            
                            <th className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort('id')}>
                                {t('filter.id')} {getSortIcon('id')}
                            </th>
                            
                            <th className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort('created')}>
                                Vytvořeno {getSortIcon('created')}
                            </th>

                            <th className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort('deliveryDate')}>
                                {t('common.date')} {getSortIcon('deliveryDate')}
                            </th>
                            
                            <th className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort('customer')}>
                                {t('filter.customer')} {getSortIcon('customer')}
                            </th>
                            
                            {/* IC Column Added */}
                            <th className="px-6 py-4 text-left">
                                Firma / IČ
                            </th>

                            <th className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort('price')}>
                                {t('common.price')} (Kč) {getSortIcon('price')}
                            </th>
                            
                            <th className="px-6 py-4 text-left">{t('filter.payment')}</th>
                            
                            <th className="px-6 py-4 text-left cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status')}>
                                {t('filter.status')} {getSortIcon('status')}
                            </th>
                            
                            <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-[11px]">
                        {isLoadingOrders ? (
                            <tr><td colSpan={10} className="p-8 text-center text-gray-400">Načítám data...</td></tr>
                        ) : (
                            displayOrders.map(order => (
                                <tr key={order.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4 text-center"><input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => setSelectedOrders(prev => prev.includes(order.id) ? prev.filter(x => x !== order.id) : [...prev, order.id])} /></td>
                                    <td className="px-6 py-4 font-bold">{order.id}</td>
                                    <td className="px-6 py-4 text-gray-500">{new Date(order.createdAt).toLocaleDateString('cs-CZ')}</td>
                                    <td className="px-6 py-4 font-mono">{formatDate(order.deliveryDate)}</td>
                                    <td className="px-6 py-4">{order.userName}</td>
                                    
                                    {/* IC Column Data */}
                                    <td className="px-6 py-4">
                                        {order.billingIc ? (
                                            <div>
                                                <div className="font-bold text-xs">{order.billingName}</div>
                                                <div className="text-[10px] text-gray-500">IČ: {order.billingIc}</div>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 font-bold">{order.totalPrice + order.packagingFee + (order.deliveryFee || 0)} Kč</td>
                                    <td className="px-6 py-4">{order.isPaid ? <span className="text-green-600 font-bold">{t('common.paid')}</span> : <span className="text-red-600 font-bold">{t('common.unpaid')}</span>}</td>
                                    <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${order.status === OrderStatus.CANCELLED ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>{t(`status.${order.status}`)}</span></td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 items-center">
                                            <button onClick={() => setQrModalOrder(order)} className="p-1 text-gray-400 hover:text-accent hover:bg-gray-100 rounded transition" title="QR Platba"><QrCode size={16}/></button>
                                            <button onClick={() => handleInvoiceClick(order)} className={`p-1 hover:bg-gray-100 rounded transition ${order.status === OrderStatus.DELIVERED ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-primary'}`} title={order.status === OrderStatus.DELIVERED ? "Faktura" : "Zálohová faktura"}>{order.status === OrderStatus.DELIVERED ? <FileCheck size={16}/> : <FileText size={16}/>}</button>
                                            <button onClick={() => openEditModal(order)} className="text-blue-600 font-bold hover:underline p-1 flex items-center" title="Upravit objednávku"><Edit size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                        {!isLoadingOrders && displayOrders.length === 0 && (
                            <tr><td colSpan={10} className="p-8 text-center text-gray-400">Žádné objednávky</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} limit={limit} onLimitChange={(l) => { setLimit(l); setCurrentPage(1); }} totalItems={totalRecords} />

            {/* QR Modal */}
            {qrModalOrder && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[250] p-4 backdrop-blur-sm animate-in zoom-in-95 duration-200" onClick={() => setQrModalOrder(null)}>
                <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl relative" onClick={e => e.stopPropagation()}>
                    <button className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200" onClick={() => setQrModalOrder(null)}><X size={20}/></button>
                    <div className="text-center">
                    <h2 className="text-2xl font-bold mb-6">QR Platba</h2>
                    <div className="bg-white p-2 rounded-xl border inline-block mb-6 shadow-sm">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(getQRDataString(qrModalOrder))}`} alt="QR Code" className="w-48 h-48"/>
                    </div>
                    {/* Added Text Details */}
                    <div className="text-left bg-gray-50 p-4 rounded-xl space-y-2 text-sm mt-4">
                        <div className="flex justify-between border-b pb-2">
                            <span className="text-gray-500">Účet</span>
                            <span className="font-bold">{settings.companyDetails.bankAccount}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                            <span className="text-gray-500">VS</span>
                            <span className="font-bold">{qrModalOrder.id.replace(/\D/g, '') || '0'}</span>
                        </div>
                        <div className="flex justify-between pt-1">
                            <span className="text-gray-500">Částka</span>
                            <span className="font-bold text-lg text-primary">
                                {(Math.max(0, qrModalOrder.totalPrice - (qrModalOrder.appliedDiscounts?.reduce((acc, d) => acc + d.amount, 0) || 0)) + qrModalOrder.packagingFee + (qrModalOrder.deliveryFee||0)).toFixed(2)} Kč
                            </span>
                        </div>
                    </div>
                    </div>
                </div>
                </div>
            )}

            <StatusConfirmModal isOpen={confirmStatus.isOpen} count={selectedOrders.length} status={confirmStatus.status!} onConfirm={confirmBulkStatusChange} onClose={() => setConfirmStatus({ isOpen: false, status: null })} t={t}/>
            <InvoiceSelectionModal isOpen={!!invoiceModalOrder} onClose={() => setInvoiceModalOrder(null)} onSelect={(type) => { if (invoiceModalOrder) { printInvoice(invoiceModalOrder, type); setInvoiceModalOrder(null); }}} />

            {/* RESTORED EDIT MODAL WITH 2 COLUMN LAYOUT */}
            {isEditModalOpen && editingOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-serif font-bold text-primary">Upravit objednávku #{editingOrder.id}</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={24}/></button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-8 flex-grow">
                             {/* Form Logic */}
                             {orderSaveError && (
                                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700 text-sm font-bold flex items-center">
                                    <AlertCircle size={18} className="mr-2"/> {orderSaveError}
                                </div>
                             )}
                             
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* LEFT COLUMN: Settings & Logistics */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest border-b pb-2">Nastavení</h3>
                                    <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('common.date')}</label>
                                                <input type="date" className="w-full border rounded p-2 text-sm" value={editingOrder.deliveryDate} onChange={e => setEditingOrder({...editingOrder, deliveryDate: e.target.value})}/>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('checkout.delivery')}</label>
                                                <select className="w-full border rounded p-2 text-sm" value={editingOrder.deliveryType} onChange={e => setEditingOrder({...editingOrder, deliveryType: e.target.value as DeliveryType})}>
                                                    <option value={DeliveryType.PICKUP}>{t('checkout.pickup')}</option>
                                                    <option value={DeliveryType.DELIVERY}>{t('admin.delivery')}</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* CALENDAR */}
                                        <div className="mt-2">
                                            <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Výběr termínu (Kontrola kapacity)</label>
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
                                        
                                        {/* Dynamic Address Fields */}
                                        {editingOrder.deliveryType === DeliveryType.DELIVERY && (
                                            <div className="space-y-2 p-3 bg-white border rounded-lg animate-in fade-in">
                                                <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Doručovací adresa</div>
                                                <input placeholder="Jméno / Firma" className="w-full border rounded p-2 text-xs" value={editingOrder.deliveryName || ''} onChange={e => setEditingOrder({...editingOrder, deliveryName: e.target.value})} />
                                                <input placeholder="Ulice a č.p." className="w-full border rounded p-2 text-xs" value={editingOrder.deliveryStreet || ''} onChange={e => setEditingOrder({...editingOrder, deliveryStreet: e.target.value})} />
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input placeholder="Město" className="border rounded p-2 text-xs" value={editingOrder.deliveryCity || ''} onChange={e => setEditingOrder({...editingOrder, deliveryCity: e.target.value})} />
                                                    <input placeholder="PSČ" className="border rounded p-2 text-xs" value={editingOrder.deliveryZip || ''} onChange={e => setEditingOrder({...editingOrder, deliveryZip: e.target.value})} />
                                                </div>
                                                <input placeholder="Telefon" className="w-full border rounded p-2 text-xs" value={editingOrder.deliveryPhone || ''} onChange={e => setEditingOrder({...editingOrder, deliveryPhone: e.target.value})} />
                                            </div>
                                        )}

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
                                        
                                        {/* Billing Address */}
                                        <div className="border-t pt-2 mt-2">
                                            <label className="text-[9px] font-bold text-gray-400 uppercase block mb-2">Fakturační adresa</label>
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

                                        <div>
                                            <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('checkout.payment')}</label>
                                            <select
                                                className="w-full border rounded p-2 text-sm"
                                                value={editingOrder.paymentMethod}
                                                onChange={e => setEditingOrder({...editingOrder, paymentMethod: e.target.value as PaymentMethod})}
                                            >
                                                {settings.paymentMethods.filter(pm => pm.enabled).map(pm => (
                                                    <option key={pm.id} value={pm.id}>{pm.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* RIGHT COLUMN: Items & Summary */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest border-b pb-2">Položky</h3>
                                    <div className="border rounded-2xl overflow-hidden shadow-sm">
                                      <table className="min-w-full divide-y">
                                        <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                                          <tr>
                                            <th className="px-3 py-2 text-left w-12">Foto</th>
                                            <th className="px-3 py-2 text-left">Název</th>
                                            <th className="px-3 py-2 text-center">Ks</th>
                                            <th className="px-3 py-2 text-right">Cena</th>
                                            <th className="px-3 py-2"></th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y text-xs">
                                          {editingOrder.items.map(item => (
                                            <tr key={item.id}>
                                              <td className="px-3 py-2">
                                                  {item.images && item.images[0] ? (
                                                      <img src={getImageUrl(item.images[0])} alt={item.name} className="w-8 h-8 rounded object-cover" />
                                                  ) : (
                                                      <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-300"><ImageIcon size={12}/></div>
                                                  )}
                                              </td>
                                              <td className="px-3 py-2 font-bold">{item.name}</td>
                                              <td className="px-3 py-2 text-center">
                                                <div className="flex items-center justify-center space-x-1">
                                                   <button onClick={() => handleEditOrderQuantity(item.id, -1)} className="p-1 hover:bg-gray-100 rounded"><Minus size={10}/></button>
                                                   <span className="w-4 text-center">{item.quantity}</span>
                                                   <button onClick={() => handleEditOrderQuantity(item.id, 1)} className="p-1 hover:bg-gray-100 rounded"><Plus size={10}/></button>
                                                </div>
                                              </td>
                                              <td className="px-3 py-2 text-right">{item.price * item.quantity}</td>
                                              <td className="px-3 py-2 text-right"><button onClick={() => handleEditOrderQuantity(item.id, -item.quantity)} className="text-red-400"><X size={12}/></button></td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      <button onClick={() => setIsAddProductModalOpen(true)} className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-600 border-t">+ Přidat produkt</button>
                                    </div>

                                    {/* Discount Input */}
                                    <div className="flex gap-2">
                                        <input 
                                            placeholder="Kód slevy" 
                                            className="border rounded p-2 text-xs flex-1 uppercase"
                                            value={discountInput}
                                            onChange={e => setDiscountInput(e.target.value)}
                                        />
                                        <button onClick={handleAddEditDiscount} className="bg-gray-100 text-gray-700 px-3 rounded font-bold text-xs hover:bg-gray-200">Použít</button>
                                    </div>
                                    {discountError && <p className="text-red-500 text-xs">{discountError}</p>}
                                    
                                    {/* Applied Discounts List */}
                                    {editingOrder.appliedDiscounts && editingOrder.appliedDiscounts.length > 0 && (
                                        <div className="space-y-1">
                                            {editingOrder.appliedDiscounts.map(d => (
                                                <div key={d.code} className="flex justify-between items-center text-xs bg-green-50 p-2 rounded text-green-700 border border-green-100">
                                                    <span className="font-bold">{d.code}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span>-{d.amount} Kč</span>
                                                        <button onClick={() => handleRemoveEditDiscount(d.code)} className="p-1 hover:bg-green-100 rounded-full"><X size={12}/></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {/* Summary */}
                                    <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>Zboží:</span>
                                            <span>{editingOrder.totalPrice} Kč</span>
                                        </div>
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
                                            <span className="font-bold text-lg text-accent">
                                                {Math.max(0, editingOrder.totalPrice - (editingOrder.appliedDiscounts?.reduce((a,b)=>a+b.amount,0)||0)) + editingOrder.packagingFee + (editingOrder.deliveryFee || 0)} Kč
                                            </span>
                                        </div>
                                    </div>
                                </div>
                             </div>
                        </div>
                        <div className="p-6 bg-gray-50 border-t flex gap-4">
                            <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 bg-white border rounded-xl font-bold text-sm uppercase transition">{t('admin.cancel')}</button>
                            <button onClick={handleSaveOrder} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm uppercase shadow-lg transition flex items-center justify-center gap-2"><Save size={16}/> {t('admin.save_changes')}</button>
                        </div>
                    </div>
                </div>
            )}
            
             {/* Add Product Modal (Reused for Admin) */}
             {isAddProductModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[250] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center"><h3 className="font-bold text-lg">{t('common.add_item')}</h3><button onClick={() => setIsAddProductModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20}/></button></div>
                        <div className="relative"><input className="w-full border rounded-lg p-2 text-sm" placeholder="Hledat produkt..." value={productSearch} onChange={e => setProductSearch(e.target.value)} autoFocus/></div>
                        <div className="overflow-y-auto divide-y flex-grow">
                        {products.filter(p => p.visibility.online && p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                            <div key={p.id} className="flex justify-between items-center py-2 hover:bg-gray-50 px-2 rounded">
                            <div className="flex items-center gap-3">
                                {p.images && p.images[0] ? (
                                    <img src={getImageUrl(p.images[0])} alt={p.name} className="w-10 h-10 rounded object-cover"/>
                                ) : (
                                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center"><ImageIcon size={16} className="text-gray-300"/></div>
                                )}
                                <div><span className="font-bold text-sm">{p.name}</span><br/><span className="text-xs text-gray-400">{p.price} Kč / {p.unit}</span></div>
                            </div>
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
