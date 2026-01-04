
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag, CreditCard, Lock, MapPin, Truck, CheckCircle, Plus, Minus, AlertCircle, Info, Activity, Building, QrCode, Edit, X, Tag, Ban, FileText, Clock, Store } from 'lucide-react';
import { DeliveryType, PaymentMethod, Order, OrderStatus, Address, DeliveryRegion, PickupLocation } from '../types';
import { CustomCalendar } from '../components/CustomCalendar';
import { TermsContent } from '../components/TermsContent';

export const Cart: React.FC = () => {
  const { cart, removeFromCart, updateCartItemQuantity, t, tData, clearCart, user, openAuthModal, checkAvailability, addOrder, orders, settings, generateInvoice, getDeliveryRegion, applyDiscount, removeAppliedDiscount, appliedDiscounts, updateUser, generateCzIban, removeDiacritics, language, calculatePackagingFee, getRegionInfoForDate, getPickupPointInfo, formatDate } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);
  
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(() => {
    return (localStorage.getItem('cart_deliveryType') as DeliveryType) || DeliveryType.PICKUP;
  });
  const [selectedAddrId, setSelectedAddrId] = useState<string>('');
  const [selectedBillingId, setSelectedBillingId] = useState<string>('');
  const [selectedPickupLocationId, setSelectedPickupLocationId] = useState<string>(''); 
  const [date, setDate] = useState('');
  
  // PAYMENT METHOD LOGIC
  const activePaymentMethods = useMemo(() => settings.paymentMethods.filter(m => m.enabled), [settings.paymentMethods]);
  
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => {
    const saved = localStorage.getItem('cart_paymentMethod') as PaymentMethod;
    // If saved method is still active, use it. Otherwise use first active or fallback.
    if (saved && activePaymentMethods.some(m => m.id === saved)) return saved;
    return activePaymentMethods.length > 0 ? activePaymentMethods[0].id : PaymentMethod.GATEWAY; // Default fallback to something even if disabled, validation will block submit
  });

  const [orderNote, setOrderNote] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [termsConsent, setTermsConsent] = useState(false); 
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);

  const [discountInput, setDiscountInput] = useState('');
  const [discountError, setDiscountError] = useState('');

  const [modalType, setModalType] = useState<'billing' | 'delivery' | null>(null);
  const [editingAddr, setEditingAddr] = useState<Partial<Address> | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  const enabledRegions = useMemo(() => settings.deliveryRegions.filter(r => r.enabled), [settings.deliveryRegions]);
  const activePickupLocations = useMemo(() => settings.pickupLocations?.filter(l => l.enabled) || [], [settings.pickupLocations]);

  // Auto-select pickup location if only 1 exists
  useEffect(() => {
    if (deliveryType === DeliveryType.PICKUP && activePickupLocations.length === 1 && !selectedPickupLocationId) {
        setSelectedPickupLocationId(activePickupLocations[0].id);
    }
  }, [deliveryType, activePickupLocations]);

  // Ensure payment method is valid when active methods change
  useEffect(() => {
      if (activePaymentMethods.length > 0 && !activePaymentMethods.some(m => m.id === paymentMethod)) {
          setPaymentMethod(activePaymentMethods[0].id);
      }
  }, [activePaymentMethods, paymentMethod]);

  const validationErrors = useMemo(() => {
    return cart.reduce((acc, item) => {
      if (item.minOrderQuantity && item.quantity < item.minOrderQuantity) {
        acc[item.id] = t('error.min_qty', { qty: item.minOrderQuantity.toString() });
      }
      return acc;
    }, {} as Record<string, string>);
  }, [cart]);

  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  useEffect(() => {
    localStorage.setItem('cart_deliveryType', deliveryType);
    localStorage.setItem('cart_paymentMethod', paymentMethod);
  }, [deliveryType, paymentMethod]);

  useEffect(() => {
    if (!user) return;

    if (!selectedAddrId && user.deliveryAddresses.length > 0) {
      if (user.deliveryAddresses.length === 1) {
        setSelectedAddrId(user.deliveryAddresses[0].id);
      } else {
        const lastOrder = [...orders]
          .filter(o => o.userId === user.id && o.deliveryType === DeliveryType.DELIVERY)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        
        if (lastOrder) {
           const matched = user.deliveryAddresses.find(a => lastOrder.deliveryAddress?.includes(a.street));
           if (matched) setSelectedAddrId(matched.id);
           else setSelectedAddrId(user.deliveryAddresses[0].id);
        } else {
           setSelectedAddrId(user.deliveryAddresses[0].id);
        }
      }
    }

    if (!selectedBillingId && user.billingAddresses.length > 0) {
      if (user.billingAddresses.length === 1) {
        setSelectedBillingId(user.billingAddresses[0].id);
      } else {
         const lastOrder = [...orders]
          .filter(o => o.userId === user.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
         
         if (lastOrder) {
            const matched = user.billingAddresses.find(a => lastOrder.billingAddress?.includes(a.street));
            if (matched) setSelectedBillingId(matched.id);
            else setSelectedBillingId(user.billingAddresses[0].id);
         } else {
            setSelectedBillingId(user.billingAddresses[0].id);
         }
      }
    }
  }, [user, orders]);

  const itemsTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountTotal = appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);
  
  const selectedAddr = user?.deliveryAddresses.find(a => a.id === selectedAddrId);
  const selectedBilling = user?.billingAddresses.find(a => a.id === selectedBillingId);
  
  // Determine Region based on selected address IF delivery
  const region = (deliveryType === DeliveryType.DELIVERY && selectedAddr) ? getDeliveryRegion(selectedAddr.zip) : undefined;
  
  // Determine Pickup Location
  const pickupLocation = (deliveryType === DeliveryType.PICKUP && selectedPickupLocationId) 
    ? activePickupLocations.find(l => l.id === selectedPickupLocationId) 
    : undefined;

  // Check region/pickup availability for selected date
  const regionInfo = (region && date) ? getRegionInfoForDate(region, date) : { isOpen: true, isException: false, timeStart: undefined, timeEnd: undefined };
  const pickupInfo = (pickupLocation && date) ? getPickupPointInfo(pickupLocation, date) : { isOpen: true, isException: false, timeStart: undefined, timeEnd: undefined };

  const isDeliveryMethodInvalid = (deliveryType === DeliveryType.DELIVERY && region && !regionInfo.isOpen) || (deliveryType === DeliveryType.PICKUP && pickupLocation && !pickupInfo.isOpen);

  const deliveryFee = deliveryType === DeliveryType.DELIVERY ? (region ? (itemsTotal >= region.freeFrom ? 0 : region.price) : 0) : 0;
  const packagingFee = calculatePackagingFee(cart);
  
  const total = Math.max(0, itemsTotal - discountTotal) + deliveryFee + packagingFee;

  const availability = useMemo(() => {
    if (!date || cart.length === 0) return null;
    return checkAvailability(date, cart);
  }, [date, cart, checkAvailability]);

  // Check for Payment Validity
  const isPaymentValid = activePaymentMethods.some(m => m.id === paymentMethod);

  const handleApplyDiscount = () => {
    setDiscountError('');
    if (!discountInput) return;
    
    const result = applyDiscount(discountInput);
    if (result.success) {
      setDiscountInput('');
    } else {
      setDiscountError(result.error || t('discount.invalid'));
    }
  };

  const handleSubmit = () => {
    if (!user || user.isBlocked || !date || !availability?.allowed || !selectedBillingId || hasValidationErrors || isDeliveryMethodInvalid || !termsConsent || !isPaymentValid) return;
    if (deliveryType === DeliveryType.DELIVERY && !region) return;
    if (deliveryType === DeliveryType.PICKUP && !pickupLocation) return;

    // Update user consent profile setting
    if (user.marketingConsent !== marketingConsent) {
        updateUser({ ...user, marketingConsent });
    }

    const newOrder: Order = {
      id: `${Math.floor(Math.random() * 90000) + 10000}`,
      userId: user.id,
      userName: user.name,
      items: [...cart],
      totalPrice: itemsTotal,
      packagingFee,
      deliveryFee,
      appliedDiscounts,
      deliveryType,
      deliveryDate: date,
      deliveryAddress: deliveryType === DeliveryType.PICKUP 
        ? `${t('cart.pickup')}: ${pickupLocation?.name}, ${pickupLocation?.street}, ${pickupLocation?.city}` 
        : `${selectedAddr?.name}\n${selectedAddr?.street}\n${selectedAddr?.city}\n${selectedAddr?.zip}\nTel: ${selectedAddr?.phone}`,
      billingAddress: `${selectedBilling?.name}, ${selectedBilling?.street}, ${selectedBilling?.city}`,
      status: OrderStatus.CREATED,
      isPaid: paymentMethod === PaymentMethod.GATEWAY,
      paymentMethod,
      createdAt: new Date().toISOString(),
      language: language,
      note: orderNote,
      pickupLocationId: deliveryType === DeliveryType.PICKUP ? selectedPickupLocationId : undefined
    };
    
    newOrder.invoiceUrl = generateInvoice(newOrder);
    addOrder(newOrder); // Server handles VOP attachment via path
    setSubmittedOrder(newOrder);
    setStep(3);
    clearCart();
  };

  const saveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError(null);
    if (!user || !modalType || !editingAddr) return;

    // Validation
    if (!editingAddr.name || editingAddr.name.trim().length < 3) { setAddressError(t('validation.name_length')); return; }
    if (!editingAddr.street || editingAddr.street.trim().length < 1) { setAddressError(t('validation.street_required')); return; }
    if (!editingAddr.city || editingAddr.city.trim().length < 1) { setAddressError(t('validation.city_required')); return; }
    if (!editingAddr.zip || !editingAddr.zip.replace(/\s/g, '').match(/^\d{5}$/)) { setAddressError(t('validation.zip_format')); return; }
    
    // Validate phone for both delivery and billing to ensure contact info
    if (!editingAddr.phone || !/^[+]?[0-9]{9,}$/.test(editingAddr.phone.replace(/\s/g, ''))) { 
        setAddressError(t('validation.phone_format')); 
        return; 
    }

    const newAddr = { ...editingAddr, id: editingAddr.id || Date.now().toString() } as Address;
    const key = modalType === 'billing' ? 'billingAddresses' : 'deliveryAddresses';
    const updated = editingAddr.id ? user[key].map(a => a.id === editingAddr.id ? newAddr : a) : [...user[key], newAddr];
    updateUser({ ...user, [key]: updated });
    
    if (modalType === 'billing') setSelectedBillingId(newAddr.id);
    else setSelectedAddrId(newAddr.id);
    
    setModalType(null);
    setEditingAddr(null);
  };

  if (step === 3 && submittedOrder) {
    const iban = generateCzIban(settings.companyDetails.bankAccount).replace(/\s/g,'');
    const bic = settings.companyDetails.bic ? `+${settings.companyDetails.bic}` : '';
    const acc = `ACC:${iban}${bic}`;
    const vs = submittedOrder.id.replace(/\D/g, '') || '0';
    const msg = removeDiacritics(`Objednavka ${submittedOrder.id}`);
    
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center animate-fade-in">
         <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={48} /></div>
         <h1 className="text-3xl font-serif font-bold mb-2">{t('cart.thank_you')}</h1>
         <p className="text-gray-500 mb-8">{t('cart.order_number')} <span className="font-bold text-gray-900">#{submittedOrder.id}</span>.</p>
         
         {submittedOrder.paymentMethod === PaymentMethod.QR && (
           <div className="bg-white p-6 rounded-2xl border shadow-sm max-w-sm mx-auto mb-8 animate-in zoom-in-95 duration-500">
             <div className="flex items-center justify-center mb-4 text-accent"><QrCode size={48} /></div>
             <h4 className="font-bold text-gray-800 mb-2">QR Platba</h4>
             <div className="w-48 h-48 bg-gray-100 rounded-lg mx-auto flex items-center justify-center mb-4">
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`SPD*1.0*${acc}*AM:${total.toFixed(2)}*CC:CZK*X-VS:${vs}*MSG:${msg}`)}`} alt="QR Code" className="w-40 h-40" />
             </div>
             <div className="text-xs text-gray-500 space-y-1">
               <p>{t('common.bank_acc')}: <span className="font-bold text-gray-700">{settings.companyDetails.bankAccount}</span></p>
               <p>Var. symbol: <span className="font-bold text-gray-700">{submittedOrder.id}</span></p>
               <p>{t('common.price')}: <span className="font-bold text-gray-700">{total} Kč</span></p>
             </div>
           </div>
         )}
         <button onClick={() => navigate('/')} className="bg-primary text-white py-4 px-10 rounded-xl font-bold shadow-lg">{t('cart.back_to_menu')}</button>
      </div>
    );
  }

  if (cart.length === 0) return <div className="text-center py-24"><ShoppingBag size={48} className="mx-auto text-gray-200 mb-4"/><h2 className="text-xl font-bold text-gray-400">{t('cart.empty')}</h2></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {step === 1 && (
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden divide-y">
               {cart.map(item => (
                 <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-gray-50 transition">
                   <div className="flex items-center gap-4 flex-1">
                     <img src={item.images[0]} className="w-16 h-16 object-cover rounded-lg shadow-sm" />
                     <div className="flex-1">
                       <div className="font-bold text-sm text-gray-800">{tData(item, 'name')}</div>
                       {item.minOrderQuantity && item.minOrderQuantity > 1 && (
                         <div className="text-[10px] text-gray-400 mt-1">{t('common.min_qty')}: {item.minOrderQuantity}</div>
                       )}
                       {validationErrors[item.id] && (
                         <div className="text-xs text-red-500 font-bold mt-1 flex items-center">
                           <AlertCircle size={12} className="mr-1"/> {validationErrors[item.id]}
                         </div>
                       )}
                     </div>
                   </div>
                   <div className="flex items-center justify-between md:justify-end gap-4">
                      <div className="flex border rounded-lg bg-white overflow-hidden shadow-sm">
                        <button onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)} className="p-2 hover:bg-gray-100"><Minus size={14}/></button>
                        <span className={`px-3 font-bold text-xs flex items-center border-x ${validationErrors[item.id] ? 'bg-red-50 text-red-600' : 'bg-gray-50'}`}>{item.quantity}</span>
                        <button onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)} className="p-2 hover:bg-gray-100"><Plus size={14}/></button>
                      </div>
                      <div className="font-bold text-sm w-20 text-right">{item.price * item.quantity} Kč</div>
                      <button onClick={() => removeFromCart(item.id)} className="text-red-300 hover:text-red-500 p-2 transition"><Trash2 size={16}/></button>
                   </div>
                 </div>
               ))}
            </div>
          )}
          
          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
               {/* Auth check... */}
               {!user && (
                  <div className="bg-white p-8 rounded-2xl border shadow-sm text-center space-y-4">
                     <h3 className="font-serif font-bold text-xl">{t('cart.login_required')}</h3>
                     <p className="text-sm text-gray-500">{t('cart.login_desc')}</p>
                     <div className="flex justify-center gap-4">
                        <button onClick={openAuthModal} className="px-6 py-2 bg-primary text-white rounded-lg font-bold">{t('cart.login_btn')}</button>
                     </div>
                  </div>
               )}

               {user && (
                 <>
                  {user.isBlocked && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start">
                      <Ban className="text-red-500 mr-3 flex-shrink-0" size={24} />
                      <div>
                        <h4 className="font-bold text-red-700">{t('cart.blocked_alert')}</h4>
                        <p className="text-xs text-red-600 mt-1">{t('cart.blocked_desc')}</p>
                      </div>
                    </div>
                  )}

                  <div className={`bg-white p-6 rounded-2xl border shadow-sm ${user.isBlocked ? 'opacity-50 pointer-events-none' : ''}`}>
                    <h3 className="font-bold mb-4 flex items-center"><Truck className="mr-2 text-accent" size={20}/> {t('cart.delivery_pickup')}</h3>
                    {/* ... (delivery regions logic remains same) ... */}
                    <div className={`grid ${enabledRegions.length > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
                       <button onClick={() => setDeliveryType(DeliveryType.PICKUP)} className={`p-4 rounded-xl border-2 text-left transition ${deliveryType === DeliveryType.PICKUP ? 'border-accent bg-yellow-50/50' : 'border-gray-100 hover:border-gray-200'}`}>
                          <div className="font-bold text-sm mb-1">{t('cart.pickup')}</div>
                          <div className="text-xs text-gray-500">{t('cart.pickup_free')}</div>
                       </button>
                       {enabledRegions.length > 0 && (
                         <button onClick={() => setDeliveryType(DeliveryType.DELIVERY)} className={`p-4 rounded-xl border-2 text-left transition ${deliveryType === DeliveryType.DELIVERY ? 'border-accent bg-yellow-50/50' : 'border-gray-100 hover:border-gray-200'}`}>
                            <div className="font-bold text-sm mb-1">{t('cart.delivery_courier')}</div>
                            <div className="text-xs text-gray-500">{t('cart.delivery_from', { price: Math.min(...enabledRegions.map(r => r.price)).toString() })}</div>
                         </button>
                       )}
                    </div>

                    {/* DYNAMIC TIME WINDOW DISPLAY */}
                    {deliveryType === DeliveryType.DELIVERY && region && (
                       <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700 flex items-center animate-in slide-in-from-top-2">
                          <Clock size={16} className="mr-2 flex-shrink-0" />
                          <span>
                             {t('cart.time_window_delivery')}: <strong>
                               {date ? (regionInfo.timeStart || region.deliveryTimeStart) : region.deliveryTimeStart} 
                               {' - '} 
                               {date ? (regionInfo.timeEnd || region.deliveryTimeEnd) : region.deliveryTimeEnd}
                             </strong>
                          </span>
                       </div>
                    )}

                    {/* PICKUP LOCATION SELECTOR */}
                    {deliveryType === DeliveryType.PICKUP && (
                        <div className="mt-4 pt-4 border-t animate-in slide-in-from-top-2">
                            <label className="text-xs font-bold uppercase text-gray-400 mb-2 block">{t('cart.select_pickup')}</label>
                            {activePickupLocations.length > 0 ? (
                                <div className="space-y-2">
                                    {activePickupLocations.map(loc => (
                                        <div 
                                            key={loc.id} 
                                            onClick={() => setSelectedPickupLocationId(loc.id)}
                                            className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center ${selectedPickupLocationId === loc.id ? 'border-accent bg-yellow-50/30' : 'border-gray-200 hover:border-gray-300'}`}
                                        >
                                            <div>
                                                <div className="font-bold text-sm flex items-center"><Store size={14} className="mr-1 text-gray-400"/> {tData(loc, 'name')}</div>
                                                <div className="text-xs text-gray-500 ml-5">{loc.street}, {loc.city}</div>
                                            </div>
                                            {selectedPickupLocationId === loc.id && <CheckCircle size={16} className="text-accent"/>}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-red-500 text-sm">{t('cart.no_pickup_available')}</p>
                            )}
                            
                            {/* Pickup Time Window Display */}
                            {pickupLocation && (
                                <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700 flex items-center animate-in slide-in-from-top-2">
                                    <Clock size={16} className="mr-2 flex-shrink-0" />
                                    <span>
                                        {t('cart.time_window_pickup')}: <strong>
                                            {date 
                                                ? (pickupInfo.isOpen ? `${pickupInfo.timeStart} - ${pickupInfo.timeEnd}` : t('error.day_closed')) 
                                                : t('cart.date_selection')}
                                        </strong>
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {deliveryType === DeliveryType.DELIVERY && enabledRegions.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold uppercase text-gray-400">{t('cart.select_delivery_address')}</label><button onClick={() => {setModalType('delivery'); setEditingAddr({});}} className="text-xs font-bold text-accent">+ {t('cart.new_address')}</button></div>
                        <div className="space-y-2">
                           {user.deliveryAddresses.map(addr => {
                             const reg = getDeliveryRegion(addr.zip);
                             return (
                               <div key={addr.id} onClick={() => setSelectedAddrId(addr.id)} className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center ${selectedAddrId === addr.id ? 'border-accent bg-yellow-50/30' : 'border-gray-200 hover:border-gray-300'}`}>
                                  <div>
                                    <div className="font-bold text-sm">{addr.name}</div>
                                    <div className="text-xs text-gray-500">{addr.street}, {addr.city}, {addr.zip}</div>
                                    <div className="text-[10px] text-gray-400 mt-1">{addr.phone}</div>
                                    {!reg && <div className="text-[10px] text-red-500 font-bold mt-1">{t('cart.delivery_unavailable')}</div>}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setEditingAddr(addr); setModalType('delivery'); }} 
                                      className="text-gray-400 hover:text-accent p-1"
                                    >
                                      <Edit size={16} />
                                    </button>
                                    {selectedAddrId === addr.id && <CheckCircle size={16} className="text-accent"/>}
                                  </div>
                               </div>
                             );
                           })}
                           {user.deliveryAddresses.length === 0 && <p className="text-xs text-gray-400 italic">{t('cart.no_saved_addresses')}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className={`bg-white p-6 rounded-2xl border shadow-sm ${user.isBlocked ? 'opacity-50 pointer-events-none' : ''}`}>
                    <h3 className="font-bold mb-4 flex items-center"><Activity className="mr-2 text-accent" size={20}/> {t('cart.date_selection')}</h3>
                    
                    {/* Replaced with Imported CustomCalendar */}
                    <CustomCalendar 
                      cart={cart} 
                      checkAvailability={checkAvailability} 
                      onSelect={setDate} 
                      selectedDate={date} 
                      region={region}
                      getRegionInfo={getRegionInfoForDate}
                      pickupLocation={pickupLocation}
                      getPickupInfo={getPickupPointInfo}
                    />
                    
                    {/* Modified Time Alert */}
                    {((region && regionInfo.isException && regionInfo.isOpen) || (pickupLocation && pickupInfo.isException && pickupInfo.isOpen)) && (
                      <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-xs flex items-start">
                        <Clock size={16} className="mr-2 mt-0.5 flex-shrink-0"/>
                        <span>{t('cart.date_modified_time', { date: formatDate(date), type: deliveryType === DeliveryType.PICKUP ? t('cart.time_window_pickup') : t('cart.delivery_fee') })}</span>
                      </div>
                    )}

                    {/* Closed Alert */}
                    {isDeliveryMethodInvalid && (
                      <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-xs flex items-start">
                        <Ban size={16} className="mr-2 mt-0.5 flex-shrink-0"/>
                        <span>{deliveryType === DeliveryType.PICKUP ? t('cart.date_closed_pickup') : t('cart.date_closed_region')}</span>
                      </div>
                    )}

                    {availability?.status === 'exceeds' && (
                       <div className="mt-4 p-3 bg-orange-50 text-orange-700 rounded-lg text-xs flex items-start">
                         <AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0"/>
                         <span>{t('cart.capacity_exceeded')}</span>
                       </div>
                    )}
                    {availability?.status === 'too_soon' && (
                       <div className="mt-4 p-3 bg-orange-50 text-orange-700 rounded-lg text-xs flex items-start">
                         <AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0"/>
                         <span>{t('error.too_soon')}</span>
                       </div>
                    )}
                  </div>

                  <div className={`bg-white p-6 rounded-2xl border shadow-sm ${user.isBlocked ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex justify-between items-center mb-4">
                       <h3 className="font-bold flex items-center"><Building className="mr-2 text-accent" size={20}/> {t('cart.billing_details')}</h3>
                       <button onClick={() => {setModalType('billing'); setEditingAddr({});}} className="text-xs font-bold text-accent">+ {t('cart.new_address')}</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                       {user.billingAddresses.map(addr => (
                         <div key={addr.id} onClick={() => setSelectedBillingId(addr.id)} className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center ${selectedBillingId === addr.id ? 'border-accent bg-yellow-50/30' : 'border-gray-200'}`}>
                            <div>
                              <div className="font-bold text-xs">{addr.name}</div>
                              <div className="text-[10px] text-gray-500">{addr.street}, {addr.city}</div>
                              {addr.ic && <div className="text-[10px] text-gray-400">{t('common.ic')}: {addr.ic}</div>}
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingAddr(addr); setModalType('billing'); }} 
                              className="text-gray-400 hover:text-accent p-1"
                            >
                              <Edit size={14} />
                            </button>
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className={`bg-white p-6 rounded-2xl border shadow-sm ${user.isBlocked ? 'opacity-50 pointer-events-none' : ''}`}>
                    <h3 className="font-bold mb-4 flex items-center"><CreditCard className="mr-2 text-accent" size={20}/> {t('cart.payment_method')}</h3>
                    
                    {/* Error if no payment methods available */}
                    {activePaymentMethods.length === 0 ? (
                        <div className="bg-red-50 p-4 rounded-lg text-red-600 text-sm font-bold flex items-center">
                            <AlertCircle size={20} className="mr-2"/> Není k dispozici žádná aktivní platební metoda. Objednávku nelze dokončit.
                        </div>
                    ) : (
                        <div className="space-y-2">
                        {activePaymentMethods.map(method => (
                            <label key={method.id} className="flex items-center p-3 border rounded-xl cursor-pointer hover:bg-gray-50 transition">
                            <input type="radio" name="payment" className="text-accent focus:ring-accent" checked={paymentMethod === method.id} onChange={() => setPaymentMethod(method.id)} />
                            <div className="ml-3">
                                <span className="block text-sm font-bold text-gray-900">{tData(method, 'label')}</span>
                                <span className="block text-xs text-gray-500">{tData(method, 'description')}</span>
                            </div>
                            </label>
                        ))}
                        </div>
                    )}
                  </div>

                  <div className={`bg-white p-6 rounded-2xl border shadow-sm ${user.isBlocked ? 'opacity-50 pointer-events-none' : ''}`}>
                    <h3 className="font-bold mb-2 flex items-center"><FileText className="mr-2 text-accent" size={20}/> {t('common.note')}</h3>
                    <textarea 
                      className="w-full border rounded-xl p-3 text-sm h-24 focus:ring-accent outline-none" 
                      placeholder={t('checkout.note')}
                      value={orderNote}
                      onChange={(e) => setOrderNote(e.target.value)}
                    />
                  </div>
                 </>
               )}
            </div>
          )}
        </div>

        <div className="space-y-6">
           <div className="bg-white p-8 rounded-3xl border shadow-xl sticky top-24">
              <h2 className="text-2xl font-serif font-bold mb-6 text-primary">{t('cart.summary')}</h2>
              
              <div className="mb-6 space-y-3">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder={t('cart.code_placeholder')}
                    className="flex-1 border rounded-lg p-2 text-xs uppercase font-bold focus:ring-accent outline-none"
                    value={discountInput}
                    onChange={e => setDiscountInput(e.target.value)}
                    disabled={user?.isBlocked}
                  />
                  <button onClick={handleApplyDiscount} disabled={user?.isBlocked} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition disabled:opacity-50"><Plus size={16}/></button>
                </div>
                {discountError && <p className="text-[10px] text-red-500 font-bold">{discountError}</p>}
                <div className="space-y-2">
                  {appliedDiscounts.map(d => (
                    <div key={d.code} className="flex justify-between items-center bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                      <div className="flex items-center text-green-700">
                        <Tag size={12} className="mr-2" />
                        <span className="text-[10px] font-bold uppercase">{d.code}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-green-700">-{d.amount} Kč</span>
                        <button onClick={() => removeAppliedDiscount(d.code)} className="text-green-300 hover:text-green-600"><X size={12}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 text-sm mb-6 border-b pb-6">
                <div className="flex justify-between text-gray-500"><span>{t('cart.goods_total')}</span><span className="font-bold text-gray-900">{itemsTotal} Kč</span></div>
                {discountTotal > 0 && <div className="flex justify-between text-green-600 font-bold"><span>{t('cart.discounts_applied')}</span><span>-{discountTotal} Kč</span></div>}
                <div className="flex justify-between text-gray-500"><span>{t('cart.delivery_fee')}</span><span className="font-bold text-gray-900">{deliveryFee} Kč</span></div>
                <div className="flex justify-between text-gray-500"><span>{t('cart.packaging_fee')}</span><span className="font-bold text-gray-900">{packagingFee} Kč</span></div>
              </div>
              <div className="flex justify-between items-end mb-8">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('cart.total_vat')}</span>
                <span className="text-4xl font-bold text-accent tracking-tighter">{total} Kč</span>
              </div>
              
              {step === 1 && (
                <button onClick={() => setStep(2)} disabled={hasValidationErrors} className="w-full bg-accent text-white py-4 rounded-xl font-bold shadow-lg hover:bg-yellow-600 transition uppercase text-xs tracking-widest disabled:opacity-50 disabled:cursor-not-allowed">{t('cart.continue')}</button>
              )}
              
              {step === 2 && (
                <div className="space-y-3">
                  {user && (
                    <div className="space-y-2 mb-4">
                        <label className="flex items-start space-x-2 text-xs text-gray-600 cursor-pointer p-2 hover:bg-gray-50 rounded">
                        <input 
                            type="checkbox" 
                            checked={marketingConsent} 
                            onChange={e => setMarketingConsent(e.target.checked)} 
                            className="rounded text-accent mt-0.5" 
                        />
                        <span>{t('cart.marketing_consent')}</span>
                        </label>
                        
                        <label className={`flex items-start space-x-2 text-xs cursor-pointer p-2 rounded ${!termsConsent ? 'text-red-600 bg-red-50' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <input 
                            type="checkbox" 
                            checked={termsConsent} 
                            onChange={e => setTermsConsent(e.target.checked)} 
                            className="rounded text-accent mt-0.5" 
                        />
                        <span className="flex flex-wrap items-center gap-1">
                            {t('cart.terms_consent')}
                            <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setIsTermsModalOpen(true); }}
                                className="text-accent hover:text-primary underline font-bold ml-1 z-10 relative"
                            >
                                (Zobrazit VOP)
                            </button>
                        </span>
                        </label>
                    </div>
                  )}
                  <button 
                    disabled={!user || user.isBlocked || !date || !availability?.allowed || !selectedBillingId || isDeliveryMethodInvalid || !termsConsent || (deliveryType === DeliveryType.PICKUP && !pickupLocation) || (deliveryType === DeliveryType.DELIVERY && !region) || !isPaymentValid} 
                    onClick={handleSubmit} 
                    className="w-full bg-accent text-white py-4 rounded-xl font-bold shadow-lg hover:bg-yellow-600 transition disabled:opacity-50 disabled:bg-gray-300 uppercase text-xs tracking-widest"
                  >
                    {user?.isBlocked ? t('cart.account_blocked') : t('cart.submit_order')}
                  </button>
                  <button onClick={() => setStep(1)} className="w-full text-gray-400 text-[10px] font-bold uppercase tracking-widest hover:text-gray-600">{t('cart.back')}</button>
                </div>
              )}
           </div>
        </div>
      </div>
      
      {/* ... (Address Modal stays same) ... */}
      {modalType && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <form onSubmit={saveAddress} className="bg-white p-8 rounded-2xl w-full max-w-md space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold">{editingAddr?.id ? t('common.edit') : t('cart.new_address')}</h2>
            
            {addressError && (
                <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-xs font-bold flex items-center">
                    <AlertCircle size={16} className="mr-2 flex-shrink-0"/> {addressError}
                </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('common.name')}</label>
              <input placeholder={t('common.name')} className="w-full border rounded-lg p-3 text-sm" value={editingAddr?.name || ''} onChange={e => setEditingAddr({...editingAddr, name: e.target.value})} />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('common.street')}</label>
              <input placeholder={t('common.street')} className="w-full border rounded-lg p-3 text-sm" value={editingAddr?.street || ''} onChange={e => setEditingAddr({...editingAddr, street: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('common.city')}</label>
                <input placeholder={t('common.city')} className="border rounded-lg p-3 text-sm w-full" value={editingAddr?.city || ''} onChange={e => setEditingAddr({...editingAddr, city: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('common.zip')}</label>
                <input placeholder={t('common.zip')} className="border rounded-lg p-3 text-sm w-full" value={editingAddr?.zip || ''} onChange={e => setEditingAddr({...editingAddr, zip: e.target.value})} />
              </div>
            </div>
            
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('common.phone')}</label>
                <input placeholder="+420..." className="w-full border rounded-lg p-3 text-sm" value={editingAddr?.phone || ''} onChange={e => setEditingAddr({...editingAddr, phone: e.target.value})} />
            </div>

            {modalType === 'billing' && (
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('common.ic')}</label>
                    <input placeholder={t('common.ic')} className="border rounded-lg p-3 text-sm w-full" value={editingAddr?.ic || ''} onChange={e => setEditingAddr({...editingAddr, ic: e.target.value})} />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('common.dic')}</label>
                    <input placeholder={t('common.dic')} className="border rounded-lg p-3 text-sm w-full" value={editingAddr?.dic || ''} onChange={e => setEditingAddr({...editingAddr, dic: e.target.value})} />
                 </div>
               </div>
            )}
            <div className="flex gap-2 pt-4"><button type="button" onClick={() => setModalType(null)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-xs uppercase">{t('common.cancel')}</button><button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase shadow-lg">{t('common.save')}</button></div>
          </form>
        </div>
      )}

      {/* VOP Modal */}
      {isTermsModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsTermsModalOpen(false)}>
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h3 className="text-2xl font-serif font-bold text-primary">Obchodní podmínky</h3>
                    <button onClick={() => setIsTermsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-500"><X size={24}/></button>
                </div>
                <div className="overflow-y-auto pr-2 flex-grow">
                    <TermsContent />
                </div>
                <div className="mt-6 pt-4 border-t flex justify-end">
                    <button onClick={() => setIsTermsModalOpen(false)} className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition shadow-lg">Rozumím</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
