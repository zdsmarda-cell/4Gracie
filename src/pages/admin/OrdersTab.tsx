
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus, DeliveryType, Language, Product } from '../../types';
import { Pagination } from '../../components/Pagination';
import { FileText, ChevronDown, QrCode, Edit, Zap, X, Save, AlertCircle, FileCheck, Loader2, Minus, Plus, ImageIcon, Trash2, Search, Tag, Check, AlertTriangle } from 'lucide-react';
import { CustomCalendar } from '../../components/CustomCalendar';
import * as XLSX from 'xlsx';

interface OrdersTabProps {
    initialDate: string | null;
    initialEventOnly: boolean;
    onClearFilters: () => void;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({ initialDate, initialEventOnly, onClearFilters }) => {
    const { 
        orders: contextOrders, searchOrders, updateOrderStatus, t, formatDate, 
        printInvoice, settings, generateCzIban, removeDiacritics,
        updateOrder, checkAvailability, getRegionInfoForDate, 
        getPickupPointInfo, getDeliveryRegion, calculatePackagingFee, validateDiscount, getImageUrl, products
    } = useStore();

    // State
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    const [displayOrders, setDisplayOrders] = useState<Order[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState(50);
    
    const [filters, setFilters] = useState({ 
        id: '', dateFrom: '', dateTo: '', customer: '', status: '', 
        ic: '', isEvent: '' 
    });

    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const [bulkTargetStatus, setBulkTargetStatus] = useState<OrderStatus | ''>('');
    const [notifyCustomer, setNotifyCustomer] = useState(false);
    
    // UI State for menus/modals
    const [openInvoiceMenuId, setOpenInvoiceMenuId] = useState<string | null>(null);
    const [qrModalOrder, setQrModalOrder] = useState<Order | null>(null);
    const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false); // NEW: Custom Modal State
    
    // Edit Modal State
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [orderSaveError, setOrderSaveError] = useState<string | null>(null);
    
    // Add Product Modal State (inside Edit)
    const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    
    // Discount Input State (inside Edit)
    const [discountInput, setDiscountInput] = useState('');

    // Derived State for Modal
    const derivedRegion = useMemo(() => {
        if (!editingOrder || editingOrder.deliveryType !== DeliveryType.DELIVERY) return undefined;
        return editingOrder.deliveryZip ? getDeliveryRegion(editingOrder.deliveryZip) : undefined;
    }, [editingOrder?.deliveryType, editingOrder?.deliveryZip, getDeliveryRegion]);
  
    const derivedPickupLocation = useMemo(() => {
        if (!editingOrder || editingOrder.deliveryType !== DeliveryType.PICKUP || !editingOrder.pickupLocationId) return undefined;
        return settings.pickupLocations?.find(l => l.id === editingOrder.pickupLocationId);
    }, [editingOrder?.pickupLocationId, editingOrder?.deliveryType, settings.pickupLocations]);

    // Sync props to filters
    useEffect(() => {
        if (initialDate) {
            setFilters(prev => ({ ...prev, dateFrom: initialDate, dateTo: initialDate }));
        }
        if (initialEventOnly) {
            setFilters(prev => ({ ...prev, isEvent: 'yes' }));
        }
    }, [initialDate, initialEventOnly]);

    // Load Data
    const loadData = useCallback(async () => {
        setIsLoadingOrders(true);
        try {
            const res = await searchOrders({
                page: currentPage,
                limit: limit,
                ...filters
            });
            setDisplayOrders(res.orders);
            setTotalRecords(res.total);
        } catch (error) {
            console.error("LoadData Error:", error);
        } finally {
            setIsLoadingOrders(false);
        }
    }, [currentPage, limit, filters, searchOrders, contextOrders]); 

    useEffect(() => {
        loadData();
    }, [loadData]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    // Handlers
    const toggleInvoiceMenu = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setOpenInvoiceMenuId(prev => prev === id ? null : id);
    };

    useEffect(() => {
        const closeMenu = () => setOpenInvoiceMenuId(null);
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    const openOrderModal = (o: Order) => {
        setEditingOrder(JSON.parse(JSON.stringify(o)));
        setOrderSaveError(null);
        setDiscountInput('');
        setIsOrderModalOpen(true);
    };

    const handleBulkStatusChangeClick = () => {
        if (!bulkTargetStatus || selectedOrders.length === 0) return;
        setIsBulkConfirmOpen(true);
    };

    const performBulkUpdate = async () => {
        setIsBulkConfirmOpen(false);
        setIsLoadingOrders(true);
        try {
            const result = await updateOrderStatus(selectedOrders, bulkTargetStatus as OrderStatus, notifyCustomer);
            if (result) {
                setSelectedOrders([]);
                setBulkTargetStatus('');
                // Success message removed as requested, context update triggers reload automatically
            }
        } catch (err) {
            console.error("BULK: Error during update", err);
            // Error alerts should probably remain for critical issues, but if user wanted NO alerts, remove:
            // alert("Chyba při aktualizaci: " + err); 
        } finally {
            setIsLoadingOrders(false);
        }
    };

    const exportToAccounting = () => {
         const csvContent = "data:text/csv;charset=utf-8," 
            + ["OrderID,Date,User,Price,Status,Paid"].join(",") + "\n"
            + displayOrders.map(o => 
                `${o.id},${o.deliveryDate},"${o.userName}",${o.totalPrice},${o.status},${o.isPaid?'YES':'NO'}`
            ).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "orders_accounting.csv");
        document.body.appendChild(link);
        link.click();
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

    // --- RECALCULATION LOGIC (Duplicate of Profile.tsx logic) ---
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
        
        let deliveryFee = editingOrder.deliveryFee;
        if (editingOrder.deliveryType === DeliveryType.DELIVERY && derivedRegion) {
             const totalForFreeLimit = itemsTotal - validDiscounts.reduce((acc, d) => acc + d.amount, 0);
             deliveryFee = totalForFreeLimit >= derivedRegion.freeFrom ? 0 : derivedRegion.price;
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

    const handleEditOrderQuantity = (itemId: string, delta: number) => {
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
        setOrderSaveError(null);
        
        if (editingOrder.appliedDiscounts?.some(d => d.code.toUpperCase() === discountInput.toUpperCase())) {
            setOrderSaveError('Tento kód je již uplatněn.');
            return;
        }

        const res = validateDiscount(discountInput, editingOrder.items);
        if (res.success && res.amount !== undefined) {
            const newDiscounts = [...(editingOrder.appliedDiscounts || []), { code: res.discount!.code, amount: res.amount }];
            recalculateOrderTotals(editingOrder.items, newDiscounts);
            setDiscountInput('');
        } else {
            setOrderSaveError(res.error || 'Neplatný kód');
        }
    };

    const handleRemoveDiscount = (code: string) => {
        if (!editingOrder) return;
        const newDiscounts = editingOrder.appliedDiscounts?.filter(d => d.code !== code) || [];
        recalculateOrderTotals(editingOrder.items, newDiscounts);
    };

    const handleSaveOrder = async () => {
        if(!editingOrder) return;
        setOrderSaveError(null);
        
        const itemsTotal = editingOrder.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
        
        const finalOrder = {
            ...editingOrder,
            totalPrice: itemsTotal
        };

        const success = await updateOrder(finalOrder);
        if(success) {
            setIsOrderModalOpen(false);
            // Context update triggers reload
        } else {
            setOrderSaveError('Chyba při ukládání.');
        }
    };

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between mb-4">
                <div className="flex gap-2">
                    <button onClick={exportToAccounting} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow-sm"><FileText size={16} className="mr-2 text-green-600" /> {t('admin.export')}</button>
                    {(filters.dateFrom || filters.id || filters.customer || filters.isEvent) && (
                        <button onClick={onClearFilters} className="text-xs text-red-500 hover:underline px-2">Zrušit filtry</button>
                    )}
                </div>
                {selectedOrders.length > 0 && (
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-accent/10 px-2 py-1 rounded-lg border border-accent/20 gap-2">
                        <span className="text-[10px] font-bold text-primary">{t('admin.orders')}: {selectedOrders.length}</span>
                        <select 
                            className="text-[10px] border rounded bg-white p-1" 
                            value={bulkTargetStatus}
                            onChange={e => setBulkTargetStatus(e.target.value as OrderStatus)}
                        >
                            <option value="">{t('admin.status_update')}...</option>
                            {Object.values(OrderStatus).map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
                        </select>
                        <button 
                            type="button"
                            onClick={handleBulkStatusChangeClick} 
                            disabled={!bulkTargetStatus}
                            className="bg-primary text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Provést
                        </button>
                    </div>
                    <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer select-none bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">
                        <input type="checkbox" checked={notifyCustomer} onChange={e => setNotifyCustomer(e.target.checked)} className="rounded text-accent" />
                        <span>{t('admin.notify_customer')}</span>
                    </label>
                </div>
                )}
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border shadow-sm grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">ID</label>
                    <input type="text" className="w-full border rounded p-2 text-xs" placeholder="Filtr ID" value={filters.id} onChange={e => setFilters({...filters, id: e.target.value})} />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Datum Od</label>
                    <input type="date" className="w-full border rounded p-2 text-xs" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Datum Do</label>
                    <input type="date" className="w-full border rounded p-2 text-xs" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Zákazník</label>
                    <input type="text" className="w-full border rounded p-2 text-xs" placeholder="Jméno" value={filters.customer} onChange={e => setFilters({...filters, customer: e.target.value})} />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Stav</label>
                    <select className="w-full border rounded p-2 text-xs bg-white" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
                        <option value="">Všechny stavy</option>
                        {Object.values(OrderStatus).map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Akce (Event)</label>
                    <select className="w-full border rounded p-2 text-xs bg-white" value={filters.isEvent} onChange={e => setFilters({...filters, isEvent: e.target.value})}>
                        <option value="">Vše</option>
                        <option value="yes">Ano (Jen akční)</option>
                        <option value="no">Ne (Jen standard)</option>
                    </select>
                </div>
            </div>

            {isLoadingOrders ? (
                <div className="text-center py-8 text-gray-400 flex flex-col items-center">
                    <Loader2 size={32} className="animate-spin mb-2"/>
                    Načítám data...
                </div>
            ) : (
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <tr>
                        <th className="px-6 py-4 text-center"><input type="checkbox" onChange={e => setSelectedOrders(e.target.checked ? displayOrders.map(o => o.id) : [])} checked={selectedOrders.length === displayOrders.length && displayOrders.length > 0} /></th>
                        <th className="px-6 py-4 text-left">{t('filter.id')}</th>
                        <th className="px-6 py-4 text-left">{t('common.date')}</th>
                        <th className="px-6 py-4 text-left">{t('filter.customer')}</th>
                        <th className="px-6 py-4 text-center">Akce</th>
                        <th className="px-6 py-4 text-left">{t('common.price')} (Kč)</th>
                        <th className="px-6 py-4 text-left">{t('filter.payment')}</th>
                        <th className="px-6 py-4 text-center">IČ</th>
                        <th className="px-6 py-4 text-left">{t('filter.status')}</th>
                        <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-[11px]">
                        {displayOrders.length === 0 && (
                            <tr><td colSpan={10} className="p-8 text-center text-gray-400 italic">Žádné objednávky</td></tr>
                        )}
                        {displayOrders.map((order, index) => {
                            const hasIc = !!order.billingIc;
                            const hasEvent = order.items.some(i => i.isEventProduct);
                            const finalPrice = Math.max(0, order.totalPrice + order.packagingFee + (order.deliveryFee || 0) - (order.appliedDiscounts?.reduce((a,b)=>a+b.amount,0)||0));
                            const isNearBottom = index > displayOrders.length - 3;

                            return (
                                <tr key={order.id} className="hover:bg-gray-50 transition relative group">
                                    <td className="px-6 py-4 text-center"><input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => setSelectedOrders(prev => prev.includes(order.id) ? prev.filter(x => x !== order.id) : [...prev, order.id])} /></td>
                                    <td className="px-6 py-4 font-bold">
                                        {order.id}
                                    </td>
                                    <td className="px-6 py-4 font-mono">{formatDate(order.deliveryDate)}</td>
                                    <td className="px-6 py-4">{order.userName}</td>
                                    <td className="px-6 py-4 text-center">
                                        {hasEvent ? (
                                            <span className="inline-flex items-center justify-center bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[9px] font-bold">
                                                <Zap size={10} className="mr-1 fill-purple-700" /> ANO
                                            </span>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-bold">{finalPrice} Kč</td>
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
                                                {openInvoiceMenuId === order.id && (
                                                    <div className={`absolute right-0 ${isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'} bg-white border rounded shadow-lg z-50 py-1 w-32`}>
                                                        <button onClick={() => { printInvoice(order, 'proforma'); setOpenInvoiceMenuId(null); }} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">Zálohová</button>
                                                        {order.status === OrderStatus.DELIVERED && (
                                                            <button onClick={() => { printInvoice(order, 'final'); setOpenInvoiceMenuId(null); }} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-green-600 font-bold">Daňový doklad</button>
                                                        )}
                                                    </div>
                                                )}
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
                <Pagination 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    limit={limit}
                    onLimitChange={(l) => { setLimit(l); setCurrentPage(1); }}
                    totalItems={totalRecords}
                />
            </div>
            )}

            {/* BULK CONFIRMATION MODAL */}
            {isBulkConfirmOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in zoom-in-95 duration-200">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
                                <AlertTriangle size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Potvrzení hromadné akce</h3>
                            <p className="text-sm text-gray-600 mb-6">
                                Opravdu chcete změnit stav <strong>{selectedOrders.length}</strong> vybraných objednávek na <strong>{t(`status.${bulkTargetStatus}`)}</strong>?
                            </p>
                            <div className="flex gap-3 w-full">
                                <button onClick={() => setIsBulkConfirmOpen(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200 transition">Zrušit</button>
                                <button onClick={performBulkUpdate} className="flex-1 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-black transition">Provést</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALS */}
            
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

            {/* Edit Modal */}
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
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest border-b pb-2">Nastavení</h3>
                                <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('common.date')}</label><input type="date" className="w-full border rounded p-2 text-sm" value={editingOrder.deliveryDate} onChange={e => setEditingOrder({...editingOrder, deliveryDate: e.target.value})}/></div>
                                    <div><label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('checkout.delivery')}</label><select className="w-full border rounded p-2 text-sm" value={editingOrder.deliveryType} onChange={e => setEditingOrder({...editingOrder, deliveryType: e.target.value as DeliveryType})}><option value={DeliveryType.PICKUP}>{t('checkout.pickup')}</option><option value={DeliveryType.DELIVERY}>{t('admin.delivery')}</option></select></div>
                                </div>

                                {/* CALENDAR VISIBLE HERE */}
                                <div className="mt-2">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Výběr termínu</label>
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

                                    {/* Pickup Location Selector */}
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

                                    {/* Address Fields */}
                                    <div className="space-y-2 p-3 bg-white border rounded-lg">
                                        <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Doručovací adresa</div>
                                        <input placeholder="Jméno / Firma" className="w-full border rounded p-2 text-xs" value={editingOrder.deliveryName || editingOrder.userName || ''} onChange={e => setEditingOrder({...editingOrder, deliveryName: e.target.value})} />
                                        <input placeholder="Ulice a č.p." className="w-full border rounded p-2 text-xs" value={editingOrder.deliveryStreet || ''} onChange={e => setEditingOrder({...editingOrder, deliveryStreet: e.target.value})} />
                                        <div className="grid grid-cols-2 gap-2">
                                            <input placeholder="Město" className="border rounded p-2 text-xs" value={editingOrder.deliveryCity || ''} onChange={e => setEditingOrder({...editingOrder, deliveryCity: e.target.value})} />
                                            <input placeholder="PSČ" className="border rounded p-2 text-xs" value={editingOrder.deliveryZip || ''} onChange={e => setEditingOrder({...editingOrder, deliveryZip: e.target.value})} />
                                        </div>
                                        <input placeholder="Telefon" className="w-full border rounded p-2 text-xs" value={editingOrder.deliveryPhone || ''} onChange={e => setEditingOrder({...editingOrder, deliveryPhone: e.target.value})} />
                                    </div>

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
                                        <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('admin.comm_lang')}</label>
                                        <select className="w-full border rounded p-2 text-sm" value={editingOrder.language || Language.CS} onChange={e => setEditingOrder({...editingOrder, language: e.target.value as Language})}>
                                            {Object.values(Language).map(lang => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Items Section */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest border-b pb-2">Položky</h3>
                                {/* Enhanced Items Table with Images */}
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
                                
                                {/* FEES & DISCOUNT SUMMARY */}
                                <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                                    {/* Discount Input */}
                                    <div className="flex gap-2 border-b pb-3 mb-2">
                                        <div className="relative flex-1">
                                            <Tag size={14} className="absolute left-2 top-2.5 text-gray-400"/>
                                            <input 
                                                type="text" 
                                                placeholder="Slevový kupon" 
                                                className="w-full border rounded-lg pl-8 p-2 text-xs uppercase font-bold focus:ring-accent outline-none"
                                                value={discountInput}
                                                onChange={e => setDiscountInput(e.target.value)}
                                            />
                                        </div>
                                        <button onClick={handleApplyDiscount} className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition">Použít</button>
                                    </div>

                                    {/* Financial Breakdown */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>Zboží:</span>
                                            <span>{editingOrder.items.reduce((acc, i) => acc + i.price * i.quantity, 0)} Kč</span>
                                        </div>
                                        {editingOrder.appliedDiscounts?.map(d => (
                                            <div key={d.code} className="flex justify-between items-center text-xs text-green-600">
                                                <span className="flex items-center gap-1"><Tag size={10}/> Sleva ({d.code}):</span>
                                                <div className="flex items-center gap-2">
                                                    <span>-{d.amount} Kč</span>
                                                    <button onClick={() => handleRemoveDiscount(d.code)} className="text-red-400 hover:text-red-600"><X size={10}/></button>
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
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-2">
                                        <span className="font-bold text-sm">CELKEM:</span>
                                        <span className="font-bold text-lg text-accent">{Math.max(0, editingOrder.totalPrice + editingOrder.packagingFee + (editingOrder.deliveryFee || 0) - (editingOrder.appliedDiscounts?.reduce((sum, d) => sum + d.amount, 0) || 0))} Kč</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 border-t flex gap-4"><button onClick={() => setIsOrderModalOpen(false)} className="flex-1 py-3 bg-white border rounded-xl font-bold text-sm uppercase transition">{t('admin.cancel')}</button><button onClick={handleSaveOrder} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm uppercase shadow-lg transition">{t('admin.save_changes')}</button></div>
                    </div>
                </div>
            )}

            {/* Add Product Modal (Inside Order Edit) */}
            {isAddProductModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[250] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center"><h3 className="font-bold text-lg">Přidat produkt</h3><button onClick={() => setIsAddProductModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20}/></button></div>
                        <div className="relative"><Search size={16} className="absolute left-3 top-3 text-gray-400"/><input className="w-full border rounded-lg pl-9 p-2 text-sm" placeholder="Hledat produkt..." value={productSearch} onChange={e => setProductSearch(e.target.value)} autoFocus/></div>
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
