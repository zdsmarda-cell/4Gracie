import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { Order, OrderStatus, Product } from '../types';
import { Phone, MapPin, Navigation as Map, CheckCircle, XCircle, Ban, AlertTriangle, Package, Check, Eye } from 'lucide-react';
import { calculatePackageCountLogic } from '../utils/orderLogic';

export const Driver: React.FC = () => {
    const { user, rides, orders, products, updateOrderStatus, settings, formatDate, isPreviewEnvironment } = useStore();
    const [modalState, setModalState] = useState<{ type: 'complete' | 'fail', orderId: string } | null>(null);
    const wakeLockRef = useRef<any>(null);

    // --- WAKE LOCK API ---
    useEffect(() => {
        const requestWakeLock = async () => {
            if ('wakeLock' in navigator) {
                try {
                    const lock = await (navigator as any).wakeLock.request('screen');
                    wakeLockRef.current = lock;
                    console.log('💡 Wake Lock active');
                    
                    lock.addEventListener('release', () => {
                        console.log('💡 Wake Lock released');
                    });
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

    // Identify Active Ride for current driver
    const activeRide = useMemo(() => {
        if (!user) return null;
        const today = new Date().toISOString().split('T')[0];
        
        // 1. Priority: Ride currently marked as 'active' (regardless of date - e.g. unfinished from yesterday)
        const active = rides.find(r => r.driverId === user.id && r.status === 'active');
        if (active) return active;

        // 2. Priority: Planned ride for TODAY
        const todayPlanned = rides.find(r => r.driverId === user.id && r.date === today && r.status === 'planned');
        if (todayPlanned) return todayPlanned;

        // 3. Priority: Nearest FUTURE planned ride
        const futurePlanned = rides
            .filter(r => r.driverId === user.id && r.status === 'planned' && r.date > today)
            .sort((a, b) => a.date.localeCompare(b.date))[0];
        if (futurePlanned) return futurePlanned;

        // 4. PREVIEW FALLBACK: In local/preview mode, show ANY planned ride found (even past) to allow testing functionality
        if (isPreviewEnvironment) {
             const anyPlanned = rides.find(r => r.driverId === user.id && r.status === 'planned');
             if (anyPlanned) return anyPlanned;
        }

        return null;
    }, [rides, user, isPreviewEnvironment]);

    // Determine Active Stop (First non-completed/non-cancelled delivery step)
    const activeStopId = useMemo(() => {
        if (!activeRide || !activeRide.steps) return null;
        for (const step of activeRide.steps) {
            if (step.type === 'delivery') {
                const order = orders.find(o => o.id === step.orderId);
                if (order && order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.NOT_PICKED_UP) {
                    return step.orderId;
                }
            }
        }
        return null;
    }, [activeRide, orders]);

    const isDeliveryLate = (arrivalTime: string, order: Order) => {
        // Logic to check if arrivalTime > region/slot end time
        if (!settings.deliveryRegions || !order.deliveryZip) return false;
        const region = settings.deliveryRegions.find(r => r.enabled && r.zips.includes(order.deliveryZip!.replace(/\s/g, '')));
        if (!region) return false;
        
        // Check exception for date
        const ex = region.exceptions?.find(e => e.date === order.deliveryDate);
        const endTime = (ex && ex.isOpen) ? ex.deliveryTimeEnd : region.deliveryTimeEnd;
        
        return endTime ? arrivalTime > endTime : false;
    };

    const getOrderAmountToPay = (order: Order) => {
        const discount = order.appliedDiscounts?.reduce((sum, d) => sum + d.amount, 0) || 0;
        return Math.max(0, order.totalPrice - discount) + order.packagingFee + (order.deliveryFee || 0);
    };

    const handleNavigation = (address: string, orderId: string) => {
        // Open Google Maps
        const encoded = encodeURIComponent(address);
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
    };

    const handleStatusUpdate = async () => {
        if (!modalState) return;
        const newStatus = modalState.type === 'complete' ? OrderStatus.DELIVERED : OrderStatus.NOT_PICKED_UP;
        await updateOrderStatus([modalState.orderId], newStatus, true, true); // Notify customer + Push
        setModalState(null);
    };

    if (!user || user.role !== 'driver') {
        return <div className="p-8 text-center text-gray-500">Přístup pouze pro řidiče.</div>;
    }

    if (!activeRide) {
        return (
            <div className="p-8 text-center flex flex-col items-center">
                <div className="bg-gray-100 p-4 rounded-full mb-4">
                    <Map size={48} className="text-gray-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-700">Žádná aktivní jízda</h2>
                <p className="text-gray-500 mt-2">Nemáte naplánované žádné jízdy.</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto pb-24">
            <div className="bg-white p-4 sticky top-16 md:top-20 z-40 border-b shadow-sm flex justify-between items-center">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold text-primary">Jízda: {formatDate(activeRide.date)}</h1>
                        {wakeLockRef.current && <span className="flex h-2 w-2 relative" title="Obrazovka je aktivní"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>}
                    </div>
                    <div className="text-xs text-gray-500">{activeRide.steps?.filter(s => s.type === 'delivery').length || 0} zastávek • Odjezd {activeRide.departureTime}</div>
                </div>
                <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                    {activeRide.status === 'active' ? 'Na trase' : 'Plán'}
                </div>
            </div>

            <div className="p-4 space-y-1">
                {activeRide.steps?.map((step, idx) => {
                        const isDepot = step.type === 'pickup';
                        if (isDepot) return null; 

                        const order = orders.find(o => o.id === step.orderId);
                        if (!order) return null; // Safety

                        const isDelivered = order.status === OrderStatus.DELIVERED;
                        const isCancelled = order.status === OrderStatus.CANCELLED;
                        const isFailed = order.status === OrderStatus.NOT_PICKED_UP;
                        const isClosed = isDelivered || isFailed || isCancelled;
                        
                        const isLast = idx === (activeRide.steps?.length || 0) - 1;
                        const isActive = activeStopId === step.orderId;
                        
                        const isLate = isDeliveryLate(step.arrivalTime, order);
                        const hasError = !!step.error;

                        // Calculate Package Count for Display
                        const enrichedItems = order.items.map(i => {
                            const p = products.find(prod => prod.id === i.id);
                            return { ...i, volume: p?.volume || i.volume || 0 };
                        });
                        const pkgCount = calculatePackageCountLogic(enrichedItems, settings.packaging.types);

                        // Correct COD Logic: Only if not paid and not finished
                        const showCod = !order.isPaid && !isClosed;
                        const amountToPay = showCod ? getOrderAmountToPay(order) : 0;

                        return (
                            <div key={idx} className={`relative pl-10 ${isClosed ? 'opacity-50 grayscale' : ''}`}>
                                <div className={`absolute left-2.5 top-6 w-3 h-3 rounded-full border-2 border-white z-10 transform -translate-x-1/2 ${isDelivered ? 'bg-green-500' : (isFailed || isCancelled) ? 'bg-red-500' : 'bg-accent'}`}></div>
                                {!isLast && <div className="absolute left-4 top-6 bottom-[-24px] w-0.5 bg-gray-200 z-0"></div>}
                                
                                <div className={`absolute left-0 top-0 text-[10px] font-mono font-bold px-1 border rounded shadow-sm z-10 ${isLate && !isClosed ? 'bg-red-600 text-white border-red-600 animate-pulse' : 'bg-white text-gray-500'}`}>
                                    {step.arrivalTime}
                                </div>

                                <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden mt-3 transition-all duration-300 ${isActive ? 'ring-2 ring-blue-400 border-blue-400 transform scale-[1.02]' : ''} ${(hasError || (isLate && !isClosed)) ? 'border-red-500 ring-2 ring-red-100' : ''}`}>
                                    <div className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                {/* Order ID above Name */}
                                                <div className="text-[10px] text-gray-400 font-mono mb-0.5">#{order.id}</div>
                                                <div className="font-bold text-lg">
                                                    {isCancelled && <span className="text-red-600 mr-2">[STORNO]</span>}
                                                    {step.customerName}
                                                </div>
                                                {/* Phone Number Display */}
                                                {step.customerPhone && (
                                                    <a href={`tel:${step.customerPhone}`} className={`text-sm font-bold flex items-center mt-1 ${isClosed ? 'text-gray-500 pointer-events-none' : 'text-blue-600 hover:underline'}`}>
                                                        <Phone size={14} className="mr-1"/> {step.customerPhone}
                                                    </a>
                                                )}
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                {/* Package Count Badge */}
                                                <div className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center mb-1">
                                                    <Package size={10} className="mr-1"/> {pkgCount} {pkgCount === 1 ? 'balík' : pkgCount < 5 ? 'balíky' : 'balíků'}
                                                </div>

                                                {/* Status Badges */}
                                                {isDelivered && <div className="text-green-600 font-bold text-xs flex items-center justify-end"><CheckCircle size={12} className="mr-1"/> Doručeno</div>}
                                                {isFailed && <div className="text-red-600 font-bold text-xs flex items-center justify-end"><XCircle size={12} className="mr-1"/> Nedoručeno</div>}
                                                {isCancelled && <div className="text-red-600 font-bold text-xs flex items-center justify-end"><Ban size={12} className="mr-1"/> Zrušeno</div>}
                                                
                                                {/* Late Warning */}
                                                {isLate && !isClosed && !hasError && (
                                                    <div className="text-red-600 font-black text-xs bg-red-50 px-2 py-1 rounded border border-red-100 mb-1 flex items-center">
                                                        <AlertTriangle size={10} className="mr-1"/> POZOR: ZPOŽDĚNÍ
                                                    </div>
                                                )}

                                                {/* Error Warning */}
                                                {hasError && (
                                                    <div className="text-red-600 font-black text-xs bg-red-50 px-2 py-1 rounded border border-red-100 mb-1 flex items-center animate-pulse">
                                                        <AlertTriangle size={10} className="mr-1"/> CHYBA ADRESY
                                                    </div>
                                                )}
                                                
                                                {/* Payment Badge */}
                                                {!isClosed && (
                                                    showCod 
                                                        ? <div className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-xs border border-red-100 mt-1">Dobírka: {amountToPay} Kč</div>
                                                        : <div className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded border border-green-100 mt-1">Zaplaceno</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-2 mb-4 text-sm text-gray-600">
                                            <div className="flex items-start">
                                                <MapPin size={16} className={`mr-2 mt-0.5 flex-shrink-0 ${hasError ? 'text-red-500' : 'text-gray-400'}`}/>
                                                <div>
                                                    <div className={`font-medium ${hasError ? 'text-red-700 font-bold' : 'text-gray-800'}`}>{step.address}</div>
                                                    {hasError && <div className="text-red-600 text-xs font-bold mt-1 flex items-center bg-red-50 p-1 rounded"><AlertTriangle size={12} className="mr-1"/> {step.error}</div>}
                                                </div>
                                            </div>
                                            {step.note && <div className="bg-yellow-50 p-2 rounded text-xs text-yellow-800 border border-yellow-100 mt-2">{step.note}</div>}
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-2">
                                            <button 
                                                onClick={() => handleNavigation(step.address, step.orderId)} 
                                                className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-bold transition ${isClosed ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 hover:bg-blue-100 text-blue-700'}`}
                                                disabled={isClosed}
                                            >
                                                <Map size={20} className="mb-1"/> Navigovat
                                            </button>
                                            
                                            {!isClosed ? (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button 
                                                        onClick={() => setModalState({ type: 'fail', orderId: step.orderId })} 
                                                        className="flex flex-col items-center justify-center p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition"
                                                    >
                                                        <XCircle size={20} className="mb-1"/> Nedoručeno
                                                    </button>
                                                    <button 
                                                        onClick={() => setModalState({ type: 'complete', orderId: step.orderId })} 
                                                        className="flex flex-col items-center justify-center p-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition"
                                                    >
                                                        <Check size={20} className="mb-1"/> Hotovo
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center p-2 bg-gray-100 text-gray-500 rounded-xl text-xs font-bold">
                                                    <Check size={20} className="mb-1"/> {isCancelled ? 'Zrušeno' : 'Uzavřeno'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
            </div>

            {/* Confirmation Modal */}
            {modalState && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-xl font-bold mb-4 text-center">
                            {modalState.type === 'complete' ? 'Potvrdit doručení?' : 'Nahlásit nedoručení?'}
                        </h3>
                        <p className="text-center text-gray-500 mb-6">
                            {modalState.type === 'complete' 
                                ? 'Opravdu chcete označit tuto objednávku jako úspěšně doručenou?' 
                                : 'Opravdu chcete označit tuto objednávku jako nedoručenou?'}
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setModalState(null)} 
                                className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-600"
                            >
                                Zrušit
                            </button>
                            <button 
                                onClick={handleStatusUpdate} 
                                className={`flex-1 py-3 rounded-xl font-bold text-white ${modalState.type === 'complete' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
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