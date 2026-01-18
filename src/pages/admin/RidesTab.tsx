
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { DeliveryType, OrderStatus, Ride, User, Order, PaymentMethod, Language } from '../../types';
import { Map, Truck, User as UserIcon, Calendar, Check, X, Clock, Navigation, AlertTriangle, Loader2, RefreshCw, List, History, Zap, Edit, Save, AlertCircle, Download } from 'lucide-react';
import { CustomCalendar } from '../../components/CustomCalendar';

// --- EDIT ORDER MODAL (Internal Component for RidesTab) ---
const QuickEditOrderModal: React.FC<{
    order: Order;
    onClose: () => void;
    onSave: (updatedOrder: Order) => Promise<void>;
    checkAvailability: any;
    settings: any;
    getDeliveryRegion: any;
    getRegionInfoForDate: any;
    getPickupPointInfo: any;
}> = ({ order, onClose, onSave, checkAvailability, settings, getDeliveryRegion, getRegionInfoForDate, getPickupPointInfo }) => {
    const [editingOrder, setEditingOrder] = useState<Order>(JSON.parse(JSON.stringify(order)));
    const [saveError, setSaveError] = useState<string | null>(null);

    const handleSave = async () => {
        setSaveError(null);
        
        // Basic Address Validation
        if (editingOrder.deliveryType === DeliveryType.DELIVERY) {
            if (!editingOrder.deliveryStreet) { setSaveError('Vyplňte ulici.'); return; }
            if (!editingOrder.deliveryCity) { setSaveError('Vyplňte město.'); return; }
            const region = getDeliveryRegion(editingOrder.deliveryZip || '');
            if (!region) { setSaveError(`Pro PSČ ${editingOrder.deliveryZip} neexistuje region.`); return; }
        }

        await onSave(editingOrder);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                        <Edit size={20} className="text-accent"/> Oprava objednávky #{editingOrder.id}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={24}/></button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-6 flex-grow">
                    {saveError && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700 text-sm font-bold flex items-center">
                            <AlertCircle size={18} className="mr-2"/> {saveError}
                        </div>
                    )}

                    <div className="space-y-2 p-4 bg-red-50 border border-red-100 rounded-xl">
                        <h3 className="text-sm font-bold text-red-800 uppercase">Doručovací údaje (Pro opravu trasy)</h3>
                        
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Jméno / Firma</label>
                            <input className="w-full border rounded p-2 text-sm" value={editingOrder.deliveryName || ''} onChange={e => setEditingOrder({...editingOrder, deliveryName: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Ulice a č.p.</label>
                            <input className="w-full border rounded p-2 text-sm font-bold" value={editingOrder.deliveryStreet || ''} onChange={e => setEditingOrder({...editingOrder, deliveryStreet: e.target.value})} autoFocus />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Město</label>
                                <input className="w-full border rounded p-2 text-sm" value={editingOrder.deliveryCity || ''} onChange={e => setEditingOrder({...editingOrder, deliveryCity: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">PSČ</label>
                                <input className="w-full border rounded p-2 text-sm" value={editingOrder.deliveryZip || ''} onChange={e => setEditingOrder({...editingOrder, deliveryZip: e.target.value})} />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Telefon</label>
                            <input className="w-full border rounded p-2 text-sm" value={editingOrder.deliveryPhone || ''} onChange={e => setEditingOrder({...editingOrder, deliveryPhone: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Poznámka pro řidiče</label>
                            <textarea className="w-full border rounded p-2 text-sm h-20" value={editingOrder.note || ''} onChange={e => setEditingOrder({...editingOrder, note: e.target.value})} />
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-gray-50 border-t flex gap-4">
                    <button onClick={onClose} className="flex-1 py-3 bg-white border rounded-xl font-bold text-sm uppercase transition text-gray-600">Zrušit</button>
                    <button onClick={handleSave} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm uppercase shadow-lg transition flex items-center justify-center gap-2 hover:bg-black">
                        <Save size={16}/> Uložit opravu
                    </button>
                </div>
            </div>
        </div>
    );
};

// ... RideDetail component ...
const RideDetail: React.FC<{
    date: string;
    onClose: () => void;
    onEditOrder: (orderId: string) => void;
}> = ({ date, onClose, onEditOrder }) => {
    const { orders, rides, allUsers, updateRide, t, formatDate, isOperationPending, refreshData, printRouteSheet } = useStore();
    const [isRefreshing, setIsRefreshing] = useState(true);
    
    useEffect(() => {
        const sync = async () => {
            await refreshData();
            setIsRefreshing(false);
        };
        sync();
    }, []);

    const drivers = useMemo(() => allUsers.filter(u => u.role === 'driver' && !u.isBlocked), [allUsers]);
    const dayRides = useMemo(() => rides.filter(r => r.date === date), [rides, date]);
    const dayOrders = useMemo(() => orders.filter(o => 
        o.deliveryDate === date && 
        o.deliveryType === DeliveryType.DELIVERY && 
        o.status !== OrderStatus.CANCELLED &&
        o.status !== OrderStatus.DELIVERED
    ), [orders, date]);

    const assignedOrderIds = useMemo(() => {
        const set = new Set<string>();
        dayRides.forEach(r => r.orderIds.forEach(id => set.add(id)));
        return set;
    }, [dayRides]);

    const unassignedOrders = useMemo(() => dayOrders.filter(o => !assignedOrderIds.has(o.id)), [dayOrders, assignedOrderIds]);

    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [selectedDriverId, setSelectedDriverId] = useState<string>('');

    const toggleOrderSelection = (id: string) => {
        const newSet = new Set(selectedOrderIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedOrderIds(newSet);
    };

    const handleCreateRide = async () => {
        if (!selectedDriverId || selectedOrderIds.size === 0) return;
        
        const existingRide = dayRides.find(r => r.driverId === selectedDriverId);
        
        if (existingRide) {
            const updatedRide: Ride = {
                ...existingRide,
                orderIds: [...existingRide.orderIds, ...Array.from(selectedOrderIds)],
                steps: [] // Reset steps to trigger re-calculation by worker
            };
            await updateRide(updatedRide);
        } else {
            const newRide: Ride = {
                id: `ride-${Date.now()}`,
                date,
                driverId: selectedDriverId,
                orderIds: Array.from(selectedOrderIds),
                status: 'planned',
                departureTime: '08:00',
                steps: [] // Empty steps -> Worker will pick it up
            };
            await updateRide(newRide);
        }
        
        setSelectedOrderIds(new Set());
        setSelectedDriverId('');
    };

    const handleRemoveOrderFromRide = async (ride: Ride, orderId: string) => {
        // Removing order resets route calculation
        const updatedRide = { 
            ...ride, 
            orderIds: ride.orderIds.filter(id => id !== orderId),
            steps: [] 
        };
        await updateRide(updatedRide);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 relative">
                
                {(isOperationPending || isRefreshing) && (
                    <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
                        <Loader2 className="animate-spin text-accent mb-2" size={48} />
                        <span className="text-gray-600 font-bold">
                            {isRefreshing ? 'Aktualizuji data z DB...' : 'Ukládám změny...'}
                        </span>
                    </div>
                )}

                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="text-xl font-bold flex items-center">
                        <Calendar className="mr-2 text-accent"/> Plánování jízd: {formatDate(date)}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full"><X size={24}/></button>
                </div>
                
                <div className="flex-grow flex overflow-hidden">
                    {/* LEFT: Unassigned Orders */}
                    <div className="w-1/3 border-r bg-gray-50 flex flex-col">
                        <div className="p-4 border-b bg-white font-bold text-gray-500 text-xs uppercase tracking-widest flex justify-between">
                            <span>Nepřiřazené objednávky ({unassignedOrders.length})</span>
                        </div>
                        <div className="flex-grow overflow-y-auto p-4 space-y-2">
                            {unassignedOrders.map(o => (
                                <div 
                                    key={o.id} 
                                    className={`p-3 rounded-lg border cursor-pointer transition ${selectedOrderIds.has(o.id) ? 'bg-purple-50 border-accent shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                                    onClick={() => toggleOrderSelection(o.id)}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedOrderIds.has(o.id) ? 'bg-accent border-accent' : 'border-gray-300'}`}>
                                                {selectedOrderIds.has(o.id) && <Check size={10} className="text-white"/>}
                                            </div>
                                            <span className="font-bold text-sm">#{o.id}</span>
                                        </div>
                                        <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{o.deliveryZip}</span>
                                    </div>
                                    <div className="mt-1 text-xs text-gray-600 truncate">{o.deliveryName}</div>
                                    <div className="text-[10px] text-gray-400 truncate">{o.deliveryStreet}, {o.deliveryCity}</div>
                                </div>
                            ))}
                            {unassignedOrders.length === 0 && <p className="text-center text-gray-400 text-sm mt-10">Vše přiřazeno</p>}
                        </div>
                        
                        {/* Assignment Controls */}
                        <div className="p-4 border-t bg-white">
                            <label className="text-xs font-bold text-gray-400 block mb-1">Přiřadit řidiči</label>
                            <div className="flex gap-2">
                                <select 
                                    className="flex-1 border rounded p-2 text-sm"
                                    value={selectedDriverId}
                                    onChange={e => setSelectedDriverId(e.target.value)}
                                >
                                    <option value="">-- Vyberte --</option>
                                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                                <button 
                                    disabled={!selectedDriverId || selectedOrderIds.size === 0}
                                    onClick={handleCreateRide}
                                    className="bg-primary text-white px-4 py-2 rounded-lg font-bold text-xs disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isOperationPending ? <Loader2 className="animate-spin" size={12}/> : null}
                                    Přiřadit
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Active Rides */}
                    <div className="w-2/3 bg-white flex flex-col">
                        <div className="p-4 border-b font-bold text-gray-500 text-xs uppercase tracking-widest">
                            Aktivní jízdy ({dayRides.length})
                        </div>
                        <div className="flex-grow overflow-y-auto p-6 space-y-6">
                            {dayRides.map(ride => {
                                const driver = drivers.find(d => d.id === ride.driverId) || allUsers.find(u => u.id === ride.driverId);
                                const driverName = driver?.name || 'Neznámý řidič';
                                const rideOrders = orders.filter(o => ride.orderIds.includes(o.id));
                                const pendingCalc = !ride.steps || ride.steps.length === 0;
                                const hasErrors = ride.steps?.some(s => s.error);
                                
                                return (
                                    <div key={ride.id} className={`border rounded-xl overflow-hidden shadow-sm ${hasErrors ? 'border-red-300 ring-2 ring-red-100' : ''}`}>
                                        <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border text-gray-500">
                                                    <UserIcon size={20}/>
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900">{driverName}</h3>
                                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                                        <span>{rideOrders.length} objednávek</span>
                                                        <span>•</span>
                                                        <span className="flex items-center"><Clock size={10} className="mr-1"/> Výjezd {ride.departureTime}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center gap-2">
                                                <button 
                                                    onClick={() => printRouteSheet(ride, driverName)}
                                                    className="p-1.5 bg-white border border-gray-200 rounded hover:bg-gray-100 text-gray-600 transition flex items-center justify-center"
                                                    title="Stáhnout PDF (Rozvozový list)"
                                                >
                                                    <Download size={14} />
                                                </button>
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${ride.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {ride.status === 'planned' ? 'Naplánováno' : ride.status === 'active' ? 'Na trase' : 'Dokončeno'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="p-0">
                                            {pendingCalc ? (
                                                <div className="p-4 text-center text-gray-400 text-xs flex flex-col items-center animate-pulse">
                                                    <RefreshCw size={16} className="mb-1 animate-spin-slow"/>
                                                    Jízda vytvořena. Čekám na automatický výpočet trasy (Worker)...
                                                </div>
                                            ) : (
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-gray-50/50 text-gray-400">
                                                        <tr>
                                                            <th className="p-3 font-medium">Čas</th>
                                                            <th className="p-3 font-medium">Adresa</th>
                                                            <th className="p-3 font-medium">Zákazník</th>
                                                            <th className="p-3 font-medium text-right">Akce</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {ride.steps?.filter(s => s.type === 'delivery').map((step, idx) => (
                                                            <tr 
                                                                key={idx} 
                                                                className={`hover:bg-gray-50 transition ${step.error ? 'bg-red-50 hover:bg-red-100 cursor-pointer' : ''}`}
                                                                onClick={() => step.error && onEditOrder(step.orderId)}
                                                                title={step.error ? 'Klikněte pro opravu adresy' : ''}
                                                            >
                                                                <td className="p-3 font-mono text-gray-500">{step.arrivalTime}</td>
                                                                <td className="p-3 font-medium text-gray-700 max-w-xs truncate">
                                                                    {step.error && (
                                                                        <div className="flex items-center text-red-600 mb-1 font-bold">
                                                                            <AlertTriangle size={12} className="mr-1"/> Chyba: {step.error}
                                                                        </div>
                                                                    )}
                                                                    {step.address}
                                                                </td>
                                                                <td className="p-3 text-gray-600">{step.customerName}</td>
                                                                <td className="p-3 text-right">
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); handleRemoveOrderFromRide(ride, step.orderId); }}
                                                                        className="text-red-400 hover:text-red-600 p-1"
                                                                        title="Odebrat z jízdy"
                                                                    >
                                                                        <X size={14}/>
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {dayRides.length === 0 && (
                                <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">
                                    <Truck size={48} className="mx-auto mb-2 opacity-20"/>
                                    <p>Žádné naplánované jízdy pro tento den.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const RidesTab: React.FC = () => {
    const { orders, rides, t, formatDate, allUsers, refreshData, updateRide, updateOrder, checkAvailability, settings, getDeliveryRegion, getRegionInfoForDate, getPickupPointInfo } = useStore();
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<'current' | 'history' | 'generation'>('current');
    const [historyMonth, setHistoryMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Edit Order State
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Auto-refresh when checking Generation tab
    useEffect(() => {
        let interval: any;
        if (activeSubTab === 'generation') {
            refreshData(); // Immediate load
            interval = setInterval(refreshData, 10000); // Polling every 10s for status updates
        }
        return () => clearInterval(interval);
    }, [activeSubTab]);

    const filteredDates = useMemo(() => {
        const dates = new Set<string>();
        orders.forEach(o => {
            if (o.deliveryType === DeliveryType.DELIVERY && o.status !== OrderStatus.CANCELLED) {
                dates.add(o.deliveryDate);
            }
        });
        
        const dateArray = Array.from(dates);
        const today = new Date().toISOString().split('T')[0];

        if (activeSubTab === 'current') {
            // Future & Today, Ascending
            return dateArray.filter(d => d >= today).sort();
        } else if (activeSubTab === 'history') {
            // Selected Month, Descending
            return dateArray.filter(d => d.startsWith(historyMonth)).sort().reverse();
        }
        return [];
    }, [orders, activeSubTab, historyMonth]);

    // Show ALL rides in Generation tab, sorted by newest
    const allGenerationRides = useMemo(() => {
        return [...rides].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    }, [rides]);

    const handleRecalculateRide = async (ride: Ride) => {
        if (!confirm('Opravdu chcete přepočítat trasu? Tím se resetují aktuální kroky.')) return;
        
        // Reset steps and set status to planned -> worker will pick it up
        await updateRide({
            ...ride,
            steps: [], 
            status: 'planned'
        });
    };

    const handleOpenEditOrder = (orderId: string) => {
        const o = orders.find(ord => ord.id === orderId);
        if (o) {
            setEditingOrder(JSON.parse(JSON.stringify(o)));
            setIsEditModalOpen(true);
        }
    };

    const handleSaveOrder = async (updatedOrder: Order) => {
        await updateOrder(updatedOrder, false, true);
        setIsEditModalOpen(false);
        
        // AUTOMATIC RECALCULATION TRIGGER
        // If this order belongs to a pending/planned ride, reset steps so worker picks up new address
        const rideToReset = rides.find(r => 
            r.status === 'planned' && 
            r.orderIds.includes(updatedOrder.id)
        );

        if (rideToReset) {
            await updateRide({ ...rideToReset, steps: [] }); 
        }

        await refreshData();
    };

    const countErrors = (ride: Ride) => {
        return ride.steps?.filter(s => s.error).length || 0;
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-xl font-bold text-primary flex items-center">
                    <Map className="mr-2 text-accent" /> {t('admin.rides')}
                </h2>
                
                {/* SUBTABS */}
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveSubTab('current')} 
                        className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${activeSubTab === 'current' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                        <List size={14}/> Aktuální
                    </button>
                    <button 
                        onClick={() => setActiveSubTab('history')} 
                        className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${activeSubTab === 'history' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                        <History size={14}/> Historie
                    </button>
                    <button 
                        onClick={() => setActiveSubTab('generation')} 
                        className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${activeSubTab === 'generation' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                        <Zap size={14}/> Generace jízd
                    </button>
                </div>
            </div>

            {/* HISTORY FILTER */}
            {activeSubTab === 'history' && (
                <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4 animate-in slide-in-from-top-2">
                    <label className="text-sm font-bold text-gray-600">Vyberte měsíc:</label>
                    <input 
                        type="month" 
                        className="border rounded-lg p-2 text-sm" 
                        value={historyMonth} 
                        onChange={e => setHistoryMonth(e.target.value)} 
                    />
                </div>
            )}

            {/* GENERATION VIEW */}
            {activeSubTab === 'generation' && (
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden animate-in fade-in">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-700 text-sm uppercase">Všechny jízdy (Worker Log)</h3>
                        <button onClick={refreshData} className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"><RefreshCw size={12}/> Obnovit</button>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                            <tr>
                                <th className="px-6 py-3 text-left">ID Jízdy</th>
                                <th className="px-6 py-3 text-left">Datum</th>
                                <th className="px-6 py-3 text-left">Řidič</th>
                                <th className="px-6 py-3 text-center">Objednávek</th>
                                <th className="px-6 py-3 text-center">Chyby</th>
                                <th className="px-6 py-3 text-left">Stav</th>
                                <th className="px-6 py-3 text-right">Akce</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                            {allGenerationRides.map(ride => {
                                const driver = allUsers.find(u => u.id === ride.driverId);
                                const pendingCalc = ride.status === 'planned' && (!ride.steps || ride.steps.length === 0);
                                const errors = countErrors(ride);

                                return (
                                    <tr key={ride.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-mono">{ride.id}</td>
                                        <td className="px-6 py-4 font-bold">{formatDate(ride.date)}</td>
                                        <td className="px-6 py-4">{driver?.name || ride.driverId}</td>
                                        <td className="px-6 py-4 text-center">{ride.orderIds.length}</td>
                                        <td className="px-6 py-4 text-center">
                                            {errors > 0 ? (
                                                <span className="text-red-600 font-bold flex items-center justify-center gap-1"><AlertCircle size={14}/> {errors}</span>
                                            ) : (
                                                <span className="text-green-500 font-bold">0</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {pendingCalc ? (
                                                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-[10px] font-bold flex items-center w-fit">
                                                    <Loader2 size={10} className="animate-spin mr-1"/> Čeká na výpočet
                                                </span>
                                            ) : (
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase w-fit ${ride.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                                    {ride.status === 'active' ? 'Vypočteno / Na trase' : ride.status === 'planned' ? 'Naplánováno' : 'Dokončeno'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleRecalculateRide(ride)}
                                                className="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition"
                                                title="Přepočítat trasu (resetovat na pending)"
                                            >
                                                <RefreshCw size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {allGenerationRides.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-gray-400">
                                        Žádné jízdy.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* RIDES GRID (Current & History) */}
            {activeSubTab !== 'generation' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDates.map(date => {
                        const dayOrders = orders.filter(o => o.deliveryDate === date && o.deliveryType === DeliveryType.DELIVERY && o.status !== OrderStatus.CANCELLED);
                        const dayRides = rides.filter(r => r.date === date);
                        const assignedCount = dayRides.reduce((acc, r) => acc + r.orderIds.length, 0);
                        const unassignedCount = Math.max(0, dayOrders.length - assignedCount);
                        
                        return (
                            <div 
                                key={date} 
                                onClick={() => setSelectedDate(date)}
                                className="bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition cursor-pointer group animate-in zoom-in-95 duration-200 relative overflow-hidden"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-mono font-bold text-lg text-primary group-hover:text-accent transition">{formatDate(date)}</h3>
                                        <div className="text-xs text-gray-500 mt-1">{dayOrders.length} rozvozů celkem</div>
                                    </div>
                                    <div className="bg-gray-50 p-2 rounded-lg">
                                        <Truck size={20} className="text-gray-400"/>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Naplánováno:</span>
                                        <span className="font-bold text-green-600">{assignedCount}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Nepřiřazeno:</span>
                                        <span className={`font-bold ${unassignedCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>{unassignedCount}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Jízd:</span>
                                        <span className="font-bold text-primary">{dayRides.length}</span>
                                    </div>
                                </div>
                                
                                <div className="mt-4 pt-3 border-t">
                                    <div className="text-xs text-gray-400 font-bold uppercase mb-1">Řidiči</div>
                                    <div className="flex -space-x-2 overflow-hidden py-1">
                                        {dayRides.length > 0 ? dayRides.map(r => {
                                            const errCount = countErrors(r);
                                            return (
                                                <div key={r.id} className="relative">
                                                    <div className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-[10px] border-2 border-white relative z-10">
                                                        <UserIcon size={12}/>
                                                    </div>
                                                    {errCount > 0 && (
                                                        <div className="absolute -top-1 -right-1 z-20 w-3 h-3 bg-red-500 rounded-full border border-white flex items-center justify-center">
                                                            <span className="text-[8px] font-bold text-white">!</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }) : (
                                            <span className="text-xs text-gray-300 italic">Zatím nikdo</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    {filteredDates.length === 0 && (
                        <div className="col-span-full p-12 text-center text-gray-400">
                            {activeSubTab === 'history' ? 'V tomto měsíci neproběhly žádné rozvozy.' : 'Zatím žádné nadcházející rozvozy.'}
                        </div>
                    )}
                </div>
            )}

            {selectedDate && (
                <RideDetail 
                    date={selectedDate} 
                    onClose={() => setSelectedDate(null)} 
                    onEditOrder={handleOpenEditOrder}
                />
            )}

            {isEditModalOpen && editingOrder && (
                <QuickEditOrderModal 
                    order={editingOrder} 
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleSaveOrder}
                    checkAvailability={checkAvailability}
                    settings={settings}
                    getDeliveryRegion={getDeliveryRegion}
                    getRegionInfoForDate={getRegionInfoForDate}
                    getPickupPointInfo={getPickupPointInfo}
                />
            )}
        </div>
    );
};
