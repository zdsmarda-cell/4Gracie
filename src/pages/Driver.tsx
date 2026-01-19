
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { Order, OrderStatus, Product, Ride, RideStep } from '../types';
import { Phone, MapPin, Navigation as Map, CheckCircle, XCircle, Ban, AlertTriangle, Package, Check, Eye, ArrowLeft, RefreshCw, Calendar, ChevronRight, Play, Flag, Download, Loader2, Info, ArrowDown, X, Clock } from 'lucide-react';
import { calculatePackageCountLogic } from '../utils/orderLogic';

// Reused Component from RidesTab (Ideally move to components folder, but kept here for instruction scope)
const TimeAnalysisTooltip: React.FC<{
    step: RideStep;
    prevDepartureTime: string;
    settings: any;
    onClose: () => void;
}> = ({ step, prevDepartureTime, settings, onClose }) => {
    const logistics = settings.logistics || { stopTimeMinutes: 5, loadingSecondsPerItem: 30, unloadingPaidSeconds: 120, unloadingUnpaidSeconds: 300 };
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const toTime = (m: number) => { const h = Math.floor(m / 60) % 24; const min = Math.round(m % 60); return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`; };

    const arrivalMin = toMin(step.arrivalTime);
    const prevDepMin = toMin(prevDepartureTime);
    let travelTime = arrivalMin - prevDepMin;
    if (travelTime < 0) travelTime += 24 * 60;

    const itemsCount = step.itemsCount || 0;
    const baseStop = logistics.stopTimeMinutes;
    const itemsTime = (itemsCount * logistics.loadingSecondsPerItem) / 60;
    const paymentTime = (step.isPaid ? logistics.unloadingPaidSeconds : logistics.unloadingUnpaidSeconds) / 60;
    const totalService = baseStop + itemsTime + paymentTime;
    const calcDeparture = toTime(arrivalMin + totalService);

    return (
        <div className="absolute z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-64 text-xs text-gray-700 top-8 left-0 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2 border-b pb-2">
                <h4 className="font-bold text-primary flex items-center"><Clock size={12} className="mr-1"/> Analýza času</h4>
                <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="hover:bg-gray-100 p-1 rounded"><X size={12}/></button>
            </div>
            
            <div className="space-y-1.5">
                <div className="flex justify-between text-gray-500"><span>Odjezd (předchozí):</span><span className="font-mono">{prevDepartureTime}</span></div>
                <div className="flex justify-between items-center text-blue-600"><span className="flex items-center"><ArrowDown size={10} className="mr-1"/> Cesta:</span><span className="font-bold">{Math.round(travelTime)} min</span></div>
                <div className="flex justify-between border-t border-dashed pt-1 mt-1"><span className="font-bold">Příjezd:</span><span className="font-bold font-mono text-sm">{step.arrivalTime}</span></div>
                
                <div className="bg-gray-50 p-2 rounded mt-2 border border-gray-100 space-y-1">
                    <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Servis na místě</div>
                    <div className="flex justify-between"><span>Stop:</span><span>{baseStop} min</span></div>
                    <div className="flex justify-between"><span>Balíky ({itemsCount} ks):</span><span>{itemsTime.toFixed(1)} min</span></div>
                    <div className="flex justify-between"><span>Platba:</span><span>{paymentTime.toFixed(1)} min</span></div>
                    <div className="flex justify-between border-t border-gray-200 pt-1 font-bold text-primary"><span>Celkem:</span><span>{Math.round(totalService)} min</span></div>
                </div>

                <div className="flex justify-between border-t pt-2 mt-2"><span className="font-bold text-gray-500">Odjezd:</span><span className="font-mono font-bold">{step.departureTime}</span></div>
            </div>
        </div>
    );
};

export const Driver: React.FC = () => {
    const { user, rides, orders, products, updateOrderStatus, settings, formatDate, isPreviewEnvironment, refreshData, updateRide, printRouteSheet, t } = useStore();
    const [modalState, setModalState] = useState<{ type: 'complete' | 'fail' | 'start' | 'finish', orderId?: string } | null>(null);
    const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTooltipOrder, setActiveTooltipOrder] = useState<string | null>(null);
    const wakeLockRef = useRef<any>(null);

    // --- AUTO REFRESH ON MOUNT ---
    useEffect(() => {
        const load = async () => {
            setIsRefreshing(true);
            await refreshData();
            setIsRefreshing(false);
        };
        load();
    }, []);

    // --- WAKE LOCK API ---
    useEffect(() => {
        const requestWakeLock = async () => {
            if ('wakeLock' in navigator) {
                try {
                    const lock = await (navigator as any).wakeLock.request('screen');
                    wakeLockRef.current = lock;
                    lock.addEventListener('release', () => {});
                } catch (err: any) {
                    console.error(`❌ Wake Lock error: ${err.name}, ${err.message}`);
                }
            }
        };

        const handleVisibilityChange = async () => {
            if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
                await requestWakeLock();
            }
        };

        requestWakeLock();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (wakeLockRef.current) {
                wakeLockRef.current.release();
                wakeLockRef.current = null;
            }
        };
    }, []);

    // Get all rides relevant for this driver
    const myRides = useMemo(() => {
        if (!user) return [];
        let relevantRides = rides.filter(r => r.driverId === user.id);
        return relevantRides.sort((a, b) => a.date.localeCompare(b.date));
    }, [rides, user]);

    // Auto-select active ride
    useEffect(() => {
        const activeRide = myRides.find(r => r.status === 'active');
        if (activeRide && !selectedRideId) {
            setSelectedRideId(activeRide.id);
        }
    }, [myRides]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refreshData();
        setIsRefreshing(false);
    };

    const currentRide = useMemo(() => myRides.find(r => r.id === selectedRideId), [myRides, selectedRideId]);
    
    // Check if another ride is active
    const hasOtherActiveRide = useMemo(() => myRides.some(r => r.status === 'active' && r.id !== selectedRideId), [myRides, selectedRideId]);

    // Check if current ride can be finished (all orders resolved)
    const canFinishRide = useMemo(() => {
        if (!currentRide) return false;
        return currentRide.orderIds.every(id => {
            const o = orders.find(ord => ord.id === id);
            if (!o) return true; // Missing order considered done to unblock
            return o.status === OrderStatus.DELIVERED || o.status === OrderStatus.NOT_PICKED_UP || o.status === OrderStatus.CANCELLED;
        });
    }, [currentRide, orders]);

    const activeStopId = useMemo(() => {
        if (!currentRide || !currentRide.steps) return null;
        for (const step of currentRide.steps) {
            if (step.type === 'delivery') {
                const order = orders.find(o => o.id === step.orderId);
                if (order && order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.NOT_PICKED_UP) {
                    return step.orderId;
                }
            }
        }
        return null;
    }, [currentRide, orders]);

    const isDeliveryLate = (arrivalTime: string, order: Order) => {
        if (!settings.deliveryRegions || !order.deliveryZip) return false;
        const region = settings.deliveryRegions.find(r => r.enabled && r.zips.includes(order.deliveryZip!.replace(/\s/g, '')));
        if (!region) return false;
        
        const ex = region.exceptions?.find(e => e.date === order.deliveryDate);
        const endTime = (ex && ex.isOpen) ? ex.deliveryTimeEnd : region.deliveryTimeEnd;
        
        return endTime ? arrivalTime > endTime : false;
    };

    const getOrderAmountToPay = (order: Order) => {
        const discount = order.appliedDiscounts?.reduce((sum, d) => sum + d.amount, 0) || 0;
        return Math.max(0, order.totalPrice - discount) + order.packagingFee + (order.deliveryFee || 0);
    };

    // --- ACTIONS ---

    const handleNavigation = (address: string, orderId: string) => {
        const encoded = encodeURIComponent(address);
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
    };

    const handleStartRide = async () => {
        if (!currentRide) return;
        
        // 1. Update Ride Status
        const updatedRide = { ...currentRide, status: 'active' as const };
        await updateRide(updatedRide);
        
        // 2. Update All Orders to ON_WAY and Notify
        // This triggers email/push notification to customers
        if (currentRide.orderIds.length > 0) {
            await updateOrderStatus(currentRide.orderIds, OrderStatus.ON_WAY, true, true);
        }
        
        setModalState(null);
        handleRefresh(); // Refresh to reflect status changes
    };

    const handleFinishRide = async () => {
        if (!currentRide) return;
        const updatedRide = { ...currentRide, status: 'completed' as const };
        await updateRide(updatedRide);
        setModalState(null);
        setSelectedRideId(null);
    };

    const handleStatusUpdate = async () => {
        if (!modalState || !modalState.orderId) return;
        const newStatus = modalState.type === 'complete' ? OrderStatus.DELIVERED : OrderStatus.NOT_PICKED_UP;
        await updateOrderStatus([modalState.orderId], newStatus, true, true);
        setModalState(null);
    };

    const updateDepartureTime = async (newTime: string) => {
        if (!currentRide) return;
        // Update ride with new time - backend worker will pick it up and recalculate if planned
        const updated = { ...currentRide, departureTime: newTime, steps: [] }; // Reset steps to force recalc
        await updateRide(updated);
    };

    if (!user || user.role !== 'driver') {
        return <div className="p-8 text-center text-gray-500">Přístup pouze pro řidiče.</div>;
    }

    // --- LIST VIEW ---
    if (!selectedRideId) {
        return (
            <div className="max-w-2xl mx-auto p-4 animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-serif font-bold text-primary">Moje jízdy</h1>
                    <button onClick={handleRefresh} disabled={isRefreshing} className="bg-white p-2 rounded-full shadow-sm border border-gray-200 text-gray-600 hover:text-accent disabled:opacity-50 transition"><RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} /></button>
                </div>
                <div className="space-y-3">
                    {myRides.length === 0 ? (
                        <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-gray-200"><Map size={32} className="text-gray-400 mx-auto mb-2"/><h2 className="text-lg font-bold text-gray-600">Žádné jízdy</h2></div>
                    ) : (
                        myRides.map(ride => {
                            const stopCount = ride.steps?.filter(s => s.type === 'delivery').length || 0;
                            const isPending = ride.status === 'planned' && (!ride.steps || ride.steps.length === 0);

                            return (
                                <div key={ride.id} onClick={() => setSelectedRideId(ride.id)} className={`bg-white p-5 rounded-2xl border shadow-sm cursor-pointer hover:shadow-md transition active:scale-[0.98] ${ride.status === 'active' ? 'border-l-4 border-l-green-500 ring-1 ring-green-100' : 'border-l-4 border-l-blue-500'}`}>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-3 rounded-xl ${ride.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}><Calendar size={20} /></div>
                                            <div>
                                                <div className="flex items-center gap-2"><span className="font-bold text-lg text-gray-900">{formatDate(ride.date)}</span></div>
                                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                    {isPending ? (
                                                        <span className="text-orange-500 font-bold flex items-center animate-pulse"><Loader2 size={10} className="animate-spin mr-1"/> Čeká na výpočet trasy</span>
                                                    ) : (
                                                        <><span>{stopCount} zastávek</span><span>•</span><span>Start: {ride.departureTime}</span></>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight size={20} className="text-gray-300" />
                                    </div>
                                    <div className="mt-3 pt-3 border-t flex justify-between items-center">
                                        <span className={`text-xs font-bold uppercase ${ride.status === 'active' ? 'text-green-600' : ride.status === 'completed' ? 'text-gray-400' : 'text-blue-600'}`}>{ride.status === 'active' ? '● Probíhá' : ride.status === 'completed' ? 'Dokončeno' : 'Naplánováno'}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    }

    // --- DETAIL VIEW ---
    if (!currentRide) return null;
    
    // Check if ride is pending calculation
    const isPendingCalculation = currentRide.status === 'planned' && (!currentRide.steps || currentRide.steps.length === 0);

    return (
        <div className="max-w-2xl mx-auto pb-32 animate-in slide-in-from-right-8 duration-300" onClick={() => setActiveTooltipOrder(null)}>
            <div className="bg-white p-4 sticky top-16 md:top-20 z-40 border-b shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedRideId(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition"><ArrowLeft size={24} /></button>
                    <div>
                        <h1 className="text-lg font-bold text-primary">{formatDate(currentRide.date)}</h1>
                        {/* Time Edit */}
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>Výjezd:</span>
                            <input 
                                type="time" 
                                className="border rounded px-1 py-0.5 bg-gray-50 font-mono"
                                value={currentRide.departureTime}
                                onChange={e => updateDepartureTime(e.target.value)}
                                disabled={currentRide.status !== 'planned'}
                            />
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => printRouteSheet(currentRide, user.name)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-600"><Download size={20}/></button>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase flex items-center ${currentRide.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                        {currentRide.status === 'active' ? 'Na trase' : 'Plán'}
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-1">
                {isPendingCalculation && (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center animate-pulse">
                        <Loader2 size={48} className="text-accent mb-4 animate-spin" />
                        <h3 className="font-bold text-lg">Probíhá výpočet trasy...</h3>
                        <p className="text-sm mt-2">Prosím vyčkejte. Trasa se optimalizuje na serveru.</p>
                        <button onClick={handleRefresh} className="mt-6 text-blue-600 font-bold underline">Zkusit aktualizovat</button>
                    </div>
                )}

                {!isPendingCalculation && currentRide.steps?.map((step, idx) => {
                        const isDepot = step.type === 'pickup';
                        if (isDepot) return null; 
                        const order = orders.find(o => o.id === step.orderId);
                        if (!order) return null;
                        const isClosed = ['delivered', 'cancelled', 'not_picked_up'].includes(order.status);
                        const isLast = idx === (currentRide.steps?.length || 0) - 1;
                        const isActive = activeStopId === step.orderId;
                        const isLate = isDeliveryLate(step.arrivalTime, order);
                        const enrichedItems = order.items.map(i => { const p = products.find(prod => prod.id === i.id); return { ...i, volume: p?.volume || i.volume || 0 }; });
                        const pkgCount = calculatePackageCountLogic(enrichedItems, settings.packaging.types);
                        const showCod = !order.isPaid && !isClosed;
                        const amountToPay = showCod ? getOrderAmountToPay(order) : 0;
                        
                        // Previous Departure
                        const stepIndex = currentRide.steps!.indexOf(step);
                        const prevStep = stepIndex > 0 ? currentRide.steps![stepIndex - 1] : null;
                        const prevDeparture = prevStep ? prevStep.departureTime : currentRide.departureTime;

                        return (
                            <div key={idx} className={`relative pl-10 ${isClosed ? 'opacity-50 grayscale' : ''}`}>
                                <div className={`absolute left-2.5 top-6 w-3 h-3 rounded-full border-2 border-white z-10 transform -translate-x-1/2 ${order.status === 'delivered' ? 'bg-green-500' : (order.status === 'not_picked_up' || order.status === 'cancelled') ? 'bg-red-500' : 'bg-accent'}`}></div>
                                {!isLast && <div className="absolute left-4 top-6 bottom-[-24px] w-0.5 bg-gray-200 z-0"></div>}
                                
                                {/* Time Badge with Clickable Tooltip */}
                                <div 
                                    className={`absolute left-0 top-0 text-[10px] font-mono font-bold px-1 border rounded shadow-sm z-10 cursor-pointer transition active:scale-95 ${isLate && !isClosed ? 'bg-red-600 text-white border-red-600 animate-pulse' : 'bg-white text-gray-500 hover:text-blue-600 hover:border-blue-400'}`}
                                    onClick={(e) => { e.stopPropagation(); setActiveTooltipOrder(activeTooltipOrder === order.id ? null : order.id); }}
                                >
                                    {step.arrivalTime}
                                </div>
                                
                                {activeTooltipOrder === order.id && (
                                    <TimeAnalysisTooltip 
                                        step={step} 
                                        prevDepartureTime={prevDeparture} 
                                        settings={settings}
                                        onClose={() => setActiveTooltipOrder(null)}
                                    />
                                )}

                                <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden mt-3 transition-all duration-300 ${isActive ? 'ring-2 ring-blue-400 border-blue-400 transform scale-[1.02]' : ''}`}>
                                    <div className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="text-[10px] text-gray-400 font-mono mb-0.5">#{order.id}</div>
                                                <div className="font-bold text-lg">{step.customerName}</div>
                                                {step.customerPhone && <a href={`tel:${step.customerPhone}`} className="inline-block mt-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold flex items-center hover:bg-blue-100 transition"><Phone size={14} className="mr-2"/> {step.customerPhone}</a>}
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <div className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center mb-1"><Package size={10} className="mr-1"/> {pkgCount} {pkgCount === 1 ? 'balík' : 'balíků'}</div>
                                                {!isClosed && (showCod ? <div className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-xs border border-red-100 mt-1">Dobírka: {amountToPay} Kč</div> : <div className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded border border-green-100 mt-1">Zaplaceno</div>)}
                                            </div>
                                        </div>
                                        <div className="space-y-2 mb-4 text-sm text-gray-600">
                                            <div className="flex items-start"><MapPin size={16} className={`mr-2 mt-0.5 flex-shrink-0 ${step.error ? 'text-red-500' : 'text-gray-400'}`}/><div><div className={`font-medium ${step.error ? 'text-red-700 font-bold' : 'text-gray-800'}`}>{step.address}</div>{step.error && <div className="text-red-600 text-xs font-bold mt-1 bg-red-50 p-1 rounded">CHYBA: {step.error}</div>}</div></div>
                                            {step.note && <div className="bg-yellow-50 p-2 rounded text-xs text-yellow-800 border border-yellow-100 mt-2">{step.note}</div>}
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => handleNavigation(step.address, step.orderId)} disabled={isClosed || currentRide.status !== 'active'} className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-bold transition ${isClosed ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 hover:bg-blue-100 text-blue-700'}`}><Map size={20} className="mb-1"/> Navigovat</button>
                                            {!isClosed ? (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button onClick={() => setModalState({ type: 'fail', orderId: step.orderId })} disabled={currentRide.status !== 'active'} className="flex flex-col items-center justify-center p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition disabled:opacity-50"><XCircle size={20} className="mb-1"/> Nedoručeno</button>
                                                    <button onClick={() => setModalState({ type: 'complete', orderId: step.orderId })} disabled={currentRide.status !== 'active'} className="flex flex-col items-center justify-center p-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition disabled:opacity-50"><Check size={20} className="mb-1"/> Hotovo</button>
                                                </div>
                                            ) : <div className="flex flex-col items-center justify-center p-2 bg-gray-100 text-gray-500 rounded-xl text-xs font-bold"><Check size={20} className="mb-1"/> Hotovo</div>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
            </div>

            {/* FLOATING ACTION BUTTONS */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg z-50 flex gap-4 justify-center">
                {currentRide.status === 'planned' && (
                    <button 
                        onClick={() => setModalState({ type: 'start' })}
                        disabled={hasOtherActiveRide || isPendingCalculation}
                        className="bg-primary text-white w-full max-w-md py-4 rounded-xl font-bold text-lg shadow-xl flex items-center justify-center gap-2 disabled:bg-gray-400"
                    >
                        {hasOtherActiveRide ? 'Jiná jízda je aktivní' : <><Play size={24}/> Zahájit jízdu</>}
                    </button>
                )}
                {currentRide.status === 'active' && (
                    <button 
                        onClick={() => setModalState({ type: 'finish' })}
                        disabled={!canFinishRide}
                        className="bg-green-600 text-white w-full max-w-md py-4 rounded-xl font-bold text-lg shadow-xl flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:text-gray-500"
                    >
                        <Flag size={24}/> Ukončit jízdu
                    </button>
                )}
            </div>

            {/* MODAL */}
            {modalState && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
                        <h3 className="text-xl font-bold mb-4">
                            {modalState.type === 'start' ? 'Zahájit jízdu?' : modalState.type === 'finish' ? 'Ukončit jízdu?' : 'Potvrzení'}
                        </h3>
                        <p className="text-gray-500 mb-6">
                            {modalState.type === 'start' && 'Objednávky se přepnou do stavu "Na cestě" a odešlou se notifikace zákazníkům.'}
                            {modalState.type === 'finish' && 'Jízda bude uzavřena. Ujistěte se, že jsou všechny zastávky vyřešeny.'}
                            {(modalState.type === 'complete' || modalState.type === 'fail') && 'Opravdu chcete změnit stav objednávky?'}
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setModalState(null)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-600">Zrušit</button>
                            <button 
                                onClick={() => {
                                    if (modalState.type === 'start') handleStartRide();
                                    else if (modalState.type === 'finish') handleFinishRide();
                                    else handleStatusUpdate();
                                }} 
                                className="flex-1 py-3 bg-primary text-white rounded-xl font-bold"
                            >
                                Potvrdit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
