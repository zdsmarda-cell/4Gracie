
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus, DeliveryType, Language, Product } from '../../types';
import { FileText, Save, X, AlertCircle, Plus, Minus, Trash2, CheckCircle, Search, Tag, CreditCard, ImageIcon, QrCode } from 'lucide-react';
import { CustomCalendar } from '../../components/CustomCalendar';

export const OrdersTab: React.FC = () => {
    const { orders, allUsers, t, updateOrder, updateOrderStatus, formatDate, settings, getDeliveryRegion, getRegionInfoForDate, getPickupPointInfo, checkAvailability, products, calculatePackagingFee, validateDiscount, printInvoice, generateCzIban, removeDiacritics } = useStore();
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const [notifyCustomer, setNotifyCustomer] = useState(false);
    const [orderFilters, setOrderFilters] = useState({ id: '', dateFrom: '', dateTo: '', customer: '', status: '', ic: '' });
    
    // Modal State
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [orderSaveError, setOrderSaveError] = useState<string | null>(null);
    const [selectedDeliveryAddrId, setSelectedDeliveryAddrId] = useState('');
    
    // Items Editing
    const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
    const [productSearch, setProductSearch] = useState('');

    // Discount State for Admin
    const [discountInput, setDiscountInput] = useState('');
    const [discountError, setDiscountError] = useState('');

    // QR Modal State
    const [qrModalOrder, setQrModalOrder] = useState<Order | null>(null);

    // Address Editing State (Split fields)
    const [addrFields, setAddrFields] = useState({ name: '', street: '', city: '', zip: '', phone: '' });

    // Sync Address Fields when editingOrder changes or type changes to DELIVERY
    useEffect(() => {
        if (editingOrder && editingOrder.deliveryType === DeliveryType.DELIVERY && editingOrder.deliveryAddress) {
            const parts = editingOrder.deliveryAddress.split('\n');
            setAddrFields({
                name: parts[0] || '',
                street: parts[1] || '',
                city: parts[2] || '',
                zip: parts[3] || '',
                phone: parts[4]?.replace('Tel: ', '') || ''
            });
        }
    }, [editingOrder?.id, editingOrder?.deliveryType]);

    // Update main order string when fields change
    const handleAddrFieldChange = (field: keyof typeof addrFields, value: string) => {
        const newFields = { ...addrFields, [field]: value };
        setAddrFields(newFields);
        if (editingOrder) {
            const newAddrString = `${newFields.name}\n${newFields.street}\n${newFields.city}\n${newFields.zip}\nTel: ${newFields.phone}`;
            setEditingOrder({ ...editingOrder, deliveryAddress: newAddrString });
        }
    };

    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            if (orderFilters.id && !o.id.toLowerCase().includes(orderFilters.id.toLowerCase())) return false;
            if (orderFilters.dateFrom && o.deliveryDate < orderFilters.dateFrom) return false;
            if (orderFilters.dateTo && o.deliveryDate > orderFilters.dateTo) return false;
            if (orderFilters.customer && !o.userName?.toLowerCase().includes(orderFilters.customer.toLowerCase())) return false;
            if (orderFilters.status && o.status !== orderFilters.status) return false;
            
            const orderUser = allUsers.find(u => u.id === o.userId);
            const hasIc = (o.billingAddress && o.billingAddress.includes('IČ')) || (orderUser?.billingAddresses?.some(a => !!a.ic && a.ic.length > 0));
            if (orderFilters.ic === 'yes' && !hasIc) return false;
            if (orderFilters.ic === 'no' && hasIc) return false;

            return true;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [orders, orderFilters, allUsers]);

    const derivedRegion = useMemo(() => {
        if (!editingOrder || editingOrder.deliveryType !== DeliveryType.DELIVERY || !addrFields.zip) return undefined;
        return getDeliveryRegion(addrFields.zip);
    }, [addrFields.zip, editingOrder?.deliveryType]);

    const derivedPickupLocation = useMemo(() => {
        if (!editingOrder || editingOrder.deliveryType !== DeliveryType.PICKUP || !editingOrder.pickupLocationId) return undefined;
        return settings.pickupLocations?.find(l => l.id === editingOrder.pickupLocationId);
    }, [editingOrder?.pickupLocationId, editingOrder?.deliveryType, settings.pickupLocations]);

    const handleBulkStatusChange = async (status: OrderStatus) => {
        if (!status) return;
        if (confirm(`Opravdu změnit stav ${selectedOrders.length} objednávek na ${status}?`)) {
            await updateOrderStatus(selectedOrders, status, notifyCustomer);
            setSelectedOrders([]);
        }
    };

    const exportToAccounting = () => {
        // 1. Identify all VAT rates present in the dataset (or standard ones if none)
        const ratesSet = new Set<number>([0, 21]); // Always include 0 and 21 as baseline
        
        filteredOrders.forEach(o => {
            o.items.forEach(item => {
                const isTakeaway = o.deliveryType !== DeliveryType.PICKUP; // Simplified logic, really depends on where it is consumed, but usually delivery = takeaway VAT
                // Actually, assuming standard logic: Delivery = Takeaway rate, Pickup = ??? (Store can be inner or takeaway)
                // For simplicity here, we use the stored rate on product
                const r = isTakeaway ? (item.vatRateTakeaway || 15) : (item.vatRateInner || 12);
                ratesSet.add(r);
            });
        });
        
        const sortedRates = Array.from(ratesSet).sort((a, b) => a - b);

        // 2. Build Header
        let header = "OrderID;Date;User;TotalPrice;Status;Paid";
        sortedRates.forEach(r => {
            header += `;Base${r};Vat${r};Total${r}`;
        });
        header += "\n";

        // 3. Build Rows
        const rows = filteredOrders.map(o => {
            const vatBuckets: Record<number, { base: number, tax: number, total: number }> = {};
            
            // Initialize buckets
            sortedRates.forEach(r => vatBuckets[r] = { base: 0, tax: 0, total: 0 });

            // Helper to add to bucket
            const addToBucket = (rate: number, totalWithVat: number) => {
                if (!vatBuckets[rate]) vatBuckets[rate] = { base: 0, tax: 0, total: 0 };
                const base = totalWithVat / (1 + rate / 100);
                const tax = totalWithVat - base;
                vatBuckets[rate].base += base;
                vatBuckets[rate].tax += tax;
                vatBuckets[rate].total += totalWithVat;
            };

            // Process Items
            let maxItemRate = 0;
            o.items.forEach(item => {
                const isTakeaway = o.deliveryType !== DeliveryType.PICKUP; // Simplified assumption
                const rate = isTakeaway ? (item.vatRateTakeaway || 15) : (item.vatRateInner || 12);
                if (rate > maxItemRate) maxItemRate = rate;
                
                const itemTotal = item.price * item.quantity;
                addToBucket(rate, itemTotal);
            });

            // Process Fees (Delivery/Packaging) - assign to highest rate found
            const feeRate = maxItemRate || 21; 
            if (o.deliveryFee > 0) addToBucket(feeRate, o.deliveryFee);
            if (o.packagingFee > 0) addToBucket(feeRate, o.packagingFee);

            // Process Discounts (Subtract from highest rate or split? Simplified: Subtract from highest rate bucket)
            if (o.appliedDiscounts && o.appliedDiscounts.length > 0) {
                const totalDiscount = o.appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);
                // Be careful not to go negative in bucket if possible, but for export we just subtract value
                addToBucket(feeRate, -totalDiscount);
            }

            // Construct Row String
            let row = `${o.id};${o.deliveryDate};"${o.userName}";${o.totalPrice + o.packagingFee + (o.deliveryFee || 0)};${o.status};${o.isPaid?'YES':'NO'}`;
            
            sortedRates.forEach(r => {
                const b = vatBuckets[r];
                // Formatting numbers with decimal point for CSV standard, or replace with comma if needed for specific CZ Excel
                row += `;${b.base.toFixed(2)};${b.tax.toFixed(2)};${b.total.toFixed(2)}`;
            });

            return row;
        }).join("\n");

        const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(header + rows);
        const link = document.createElement("a");
        link.setAttribute("href", csvContent);
        link.setAttribute("download", "orders_export_vat.csv");
        document.body.appendChild(link);
        link.click();
    };

    const openOrderModal = (o: Order) => {
        setEditingOrder(JSON.parse(JSON.stringify(o)));
        setOrderSaveError(null);
        setSelectedDeliveryAddrId(''); 
        setDiscountInput('');
        setDiscountError('');
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

    // DISCOUNT HANDLING
    const handleApplyDiscount = () => {
        if (!editingOrder || !discountInput) return;
        setDiscountError('');

        // 1. Check duplicate
        if (editingOrder.appliedDiscounts?.some(d => d.code.toUpperCase() === discountInput.toUpperCase())) {
            setDiscountError('Tento kód je již uplatněn.');
            return;
        }

        // 2. Validate against logic
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
        
        setEditingOrder({ 
            ...editingOrder, 
            items, 
            appliedDiscounts: validDiscounts,
            totalPrice: itemsTotal,
            packagingFee 
        });
    };

    const handleOrderSave = async () => {
        if (!editingOrder) return;
        setOrderSaveError(null);

        // 1. Validate Delivery Type & Date
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
        } else {
            // Delivery Validation
            if (!addrFields.name || !addrFields.street || !addrFields.city || !addrFields.zip || !addrFields.phone) {
                setOrderSaveError('Vyplňte všechny údaje doručovací adresy (Jméno, Ulice, Město, PSČ, Telefon).');
                return;
            }
            const region = getDeliveryRegion(addrFields.zip);
            if (!region) {
                setOrderSaveError(`Pro PSČ ${addrFields.zip} neexistuje rozvozový region.`);
                return;
            }
            const info = getRegionInfoForDate(region, editingOrder.deliveryDate);
            if (!info.isOpen) {
                setOrderSaveError(`Region "${region.name}" nerozváží dne ${formatDate(editingOrder.deliveryDate)}.`);
                return;
            }
        }

        const availability = checkAvailability(editingOrder.deliveryDate, editingOrder.items, editingOrder.id);
        if (!availability.allowed && availability.status !== 'available') {
            setOrderSaveError(`Kapacita: ${availability.reason || 'Termín není dostupný'}`);
            return;
        }

        const success = await updateOrder(editingOrder);
        if (success) setIsOrderModalOpen(false);
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

    const orderUser = useMemo(() => editingOrder ? allUsers.find(u => u.id === editingOrder.userId) : null, [editingOrder, allUsers]);

    return (
        <div className="animate-fade-in space-y-4">
            {/* ... Filters ... */}
            <div className="flex justify-between mb-4">
                <button onClick={exportToAccounting} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow-sm"><FileText size={16} className="mr-2 text-green-600" /> {t('admin.export')}</button>
                {selectedOrders.length > 0 && (
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-accent/10 px-3 py-1 rounded-lg border border-accent/20">
                    <span className="text-[10px] font-bold text-primary mr-3">{t('admin.orders')}: {selectedOrders.length}</span>
                    <select className="text-[10px] border rounded bg-white p-1 mr-2" onChange={e => handleBulkStatusChange(e.target.value as OrderStatus)}>
                        <option value="">{t('admin.status_update')}...</option>
                        {Object.values(OrderStatus).map(s => <option key={s as string} value={s as string}>{t(`status.${s}`)}</option>)}
                    </select>
                    </div>
                    <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer select-none bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">
                    <input type="checkbox" checked={notifyCustomer} onChange={e => setNotifyCustomer(e.target.checked)} className="rounded text-accent" />
                    <span>{t('admin.notify_customer')}</span>
                    </label>
                </div>
                )}
            </div>

            <div className="bg-white p-4 rounded-xl border shadow-sm grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                <div className="md:col-span-1">
                    <label className="text-xs font-bold text-gray-400 block mb-1">ID</label>
                    <input type="text" className="w-full border rounded p-2 text-xs" placeholder="Filtr ID" value={orderFilters.id} onChange={e => setOrderFilters({...orderFilters, id: e.target.value})} />
                </div>
                <div className="md:col-span-1">
                    <label className="text-xs font-bold text-gray-400 block mb-1">{t('filter.date_from')}</label>
                    <input type="date" className="w-full border rounded p-2 text-xs" value={orderFilters.dateFrom} onChange={e => setOrderFilters({...orderFilters, dateFrom: e.target.value})} />
                </div>
                <div className="md:col-span-1">
                    <label className="text-xs font-bold text-gray-400 block mb-1">{t('filter.date_to')}</label>
                    <input type="date" className="w-full border rounded p-2 text-xs" value={orderFilters.dateTo} onChange={e => setOrderFilters({...orderFilters, dateTo: e.target.value})} />
                </div>
                <div className="md:col-span-1">
                    <label className="text-xs font-bold text-gray-400 block mb-1">Zákazník</label>
                    <input type="text" className="w-full border rounded p-2 text-xs" placeholder="Jméno" value={orderFilters.customer} onChange={e => setOrderFilters({...orderFilters, customer: e.target.value})} />
                </div>
                <div className="md:col-span-1">
                    <label className="text-xs font-bold text-gray-400 block mb-1">Stav</label>
                    <select className="w-full border rounded p-2 text-xs bg-white" value={orderFilters.status} onChange={e => setOrderFilters({...orderFilters, status: e.target.value})}>
                        <option value="">Všechny stavy</option>
                        {Object.values(OrderStatus).map(s => <option key={s as string} value={s as string}>{t(`status.${s}`)}</option>)}
                    </select>
                </div>
                <div className="md:col-span-1">
                    <label className="text-xs font-bold text-gray-400 block mb-1">IČ</label>
                    <select className="w-full border rounded p-2 text-xs bg-white" value={orderFilters.ic} onChange={e => setOrderFilters({...orderFilters, ic: e.target.value})}>
                        <option value="">{t('filter.all')}</option>
                        <option value="yes">{t('common.yes')}</option>
                        <option value="no">{t('common.no')}</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <tr>
                    <th className="px-6 py-4 text-center"><input type="checkbox" onChange={e => setSelectedOrders(e.target.checked ? filteredOrders.map(o => o.id) : [])} checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0} /></th>
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
                    {filteredOrders.map(order => {
                        const orderUser = allUsers.find(u => u.id === order.userId);
                        const hasIc = (order.billingAddress && order.billingAddress.includes('IČ')) || (orderUser?.billingAddresses?.some(a => !!a.ic && a.ic.length > 0));
                        return (
                            <tr key={order.id} className="hover:bg-gray-50 transition">
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
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setQrModalOrder(order)} className="p-1 text-gray-500 hover:text-primary" title="QR Platba"><QrCode size={16}/></button>
                                        <button onClick={() => printInvoice(order)} className="p-1 text-gray-500 hover:text-primary" title="Stáhnout fakturu"><FileText size={16}/></button>
                                        <button onClick={() => openOrderModal(order)} className="text-blue-600 font-bold hover:underline ml-2">{t('common.detail_edit')}</button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                </table>
            </div>

            {/* QR MODAL (Similar to Profile) */}
            {qrModalOrder && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in zoom-in-95 duration-200" onClick={() => setQrModalOrder(null)}>
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

            {/* EDIT ORDER MODAL (UNIFIED DESIGN) */}
            {isOrderModalOpen && editingOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
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
                                        <div>
                                            <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('filter.customer_placeholder')}</label>
                                            <input type="text" className="w-full border rounded p-2 text-sm" value={editingOrder.userName} onChange={e => setEditingOrder({...editingOrder, userName: e.target.value})}/>
                                        </div>
                                        {/* CUSTOM CALENDAR FOR ADMIN */}
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
                                    </div>

                                    <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
                                        <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest border-b pb-2">Doprava & Platba</h3>
                                        <div>
                                            <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('checkout.delivery')}</label>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => setEditingOrder({...editingOrder, deliveryType: DeliveryType.PICKUP, deliveryAddress: undefined})} className={`flex-1 py-2 text-xs font-bold rounded border ${editingOrder.deliveryType === DeliveryType.PICKUP ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600'}`}>{t('checkout.pickup')}</button>
                                                <button type="button" onClick={() => setEditingOrder({...editingOrder, deliveryType: DeliveryType.DELIVERY, pickupLocationId: undefined})} className={`flex-1 py-2 text-xs font-bold rounded border ${editingOrder.deliveryType === DeliveryType.DELIVERY ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600'}`}>{t('admin.delivery')}</button>
                                            </div>
                                        </div>
                                        
                                        {editingOrder.deliveryType === DeliveryType.PICKUP && (
                                            <div>
                                                <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Odběrné místo</label>
                                                <select className="w-full border rounded p-2 text-sm" value={editingOrder.pickupLocationId || ''} onChange={e => {
                                                    const loc = settings.pickupLocations?.find(l => l.id === e.target.value);
                                                    setEditingOrder({...editingOrder, pickupLocationId: e.target.value, deliveryAddress: loc ? `Osobní odběr: ${loc.name}, ${loc.street}, ${loc.city}` : ''});
                                                }}>
                                                    <option value="">Vyberte místo...</option>
                                                    {settings.pickupLocations?.filter(l => l.enabled).map(l => (
                                                        <option key={l.id} value={l.id}>{l.name} ({l.street})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        
                                        {editingOrder.deliveryType === DeliveryType.DELIVERY && (
                                            <div className="space-y-2 pt-2 border-t mt-2">
                                                {orderUser && orderUser.deliveryAddresses.length > 0 && (
                                                    <div className="mb-2">
                                                        <select className="w-full border rounded p-2 text-xs bg-yellow-50" value={selectedDeliveryAddrId} onChange={e => { 
                                                            setSelectedDeliveryAddrId(e.target.value); 
                                                            const addr = orderUser.deliveryAddresses.find(a => a.id === e.target.value); 
                                                            if(addr) {
                                                                setAddrFields({ name: addr.name, street: addr.street, city: addr.city, zip: addr.zip, phone: addr.phone });
                                                                const newStr = `${addr.name}\n${addr.street}\n${addr.city}\n${addr.zip}\nTel: ${addr.phone}`;
                                                                setEditingOrder({...editingOrder, deliveryAddress: newStr});
                                                            }
                                                        }}>
                                                            <option value="">-- Načíst uloženou adresu --</option>
                                                            {orderUser.deliveryAddresses.map(a => (<option key={a.id} value={a.id}>{a.name}, {a.city}</option>))}
                                                        </select>
                                                    </div>
                                                )}
                                                
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="col-span-2">
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase block">Jméno / Firma</label>
                                                        <input className="w-full border rounded p-2 text-sm" value={addrFields.name} onChange={e => handleAddrFieldChange('name', e.target.value)} />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase block">Ulice a č.p.</label>
                                                        <input className="w-full border rounded p-2 text-sm" value={addrFields.street} onChange={e => handleAddrFieldChange('street', e.target.value)} />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase block">Město</label>
                                                        <input className="w-full border rounded p-2 text-sm" value={addrFields.city} onChange={e => handleAddrFieldChange('city', e.target.value)} />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase block">PSČ</label>
                                                        <div className="relative">
                                                            <input className={`w-full border rounded p-2 text-sm ${derivedRegion ? 'border-green-500 bg-green-50' : 'border-red-300 bg-red-50'}`} value={addrFields.zip} onChange={e => handleAddrFieldChange('zip', e.target.value)} />
                                                            <div className="absolute right-2 top-2">
                                                                {derivedRegion ? <CheckCircle size={16} className="text-green-500"/> : <AlertCircle size={16} className="text-red-500"/>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase block">Telefon</label>
                                                        <input className="w-full border rounded p-2 text-sm" value={addrFields.phone} onChange={e => handleAddrFieldChange('phone', e.target.value)} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-4 pt-4 border-t">
                                            <label className="flex items-center space-x-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={editingOrder.isPaid} 
                                                    onChange={e => setEditingOrder({...editingOrder, isPaid: e.target.checked})} 
                                                    className="w-5 h-5 rounded text-green-600 focus:ring-green-500" 
                                                />
                                                <span className={`font-bold text-sm ${editingOrder.isPaid ? 'text-green-700' : 'text-red-600'}`}>
                                                    {editingOrder.isPaid ? 'Objednávka je ZAPLACENA' : 'Objednávka NENÍ ZAPLACENA'}
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest border-b pb-2">Položky a Slevy</h3>
                                    
                                    <div className="border rounded-2xl overflow-hidden shadow-sm bg-white">
                                        <table className="min-w-full divide-y">
                                            <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                                                <tr>
                                                    <th className="px-3 py-2 text-left w-12">Foto</th>
                                                    <th className="px-3 py-2 text-left">Produkt</th>
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
                                                                <img src={item.images[0]} alt={item.name} className="w-8 h-8 rounded object-cover" />
                                                            ) : (
                                                                <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-300"><ImageIcon size={12}/></div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 font-bold">{item.name}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            <div className="flex items-center justify-center space-x-1">
                                                                <button onClick={() => handleEditItemQuantity(item.id, -1)} className="p-1 hover:bg-gray-100 rounded"><Minus size={10}/></button>
                                                                <span className="w-6 text-center font-bold">{item.quantity}</span>
                                                                <button onClick={() => handleEditItemQuantity(item.id, 1)} className="p-1 hover:bg-gray-100 rounded"><Plus size={10}/></button>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono">{item.price * item.quantity}</td>
                                                        <td className="px-3 py-2 text-right">
                                                            <button onClick={() => handleEditItemQuantity(item.id, -item.quantity)} className="text-red-400 hover:text-red-600"><Trash2 size={12}/></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <button onClick={() => setIsAddProductModalOpen(true)} className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-600 border-t flex items-center justify-center">
                                            <Plus size={14} className="mr-1"/> Přidat produkt
                                        </button>
                                    </div>

                                    {/* Discount Section */}
                                    <div className="bg-white border rounded-2xl p-4 space-y-3">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase block">Slevové kódy</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                className="flex-1 border rounded p-2 text-xs uppercase" 
                                                placeholder="Kód kuponu"
                                                value={discountInput}
                                                onChange={e => setDiscountInput(e.target.value)}
                                            />
                                            <button onClick={handleApplyDiscount} className="bg-gray-800 text-white px-3 py-2 rounded text-xs font-bold">Použít</button>
                                        </div>
                                        {discountError && <p className="text-[10px] text-red-500 font-bold">{discountError}</p>}
                                        
                                        {editingOrder.appliedDiscounts && editingOrder.appliedDiscounts.length > 0 && (
                                            <div className="space-y-1 pt-2">
                                                {editingOrder.appliedDiscounts.map(d => (
                                                    <div key={d.code} className="flex justify-between items-center bg-green-50 p-2 rounded border border-green-100 text-xs">
                                                        <div className="flex items-center text-green-700">
                                                            <Tag size={12} className="mr-1"/> 
                                                            <span className="font-bold">{d.code}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-green-700">-{d.amount} Kč</span>
                                                            <button onClick={() => handleRemoveDiscount(d.code)} className="text-green-300 hover:text-green-600"><X size={12}/></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-gray-50 p-4 rounded-2xl space-y-2">
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>Zboží:</span>
                                            <span>{editingOrder.items.reduce((s, i) => s + i.price * i.quantity, 0)} Kč</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>Balné:</span>
                                            <span>{editingOrder.packagingFee} Kč</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>Doprava:</span>
                                            <span>{editingOrder.deliveryFee} Kč</span>
                                        </div>
                                        {editingOrder.appliedDiscounts && editingOrder.appliedDiscounts.length > 0 && (
                                            <div className="flex justify-between text-xs text-green-600 font-bold border-t border-gray-200 pt-1 mt-1">
                                                <span>Slevy celkem:</span>
                                                <span>-{editingOrder.appliedDiscounts.reduce((sum, d) => sum + d.amount, 0)} Kč</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-2">
                                            <span className="font-bold text-sm">CELKEM:</span>
                                            <span className="font-bold text-lg text-accent">
                                                {Math.max(0, editingOrder.totalPrice - (editingOrder.appliedDiscounts?.reduce((sum, d) => sum + d.amount, 0) || 0)) + editingOrder.packagingFee + (editingOrder.deliveryFee || 0)} Kč
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 border-t flex gap-4">
                            <button onClick={() => setIsOrderModalOpen(false)} className="flex-1 py-3 bg-white border rounded-xl font-bold text-sm uppercase transition">{t('admin.cancel')}</button>
                            <button onClick={handleOrderSave} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm uppercase shadow-lg transition flex items-center justify-center gap-2">
                                <Save size={16}/> {t('admin.save_changes')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD PRODUCT MODAL */}
            {isAddProductModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[250] p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-lg">{t('common.add_item')}</h3>
                            <button onClick={() => setIsAddProductModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                        </div>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-3 text-gray-400"/>
                            <input 
                                className="w-full border rounded-lg pl-9 p-2 text-sm" 
                                placeholder="Hledat produkt..." 
                                value={productSearch} 
                                onChange={e => setProductSearch(e.target.value)} 
                                autoFocus
                            />
                        </div>
                        <div className="overflow-y-auto divide-y flex-grow">
                            {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                                <div key={p.id} className="flex justify-between items-center py-2 hover:bg-gray-50 px-2 rounded">
                                    <div className="flex items-center gap-3">
                                        {p.images && p.images[0] ? (
                                            <img src={p.images[0]} alt={p.name} className="w-10 h-10 rounded object-cover"/>
                                        ) : (
                                            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center"><ImageIcon size={16} className="text-gray-300"/></div>
                                        )}
                                        <div>
                                            <span className="font-bold text-sm block">{p.name}</span>
                                            <span className="text-xs text-gray-400">{p.price} Kč / {p.unit}</span>
                                        </div>
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
