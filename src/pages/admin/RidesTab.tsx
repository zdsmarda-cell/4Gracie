
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { DeliveryType, OrderStatus, Ride, User } from '../../types';
import { Map, Truck, User as UserIcon, Calendar, Check, X, Clock, Navigation, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

const RideDetail: React.FC<{
    date: string;
    onClose: () => void;
}> = ({ date, onClose }) => {
    const { orders, rides, allUsers, updateRide, t, formatDate, isOperationPending, refreshData } = useStore();
    const [isRefreshing, setIsRefreshing] = useState(true);
    
    // Refresh data on mount to ensure fresh drivers and orders list
    useEffect(() => {
        const sync = async () => {
            await refreshData();
            setIsRefreshing(false);
        };
        sync();
    }, []);

    // Filter active drivers
    const drivers = useMemo(() => allUsers.filter(u => u.role === 'driver' && !u.isBlocked), [allUsers]);
    
    // Get existing rides for this date
    const dayRides = useMemo(() => rides.filter(r => r.date === date), [rides, date]);
    
    // Get all delivery orders for this date
    const dayOrders = useMemo(() => orders.filter(o => 
        o.deliveryDate === date && 
        o.deliveryType === DeliveryType.DELIVERY && 
        o.status !== OrderStatus.CANCELLED &&
        o.status !== OrderStatus.DELIVERED
    ), [orders, date]);

    // Assigned Order IDs across all rides today
    const assignedOrderIds = useMemo(() => {
        const set = new Set<string>();
        dayRides.forEach(r => r.orderIds.forEach(id => set.add(id)));
        return set;
    }, [dayRides]);

    // Unassigned Orders
    const unassignedOrders = useMemo(() => dayOrders.filter(o => !assignedOrderIds.has(o.id)), [dayOrders, assignedOrderIds]);

    // State for creating/editing rides
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
        
        // Check if driver already has a ride today
        const existingRide = dayRides.find(r => r.driverId === selectedDriverId);
        
        if (existingRide) {
            // Update existing ride
            const updatedRide: Ride = {
                ...existingRide,
                orderIds: [...existingRide.orderIds, ...Array.from(selectedOrderIds)]
            };
            await updateRide(updatedRide);
        } else {
            // Create new ride
            const newRide: Ride = {
                id: `ride-${Date.now()}`,
                date,
                driverId: selectedDriverId,
                orderIds: Array.from(selectedOrderIds),
                status: 'planned',
                departureTime: '08:00' // Default start
            };
            await updateRide(newRide);
        }
        
        setSelectedOrderIds(new Set());
        setSelectedDriverId('');
    };

    const handleRemoveOrderFromRide = async (ride: Ride, orderId: string) => {
        const updatedRide = { ...ride, orderIds: ride.orderIds.filter(id => id !== orderId) };
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
                                // FIX: Use d.id instead of d.driverId
                                const driver = drivers.find(d => d.id === ride.driverId) || allUsers.find(u => u.id === ride.driverId);
                                const rideOrders = orders.filter(o => ride.orderIds.includes(o.id));
                                
                                return (
                                    <div key={ride.id} className="border rounded-xl overflow-hidden shadow-sm">
                                        <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border text-gray-500">
                                                    <UserIcon size={20}/>
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900">{driver?.name || 'Neznámý řidič'}</h3>
                                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                                        <span>{rideOrders.length} objednávek</span>
                                                        <span>•</span>
                                                        <span className="flex items-center"><Clock size={10} className="mr-1"/> Výjezd {ride.departureTime}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${ride.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {ride.status === 'planned' ? 'Naplánováno' : ride.status === 'active' ? 'Na trase' : 'Dokončeno'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="p-0">
                                            {(!ride.steps || ride.steps.length === 0) ? (
                                                <div className="p-4 text-center text-gray-400 text-xs flex flex-col items-center">
                                                    <RefreshCw size={16} className="mb-1 animate-spin-slow"/>
                                                    Optimalizuji trasu... (čekám na worker)
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
                                                            <tr key={idx} className={`hover:bg-gray-50 ${step.error ? 'bg-red-50' : ''}`}>
                                                                <td className="p-3 font-mono text-gray-500">{step.arrivalTime}</td>
                                                                <td className="p-3 font-medium text-gray-700 max-w-xs truncate" title={step.address}>
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
                                                                        onClick={() => handleRemoveOrderFromRide(ride, step.orderId)}
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
    const { orders, rides, t, formatDate } = useStore();
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Get unique dates with delivery orders
    const deliveryDates = useMemo(() => {
        const dates = new Set<string>();
        orders.forEach(o => {
            if (o.deliveryType === DeliveryType.DELIVERY && o.status !== OrderStatus.CANCELLED) {
                dates.add(o.deliveryDate);
            }
        });
        return Array.from(dates).sort().reverse();
    }, [orders]);

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-primary flex items-center">
                    <Map className="mr-2 text-accent" /> {t('admin.rides')}
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {deliveryDates.map(date => {
                    const dayOrders = orders.filter(o => o.deliveryDate === date && o.deliveryType === DeliveryType.DELIVERY && o.status !== OrderStatus.CANCELLED);
                    const dayRides = rides.filter(r => r.date === date);
                    const assignedCount = dayRides.reduce((acc, r) => acc + r.orderIds.length, 0);
                    const unassignedCount = dayOrders.length - assignedCount;
                    
                    return (
                        <div 
                            key={date} 
                            onClick={() => setSelectedDate(date)}
                            className="bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition cursor-pointer group"
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
                                <div className="flex -space-x-2">
                                    {dayRides.length > 0 ? dayRides.map(r => (
                                        <div key={r.id} className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-[10px] border-2 border-white" title={r.driverId}>
                                            <UserIcon size={12}/>
                                        </div>
                                    )) : (
                                        <span className="text-xs text-gray-300 italic">Zatím nikdo</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {deliveryDates.length === 0 && (
                    <div className="col-span-full p-12 text-center text-gray-400">
                        Zatím žádné objednávky k rozvozu.
                    </div>
                )}
            </div>

            {selectedDate && (
                <RideDetail date={selectedDate} onClose={() => setSelectedDate(null)} />
            )}
        </div>
    );
};
