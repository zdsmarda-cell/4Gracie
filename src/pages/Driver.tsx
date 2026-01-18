
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { OrderStatus, Ride, Order } from '../types';
import { Phone, MapPin, Check, Navigation, ChevronRight, Ban, Map, Download, RefreshCw, AlertTriangle, Clock, Calendar, ArrowRight, Package, ChevronDown, ChevronUp, CheckCircle, XCircle, X } from 'lucide-react';
import { generateRouteSheetPdfWithOrders } from '../utils/pdfGenerator';
import { calculatePackageCountLogic } from '../utils/orderLogic';

const calculateDuration = (start: string, end: string): string => {
    if (!start || !end) return '-';
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    let diffM = (endH * 60 + endM) - (startH * 60 + startM);
    if (diffM < 0) diffM += 24 * 60; 
    const h = Math.floor(diffM / 60);
    const m = diffM % 60;
    return `${h}h ${m}m`;
};

// Modal for completing/failing a stop
const DriverActionModal: React.FC<{
    isOpen: boolean;
    type: 'complete' | 'fail';
    order: Order | undefined;
    amountToPay: number;
    onConfirm: (reason?: string) => void;
    onClose: () => void;
}> = ({ isOpen, type, order, amountToPay, onConfirm, onClose }) => {
    const [note, setNote] = useState('');
    const [paymentConfirmed, setPaymentConfirmed] = useState(false);

    if (!isOpen || !order) return null;

    const isCollect = type === 'complete' && !order.isPaid;

    const handleSubmit = () => {
        if (type === 'fail' && !note.trim()) {
            alert('Prosím uveďte důvod nedoručení.');
            return;
        }
        if (isCollect && !paymentConfirmed) {
            alert('Prosím potvrďte přijetí platby.');
            return;
        }
        onConfirm(note);
        setNote('');
        setPaymentConfirmed(false);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[500] p-4 backdrop-blur-sm animate-in zoom-in-95 duration-200">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-xl font-bold ${type === 'complete' ? 'text-green-600' : 'text-red-600'}`}>
                        {type === 'complete' ? 'Dokončit doručení' : 'Nedoručeno'}
                    </h3>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
                </div>

                <div className="mb-6">
                    <div className="text-xs font-mono text-gray-400 mb-1">#{order.id}</div>
                    <div className="font-bold text-lg">{order.deliveryName || order.userName}</div>
                </div>

                {type === 'fail' && (
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Důvod nedoručení:</label>
                        <textarea 
                            className="w-full border rounded-xl p-3 text-sm h-24 focus:ring-red-500 outline-none"
                            placeholder="Např. Nikdo doma, nezvedá telefon..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            autoFocus
                        />
                    </div>
                )}

                {type === 'complete' && (
                    <div className="mb-4">
                        {isCollect ? (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                                <p className="text-red-800 font-bold text-sm uppercase mb-2">Částka k výběru</p>
                                <p className="text-3xl font-black text-red-600 mb-4">{amountToPay} Kč</p>
                                <label className="flex items-center justify-center gap-2 cursor-pointer p-2 bg-white rounded-lg border border-red-100 shadow-sm">
                                    <input 
                                        type="checkbox" 
                                        checked={paymentConfirmed} 
                                        onChange={e => setPaymentConfirmed(e.target.checked)} 
                                        className="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                                    />
                                    <span className="font-bold text-sm text-gray-800">Hotovost přijata</span>
                                </label>
                            </div>
                        ) : (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                                <CheckCircle size={48} className="text-green-500 mx-auto mb-2"/>
                                <p className="text-green-800 font-bold">Objednávka je již zaplacena.</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-700">Zrušit</button>
                    <button 
                        onClick={handleSubmit} 
                        className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg ${type === 'complete' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                        disabled={isCollect && !paymentConfirmed}
                    >
                        Potvrdit
                    </button>
                </div>
            </div>
        </div>
    );
};

export const Driver: React.FC = () => {
  const { orders, rides, updateOrderStatus, updateOrder, t, formatDate, user, updateRide, isOperationPending, products, settings, refreshData, getDeliveryRegion, getRegionInfoForDate } = useStore();
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [editingTimes, setEditingTimes] = useState<Record<string, string>>({});
  
  // Track active stop ID (highlighted)
  const [activeStopId, setActiveStopId] = useState<string | null>(() => localStorage.getItem('driver_active_stop'));

  // Action Modal State
  const [modalState, setModalState] = useState<{ type: 'complete' | 'fail', orderId: string } | null>(null);

  useEffect(() => {
      if (activeStopId) localStorage.setItem('driver_active_stop', activeStopId);
      else localStorage.removeItem('driver_active_stop');
  }, [activeStopId]);

  // 1. Group Rides by Date - SORTED ASCENDING (Future)
  const ridesByDate = useMemo<Record<string, Ride[]>>(() => {
      if (!user) return {};
      const today = new Date().toISOString().split('T')[0];
      
      const myRides = rides
        .filter(r => r.driverId === user.id && r.date >= today) // Filter out past
        .sort((a, b) => a.date.localeCompare(b.date)); // Oldest (today) first, future last

      const grouped: Record<string, Ride[]> = {};
      myRides.forEach(r => {
          if (!grouped[r.date]) grouped[r.date] = [];
          grouped[r.date].push(r);
      });
      return grouped;
  }, [rides, user]);

  const activeRide = useMemo(() => 
      rides.find(r => r.id === activeRideId), 
  [rides, activeRideId]);

  const handleDepartureChange = (rideId: string, newTime: string) => {
      setEditingTimes(prev => ({ ...prev, [rideId]: newTime }));
  };

  const saveDepartureTime = async (rideId: string) => {
      const newTime = editingTimes[rideId];
      const ride = rides.find(r => r.id === rideId);
      if (ride && newTime && newTime !== ride.departureTime) {
          // Trigger Recalculation: Reset steps and set status to planned
          await updateRide({ 
              ...ride, 
              departureTime: newTime,
              steps: [], 
              status: 'planned' 
          });
          
          setEditingTimes(prev => {
              const newState = { ...prev };
              delete newState[rideId];
              return newState;
          });
          
          // Force refresh to show "pending" state immediately
          await refreshData();
      }
  };

  const handleDownloadPdf = async (e: React.MouseEvent, rideId: string) => {
      e.stopPropagation();
      const ride = rides.find(r => r.id === rideId);
      if (ride && user) {
          // Find full orders for this ride to calculate packages accurately
          const rideOrders = orders.filter(o => ride.orderIds.includes(o.id));
          await generateRouteSheetPdfWithOrders(ride, user.name, rideOrders, products, settings);
      }
  };

  const handleNavigation = (address: string, orderId: string) => {
      setActiveStopId(orderId);
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
      window.open(url, '_blank');
  };

  const confirmAction = async (reason?: string) => {
      if (!modalState) return;
      const { type, orderId } = modalState;
      const order = orders.find(o => o.id === orderId);
      
      if (!order) return;

      if (type === 'complete') {
          // If unpaid, mark as paid first
          if (!order.isPaid) {
              await updateOrder({ ...order, isPaid: true }, false);
          }
          await updateOrderStatus([orderId], OrderStatus.DELIVERED, true);
      } else {
          // Fail
          const newNote = (order.note || '') + `\n[${new Date().toLocaleString()}] Nedoručeno: ${reason}`;
          await updateOrder({ ...order, note: newNote }, false);
          await updateOrderStatus([orderId], OrderStatus.NOT_PICKED_UP, true); // Or custom status logic
      }
      
      setModalState(null);
      // If action done on active stop, clear highlight or move to next (optional)
      if (activeStopId === orderId) setActiveStopId(null);
  };
  
  const getOrderAmountToPay = (order: Order) => {
      const discount = order.appliedDiscounts?.reduce((sum, d) => sum + d.amount, 0) || 0;
      return Math.max(0, order.totalPrice - discount) + order.packagingFee + (order.deliveryFee || 0);
  };

  // --- Late Check Logic ---
  const isDeliveryLate = (arrivalTime: string, order: Order): boolean => {
      if (!arrivalTime || !order.deliveryZip) return false;
      const region = getDeliveryRegion(order.deliveryZip);
      if (!region) return false;
      
      const regionInfo = getRegionInfoForDate(region, order.deliveryDate);
      // If region allows delivery (isOpen), verify time
      if (regionInfo.isOpen) {
          const endTime = regionInfo.timeEnd || region.deliveryTimeEnd || "23:59";
          return arrivalTime > endTime;
      }
      return false; // Should not happen if planned correctly, but safe fallback
  };

  // --- DETAIL VIEW ---
  if (activeRide) {
      const rideOrders = orders.filter(o => activeRide.orderIds.includes(o.id));
      
      // Check if ride is still pending calculation
      const isPending = !activeRide.steps || activeRide.steps.length === 0;

      return (
        <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20">
            <div className="bg-white p-4 sticky top-0 z-10 shadow-sm border-b">
                <button 
                    onClick={() => setActiveRideId(null)} 
                    className="flex items-center text-gray-500 hover:text-primary mb-4 text-sm font-bold"
                >
                    <ChevronRight size={16} className="rotate-180 mr-1"/> Zpět na seznam
                </button>
                
                <div className="flex justify-between items-center mb-2">
                    <div>
                        <h1 className="text-xl font-bold text-primary flex items-center">
                            <Navigation className="mr-2 text-accent" /> {formatDate(activeRide.date)}
                        </h1>
                        <p className="text-xs text-gray-500 ml-8">Výjezd: {activeRide.departureTime}</p>
                    </div>
                    <button onClick={(e) => handleDownloadPdf(e, activeRide.id)} className="text-accent hover:bg-gray-100 p-2 rounded-full">
                        <Download size={20}/>
                    </button>
                </div>
            </div>

            {isPending ? (
                <div className="p-12 text-center flex flex-col items-center justify-center h-64 text-gray-500">
                    <RefreshCw size={48} className="animate-spin text-accent mb-4"/>
                    <h3 className="font-bold text-lg text-gray-800">Přepočítávám trasu...</h3>
                    <p className="text-sm mt-2">Vydržte prosím, optimalizuji zastávky podle nového času.</p>
                    <button onClick={refreshData} className="mt-6 text-blue-600 underline text-sm">Zkontrolovat stav</button>
                </div>
            ) : (
                <div className="p-4 space-y-6 relative">
                    {/* Depot Node */}
                    <div className="relative pl-10 opacity-70">
                        <div className="absolute left-2.5 top-3 w-3 h-3 rounded-full bg-gray-300 z-10 transform -translate-x-1/2"></div>
                        <div className="absolute left-4 top-4 bottom-[-24px] w-0.5 bg-gray-200 z-0"></div>
                        <div className="absolute left-0 top-0 text-[10px] font-mono font-bold bg-white px-1 border rounded text-gray-500 shadow-sm z-10">
                            {activeRide.departureTime}
                        </div>
                        <div className="bg-gray-50 rounded-xl border p-3">
                            <div className="font-bold text-sm text-gray-700">DEPO / NAKLÁDKA</div>
                            <div className="text-xs text-gray-500">{settings.companyDetails.street}</div>
                        </div>
                    </div>

                    {activeRide.steps?.map((step, idx) => {
                        const isDepot = step.type === 'pickup';
                        if (isDepot) return null; 

                        const order = orders.find(o => o.id === step.orderId);
                        if (!order) return null; // Safety

                        const isDelivered = order.status === OrderStatus.DELIVERED;
                        const isFailed = order.status === OrderStatus.NOT_PICKED_UP || order.status === OrderStatus.CANCELLED;
                        const isLast = idx === (activeRide.steps?.length || 0) - 1;
                        const isActive = activeStopId === step.orderId;
                        
                        const isLate = isDeliveryLate(step.arrivalTime, order);

                        // Calculate Package Count for Display
                        const enrichedItems = order.items.map(i => {
                            const p = products.find(prod => prod.id === i.id);
                            return { ...i, volume: p?.volume || i.volume || 0 };
                        });
                        const pkgCount = calculatePackageCountLogic(enrichedItems, settings.packaging.types);

                        // Correct COD Logic: Only if not paid and not finished
                        const showCod = !order.isPaid && !isDelivered && !isFailed;
                        const amountToPay = showCod ? getOrderAmountToPay(order) : 0;

                        return (
                            <div key={idx} className={`relative pl-10 ${isDelivered || isFailed ? 'opacity-60 grayscale' : ''}`}>
                                <div className={`absolute left-2.5 top-6 w-3 h-3 rounded-full border-2 border-white z-10 transform -translate-x-1/2 ${isDelivered ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-accent'}`}></div>
                                {!isLast && <div className="absolute left-4 top-6 bottom-[-24px] w-0.5 bg-gray-200 z-0"></div>}
                                
                                <div className={`absolute left-0 top-0 text-[10px] font-mono font-bold px-1 border rounded shadow-sm z-10 ${isLate && !isDelivered ? 'bg-red-600 text-white border-red-600 animate-pulse' : 'bg-white text-gray-500'}`}>
                                    {step.arrivalTime}
                                </div>

                                <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden mt-3 transition-all duration-300 ${isActive ? 'ring-2 ring-blue-400 border-blue-400 transform scale-[1.02]' : ''} ${step.error || (isLate && !isDelivered) ? 'border-red-300 ring-1 ring-red-100' : ''}`}>
                                    <div className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                {/* Order ID above Name */}
                                                <div className="text-[10px] text-gray-400 font-mono mb-0.5">#{order.id}</div>
                                                <div className="font-bold text-lg">{step.customerName}</div>
                                                {/* Phone Number Display */}
                                                {step.customerPhone && (
                                                    <a href={`tel:${step.customerPhone}`} className="text-sm font-bold text-blue-600 flex items-center mt-1 hover:underline">
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
                                                
                                                {/* Late Warning */}
                                                {isLate && !isDelivered && !isFailed && (
                                                    <div className="text-red-600 font-black text-xs bg-red-50 px-2 py-1 rounded border border-red-100 mb-1 flex items-center">
                                                        <AlertTriangle size={10} className="mr-1"/> POZOR: ZPOŽDĚNÍ
                                                    </div>
                                                )}
                                                
                                                {/* Payment Badge */}
                                                {!isDelivered && !isFailed && (
                                                    showCod 
                                                        ? <div className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-xs border border-red-100 mt-1">Dobírka: {amountToPay} Kč</div>
                                                        : <div className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded border border-green-100 mt-1">Zaplaceno</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-2 mb-4 text-sm text-gray-600">
                                            <div className="flex items-start">
                                                <MapPin size={16} className={`mr-2 mt-0.5 flex-shrink-0 ${step.error ? 'text-red-500' : 'text-gray-400'}`}/>
                                                <div>
                                                    <div className="font-medium text-gray-800">{step.address}</div>
                                                    {step.error && <div className="text-red-600 text-xs font-bold mt-1 flex items-center"><AlertTriangle size={12} className="mr-1"/> {step.error}</div>}
                                                </div>
                                            </div>
                                            {step.note && <div className="bg-yellow-50 p-2 rounded text-xs text-yellow-800 border border-yellow-100 mt-2">{step.note}</div>}
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-2">
                                            <button 
                                                onClick={() => handleNavigation(step.address, step.orderId)} 
                                                className="flex flex-col items-center justify-center p-2 bg-blue-50 hover:bg-blue-100 rounded-xl text-xs font-bold text-blue-700 transition"
                                            >
                                                <Map size={20} className="mb-1"/> Navigovat
                                            </button>
                                            
                                            {!isDelivered && !isFailed ? (
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
                                                    <Check size={20} className="mb-1"/> Uzavřeno
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            
            {/* Modal Injection */}
            {modalState && (
                <DriverActionModal 
                    isOpen={!!modalState} 
                    type={modalState.type} 
                    order={orders.find(o => o.id === modalState.orderId)}
                    amountToPay={orders.find(o => o.id === modalState.orderId) ? getOrderAmountToPay(orders.find(o => o.id === modalState.orderId)!) : 0}
                    onConfirm={confirmAction}
                    onClose={() => setModalState(null)}
                />
            )}
        </div>
      );
  }

  // --- MAIN LIST VIEW ---
  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20">
      <div className="bg-white p-4 sticky top-0 z-10 shadow-sm border-b">
          <h1 className="text-xl font-bold text-primary flex items-center">
            <Navigation className="mr-2 text-accent" /> {t('driver.title')} - Přehled
          </h1>
          <div className="flex justify-end mt-2">
              <button onClick={refreshData} className="text-xs text-blue-600 flex items-center font-bold"><RefreshCw size={12} className={`mr-1 ${isOperationPending ? 'animate-spin' : ''}`}/> Aktualizovat</button>
          </div>
      </div>

      <div className="p-4 space-y-4">
        {Object.keys(ridesByDate).length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Ban size={48} className="mx-auto mb-2 opacity-20"/>
            <p>{t('driver.no_orders')}</p>
          </div>
        ) : (
          Object.entries(ridesByDate).map(([date, ridesData]) => {
              const dateRides = ridesData as Ride[]; // Explicit cast to fix 'unknown' type inference in loop
              const isExpanded = expandedDate === date;
              const isToday = date === new Date().toISOString().split('T')[0];

              return (
                  <div key={date} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${isToday ? 'ring-2 ring-primary/10' : ''}`}>
                      {/* Date Header */}
                      <div 
                        className={`px-4 py-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition ${isExpanded ? 'bg-gray-50 border-b' : ''}`}
                        onClick={() => setExpandedDate(isExpanded ? null : date)}
                      >
                          <div className="flex items-center gap-3">
                              <Calendar size={20} className={isToday ? "text-accent" : "text-gray-400"}/>
                              <div>
                                  <div className="font-bold text-lg text-gray-800">{formatDate(date)}</div>
                                  <div className="text-xs text-gray-500">{dateRides.length} {dateRides.length === 1 ? 'jízda' : dateRides.length < 5 ? 'jízdy' : 'jízd'}</div>
                              </div>
                          </div>
                          {isExpanded ? <ChevronUp size={20} className="text-gray-400"/> : <ChevronDown size={20} className="text-gray-400"/>}
                      </div>

                      {/* Rides List */}
                      {isExpanded && (
                          <div className="divide-y divide-gray-100 bg-white">
                              {dateRides.map(ride => {
                                  const steps = ride.steps || [];
                                  const lastStep = steps.length > 0 ? steps[steps.length - 1] : undefined;
                                  
                                  const endTime = lastStep?.departureTime || lastStep?.arrivalTime;
                                  const duration = (ride.departureTime && endTime) ? calculateDuration(ride.departureTime, endTime) : '-';
                                  
                                  // Count delivered orders logic
                                  const totalOrders = ride.orderIds.length;
                                  const deliveredOrders = orders.filter(o => ride.orderIds.includes(o.id) && o.status === OrderStatus.DELIVERED).length;
                                  const progress = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;
                                  
                                  // Check if pending recalc
                                  const isPendingRecalc = !ride.steps || ride.steps.length === 0;

                                  return (
                                      <div key={ride.id} className="p-4 animate-in slide-in-from-top-2">
                                          <div className="flex justify-between items-start mb-3">
                                              <div>
                                                  <div className="flex items-center gap-2">
                                                      <span className="text-xs font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-600">Start: {ride.departureTime}</span>
                                                      <span className="text-xs text-gray-400">Trvání: {duration}</span>
                                                  </div>
                                                  {isPendingRecalc && (
                                                      <span className="text-[10px] text-orange-500 font-bold flex items-center mt-1"><RefreshCw size={10} className="animate-spin mr-1"/> Přepočítávám trasu...</span>
                                                  )}
                                              </div>
                                              <button 
                                                  onClick={(e) => handleDownloadPdf(e, ride.id)}
                                                  className="text-gray-400 hover:text-red-600 transition flex items-center text-xs font-bold"
                                              >
                                                  <Download size={14} className="mr-1"/> PDF
                                              </button>
                                          </div>

                                          {/* Progress Bar */}
                                          <div className="mb-4">
                                              <div className="flex justify-between text-[10px] text-gray-500 mb-1 uppercase font-bold">
                                                  <span>Postup</span>
                                                  <span>{deliveredOrders} / {totalOrders}</span>
                                              </div>
                                              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                                  <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                              </div>
                                          </div>

                                          <div className="flex gap-2">
                                              {/* Time Edit */}
                                              <div className="flex items-center border rounded-lg px-2 bg-gray-50">
                                                  <Clock size={14} className="text-gray-400 mr-2"/>
                                                  <input 
                                                      type="time" 
                                                      className="bg-transparent text-sm font-bold w-16 outline-none py-2"
                                                      value={editingTimes[ride.id] ?? ride.departureTime}
                                                      onChange={(e) => handleDepartureChange(ride.id, e.target.value)}
                                                      onBlur={() => saveDepartureTime(ride.id)}
                                                  />
                                                  {isOperationPending && editingTimes[ride.id] && <RefreshCw size={12} className="animate-spin text-gray-400 ml-1"/>}
                                              </div>

                                              <button 
                                                  onClick={() => setActiveRideId(ride.id)}
                                                  className="flex-1 bg-primary text-white rounded-lg text-sm font-bold flex items-center justify-center hover:bg-gray-800 transition"
                                              >
                                                  Detail jízdy <ArrowRight size={16} className="ml-2"/>
                                              </button>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              );
          })
        )}
      </div>
    </div>
  );
};
