
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus, DeliveryType, Language } from '../../types';
import { FileText, Save, X, AlertCircle } from 'lucide-react';

export const OrdersTab: React.FC = () => {
    const { orders, allUsers, t, updateOrder, updateOrderStatus, formatDate, settings, getDeliveryRegion, getRegionInfoForDate, getPickupPointInfo, checkAvailability } = useStore();
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const [notifyCustomer, setNotifyCustomer] = useState(false);
    const [orderFilters, setOrderFilters] = useState({ id: '', dateFrom: '', dateTo: '', customer: '', status: '', ic: '' });
    
    // Modal State
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [orderSaveError, setOrderSaveError] = useState<string | null>(null);
    const [selectedDeliveryAddrId, setSelectedDeliveryAddrId] = useState('');

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

    const handleBulkStatusChange = async (status: OrderStatus) => {
        if (!status) return;
        if (confirm(`Opravdu změnit stav ${selectedOrders.length} objednávek na ${status}?`)) {
            await updateOrderStatus(selectedOrders, status, notifyCustomer);
            setSelectedOrders([]);
        }
    };

    const exportToAccounting = () => {
         const csvContent = "data:text/csv;charset=utf-8," 
            + ["OrderID,Date,User,Price,Status,Paid"].join(",") + "\n"
            + orders.map(o => 
                `${o.id},${o.deliveryDate},"${o.userName}",${o.totalPrice},${o.status},${o.isPaid?'YES':'NO'}`
            ).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "orders_accounting.csv");
        document.body.appendChild(link);
        link.click();
    };

    const openOrderModal = (o: Order) => {
        setEditingOrder(JSON.parse(JSON.stringify(o)));
        setOrderSaveError(null);
        setSelectedDeliveryAddrId(''); 
        setIsOrderModalOpen(true);
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
            if (!editingOrder.deliveryAddress) {
                setOrderSaveError('Vyplňte doručovací adresu.');
                return;
            }
            const zipMatch = editingOrder.deliveryAddress.match(/\d{3}\s?\d{2}/);
            if (zipMatch) {
                const region = getDeliveryRegion(zipMatch[0]);
                if (!region) {
                    setOrderSaveError(`Pro PSČ ${zipMatch[0]} neexistuje rozvozový region.`);
                    return;
                }
                const info = getRegionInfoForDate(region, editingOrder.deliveryDate);
                if (!info.isOpen) {
                    setOrderSaveError(`Region "${region.name}" nerozváží dne ${formatDate(editingOrder.deliveryDate)}.`);
                    return;
                }
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

    const orderUser = useMemo(() => editingOrder ? allUsers.find(u => u.id === editingOrder.userId) : null, [editingOrder, allUsers]);

    return (
        <div className="animate-fade-in space-y-4">
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
                                <button onClick={() => openOrderModal(order)} className="text-blue-600 font-bold hover:underline">{t('common.detail_edit')}</button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                </table>
            </div>

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
                                    <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
                                        <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest border-b pb-2">Zákazník & Termín</h3>
                                        <div>
                                            <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('filter.customer_placeholder')}</label>
                                            <input type="text" className="w-full border rounded p-2 text-sm" value={editingOrder.userName} onChange={e => setEditingOrder({...editingOrder, userName: e.target.value})}/>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('common.date')}</label>
                                            <input type="date" className="w-full border rounded p-2 text-sm" value={editingOrder.deliveryDate} onChange={e => setEditingOrder({...editingOrder, deliveryDate: e.target.value})}/>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
                                        <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest border-b pb-2">Doprava a Fakturace</h3>
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
                                            <>
                                                {orderUser && orderUser.deliveryAddresses.length > 0 && (
                                                    <div>
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Vybrat z adres zákazníka</label>
                                                        <select className="w-full border rounded p-2 text-sm mb-2" value={selectedDeliveryAddrId} onChange={e => { setSelectedDeliveryAddrId(e.target.value); const addr = orderUser.deliveryAddresses.find(a => a.id === e.target.value); if(addr) setEditingOrder({...editingOrder, deliveryAddress: `${addr.name}\n${addr.street}\n${addr.city}\n${addr.zip}\nTel: ${addr.phone}`});}}>
                                                            <option value="">-- Použít uloženou adresu --</option>
                                                            {orderUser.deliveryAddresses.map(a => (<option key={a.id} value={a.id}>{a.name}, {a.street}, {a.city}</option>))}
                                                        </select>
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('common.street')} (Text)</label>
                                                    <textarea className="w-full border rounded p-2 text-sm h-20" value={editingOrder.deliveryAddress || ''} onChange={e => setEditingOrder({...editingOrder, deliveryAddress: e.target.value})}/>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center">
                                        <span className="font-bold text-sm">Celkem (Automatický výpočet):</span>
                                        <span className="font-bold text-lg text-accent">{editingOrder.totalPrice + editingOrder.packagingFee + (editingOrder.deliveryFee || 0)} Kč</span>
                                    </div>
                                    <div className="border rounded-2xl p-4 text-sm text-gray-500 italic">
                                        Editace položek košíku je dostupná v detailu objednávky v uživatelském rozhraní.
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
        </div>
    );
};
