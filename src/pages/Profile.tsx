import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Trash2, Plus, Edit, MapPin, Building, X, ChevronDown, ChevronUp, FileText, QrCode, Minus, Check, AlertCircle, Lock, Save, ShoppingBag, Clock, ImageIcon, Search, FileCheck, Smartphone, LogOut, Loader2 } from 'lucide-react';
import { Address, Order, OrderStatus, Product, DeliveryType, Language, PaymentMethod, ProductCategory } from '../types';
import { CustomCalendar } from '../components/CustomCalendar';

export const Profile: React.FC = () => {
  const { user, orders, t, updateUser, settings, printInvoice, updateOrder, updateOrderStatus, checkAvailability, products, getDeliveryRegion, changePassword, generateCzIban, removeDiacritics, formatDate, getRegionInfoForDate, getPickupPointInfo, calculatePackagingFee, validateDiscount, getImageUrl, pushSubscription, subscribeToPush, unsubscribeFromPush, isPwa, isPushSupported, logout } = useStore();
  const navigate = useNavigate();
  
  // General Modal State (For Profile Address Management)
  const [modalType, setModalType] = useState<'billing' | 'delivery' | null>(null);
  const [editingAddr, setEditingAddr] = useState<Partial<Address> | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  
  // Order List State
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [qrModalOrder, setQrModalOrder] = useState<Order | null>(null);
  
  // Order Editing State
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [orderSaveError, setOrderSaveError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');

  // Password Change State
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [passErrors, setPassErrors] = useState<{ newPass?: string; confirmPass?: string }>({});

  // Personal Info Edit State
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [infoMsg, setInfoMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

  // Push Loading State
  const [isPushLoading, setIsPushLoading] = useState(false);

  useEffect(() => {
    if (user) {
        setEditName(user.name);
        setEditPhone(user.phone || '');
    }
  }, [user]);

  if (!user) return <Navigate to="/" />;

  const myOrders = orders.filter(o => o.userId === user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Derived state for Calendar validation in Modal
  const derivedRegion = useMemo(() => {
      if (!editingOrder || editingOrder.deliveryType !== DeliveryType.DELIVERY) return undefined;
      return editingOrder.deliveryZip ? getDeliveryRegion(editingOrder.deliveryZip) : undefined;
  }, [editingOrder?.deliveryType, editingOrder?.deliveryZip]);

  const derivedPickupLocation = useMemo(() => {
      if (!editingOrder || editingOrder.deliveryType !== DeliveryType.PICKUP || !editingOrder.pickupLocationId) return undefined;
      return settings.pickupLocations?.find(l => l.id === editingOrder.pickupLocationId);
  }, [editingOrder?.pickupLocationId, editingOrder?.deliveryType, settings.pickupLocations]);


  const validatePhone = (phone: string) => /^[+]?[0-9]{9,}$/.test(phone.replace(/\s/g, ''));
  const validateName = (name: string) => name.trim().length >= 3;

  const handleSaveInfo = async () => {
    setInfoMsg(null);
    if (!validateName(editName)) {
        setInfoMsg({ type: 'error', text: t('validation.name_length') });
        return;
    }
    if (!validatePhone(editPhone)) {
        setInfoMsg({ type: 'error', text: t('validation.phone_format') });
        return;
    }

    const success = await updateUser({ ...user, name: editName, phone: editPhone });
    if (success) {
        setInfoMsg({ type: 'success', text: 'Údaje uloženy.' });
    } else {
        setInfoMsg({ type: 'error', text: 'Chyba při ukládání.' });
    }
  };

  const handlePushToggle = async () => {
      if (isPushLoading) return;
      setIsPushLoading(true);
      try {
          if (pushSubscription) {
              await unsubscribeFromPush();
          } else {
              await subscribeToPush();
          }
      } finally {
          setIsPushLoading(false);
      }
  };

  const handleLogout = () => {
      logout();
      navigate('/');
  };

  // Generic Address Save (Profile Tab)
  const saveProfileAddress = (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError(null);
    if (!modalType || !editingAddr) return;

    // Validation
    if (!editingAddr.name || editingAddr.name.length < 3) { setAddressError(t('validation.name_length')); return; }
    if (!editingAddr.street) { setAddressError(t('validation.street_required')); return; }
    if (!editingAddr.city) { setAddressError(t('validation.city_required')); return; }
    if (!editingAddr.zip || !/^\d{5}$/.test(editingAddr.zip.replace(/\s/g, ''))) { setAddressError(t('validation.zip_format')); return; }
    if (!editingAddr.phone) { setAddressError(t('validation.phone_format')); return; }

    const newAddr = { ...editingAddr, id: editingAddr.id || Date.now().toString() } as Address;
    const key = modalType === 'billing' ? 'billingAddresses' : 'deliveryAddresses';
    const updated = editingAddr.id ? user[key].map(a => a.id === editingAddr.id ? newAddr : a) : [...user[key], newAddr];
    updateUser({ ...user, [key]: updated });
    setModalType(null);
    setEditingAddr(null);
  };

  const deleteAddr = (type: 'billing' | 'delivery', id: string) => {
    const key = type === 'billing' ? 'billingAddresses' : 'deliveryAddresses';
    updateUser({ ...user, [key]: user[key].filter(a => a.id !== id) });
  };

  const toggleOrder = (id: string) => {
    setExpandedOrderId(expandedOrderId === id ? null : id);
  };

  // --- ORDER EDITING LOGIC ---

  const recalculateOrderTotals = (items: any[], discounts: any[]) => {
        if (!editingOrder) return;
        
        // 1. Validate Discounts against new items
        let validDiscounts: any[] = [];
        for(const d of discounts) {
             const res = validateDiscount(d.code, items);
             if(res.success && res.amount !== undefined) {
                 validDiscounts.push({ code: d.code, amount: res.amount });
             }
        }

        // 2. Calculate Items Total
        const itemsTotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
        
        // 3. Calculate Packaging
        const packagingFee = calculatePackagingFee(items);
        
        // 4. Calculate Delivery Fee (Dynamic based on total)
        let deliveryFee = editingOrder.deliveryFee;
        if (editingOrder.deliveryType === DeliveryType.DELIVERY && derivedRegion) {
             // If region exists, check free limit against new total
             const totalForFreeLimit = itemsTotal - validDiscounts.reduce((acc, d) => acc + d.amount, 0);
             deliveryFee = totalForFreeLimit >= derivedRegion.freeFrom ? 0 : derivedRegion.price;
        } else if (editingOrder.deliveryType === DeliveryType.PICKUP) {
             deliveryFee = 0;
        }

        // 5. Update Order State
        setEditingOrder({ 
            ...editingOrder, 
            items, 
            appliedDiscounts: validDiscounts,
            totalPrice: itemsTotal,
            packagingFee,
            deliveryFee
        });
  };

  const openEditOrderModal = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setEditingOrder(JSON.parse(JSON.stringify(order))); // Deep copy
    setOrderSaveError(null);
    setIsEditOrderModalOpen(true);
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
        
        // CRITICAL: Populate address fields for Pickup so Email template renders correct address
        editingOrder.deliveryName = loc.name;
        editingOrder.deliveryStreet = loc.street;
        editingOrder.deliveryCity = loc.city;
        editingOrder.deliveryZip = loc.zip;
        editingOrder.deliveryAddress = `Osobní odběr: ${loc.name}, ${loc.street}, ${loc.city}`;

    } else {
        // Validate Address Fields
        if (!editingOrder.deliveryName || editingOrder.deliveryName.length < 3) { setOrderSaveError(t('validation.name_length')); return; }
        if (!editingOrder.deliveryStreet) { setOrderSaveError(t('validation.street_required')); return; }
        if (!editingOrder.deliveryCity) { setOrderSaveError(t('validation.city_required')); return; }
        if (!editingOrder.deliveryZip || !/^\d{5}$/.test(editingOrder.deliveryZip.replace(/\s/g, ''))) { setOrderSaveError(t('validation.zip_format')); return; }
        if (!editingOrder.deliveryPhone) { setOrderSaveError(t('validation.phone_format')); return; }

        // ZIP Validation against Region
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

    // 2. Check Date Availability - PASS EXCLUDE ID to prevent self-collision
    const availability = checkAvailability(editingOrder.deliveryDate, editingOrder.items, editingOrder.id);
    if (!availability.allowed && availability.status !== 'available') {
       setOrderSaveError(availability.reason || 'Vybraný termín není dostupný.');
       return;
    }
    
    // 3. Final Recalculation to ensure totals are consistent before save
    const itemsTotal = editingOrder.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const packagingFee = calculatePackagingFee(editingOrder.items);
    let deliveryFee = editingOrder.deliveryFee;
    
    if (editingOrder.deliveryType === DeliveryType.DELIVERY) {
        const zip = editingOrder.deliveryZip?.replace(/\s/g, '');
        const region = zip ? getDeliveryRegion(zip) : undefined;
        if (region) {
             const discountAmount = editingOrder.appliedDiscounts?.reduce((sum, d) => sum + d.amount, 0) || 0;
             const totalForLimit = itemsTotal - discountAmount;
             deliveryFee = totalForLimit >= region.freeFrom ? 0 : region.price;
        }
    } else {
        deliveryFee = 0;
    }

    const finalOrder = {
        ...editingOrder,
        totalPrice: itemsTotal,
        packagingFee,
        deliveryFee
    };

    // PASS true as 3rd arg for isUserEdit
    const success = await updateOrder(finalOrder, true, true); 
    if (success) setIsEditOrderModalOpen(false);
    else setOrderSaveError('Chyba při ukládání.');
  };

  // --- PASSWORD & MISC ---

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);
    setPassErrors({});
    
    let hasError = false;
    const errors: { newPass?: string; confirmPass?: string } = {};

    if (newPass.length < 4) {
      errors.newPass = t('validation.password_length');
      hasError = true;
    }

    if (newPass !== confirmPass) {
      errors.confirmPass = 'Hesla se neshodují.';
      hasError = true;
    }

    if (hasError) {
        setPassErrors(errors);
        return;
    }

    const result = await changePassword(oldPass, newPass);
    if (result.success) {
      setPassMsg({ type: 'success', text: result.message });
      setOldPass('');
      setNewPass('');
      setConfirmPass('');
    } else {
      setPassMsg({ type: 'error', text: result.message });
    }
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

  const toggleMarketingConsent = () => {
    updateUser({ ...user, marketingConsent: !user.marketingConsent });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Orders Column */}
        <div className="lg:col-span-2 space-y-8">
          <h2 className="text-2xl font-serif font-bold">Historie objednávek</h2>
          <div className="space-y-4">
            {myOrders.map(o => {
              const discountSum = o.appliedDiscounts?.reduce((sum, d) => sum + d.amount, 0) || 0;
              const total = Math.max(0, o.totalPrice - discountSum) + o.packagingFee + (o.deliveryFee || 0);
              const isExpanded = expandedOrderId === o.id;
              
              return (
                <div key={o.id} className={`bg-white border rounded-2xl shadow-sm transition-all duration-200 overflow-hidden ${isExpanded ? 'ring-2 ring-primary/5' : ''}`}>
                  <div 
                    className="p-6 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition"
                    onClick={() => toggleOrder(o.id)}
                  >
                    <div>
                      <div className="font-bold text-lg">
                        #{o.id} 
                        <span className="text-xs text-gray-400 ml-2 font-mono">{formatDate(o.deliveryDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${o.status === OrderStatus.CANCELLED ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-700'}`}>
                          {t(`status.${o.status}`)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="font-bold text-accent text-lg">{total} Kč</div>
                      {isExpanded ? <ChevronUp size={20} className="text-gray-400"/> : <ChevronDown size={20} className="text-gray-400"/>}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-6 pb-6 pt-0 border-t bg-gray-50/50 animate-in slide-in-from-top-2">
                      <div className="py-4 space-y-4">
                        
                        {/* Status History */}
                        {o.statusHistory && o.statusHistory.length > 0 && (
                          <div className="space-y-2">
                             <h4 className="text-xs font-bold uppercase text-gray-400 flex items-center"><Clock size={12} className="mr-1"/> Historie stavu</h4>
                             <div className="bg-white border rounded-lg p-3 space-y-2">
                                {o.statusHistory
                                  .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                  .map((h, idx) => (
                                   <div key={idx} className="flex justify-between items-center text-xs">
                                      <span className="text-gray-500 font-mono">{new Date(h.date).toLocaleString()}</span>
                                      <span className="font-bold bg-gray-100 px-2 py-0.5 rounded text-primary">{t(`status.${h.status}`)}</span>
                                   </div>
                                ))}
                             </div>
                          </div>
                        )}

                        {/* Items */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase text-gray-400">Obsah objednávky</h4>
                          <div className="divide-y divide-gray-100 bg-white rounded-lg border">
                            {o.items.map(item => (
                              <div key={item.id} className="p-3 flex items-center justify-between text-sm">
                                <div className="flex items-center gap-3">
                                  {item.images && item.images[0] && (
                                    <img src={getImageUrl(item.images[0])} alt={item.name} className="w-8 h-8 rounded object-cover" />
                                  )}
                                  <span className="font-bold">{item.quantity}x {item.name}</span>
                                </div>
                                <span>{item.price * item.quantity} Kč</span>
                              </div>
                            ))}
                            
                            {/* Discounts */}
                            {o.appliedDiscounts && o.appliedDiscounts.length > 0 && (
                              <div className="p-3 bg-green-50 text-xs text-green-700 space-y-1">
                                {o.appliedDiscounts.map(d => (
                                  <div key={d.code} className="flex justify-between">
                                    <span>Sleva ({d.code})</span>
                                    <span>-{d.amount} Kč</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Fees */}
                            {o.deliveryFee > 0 && (
                              <div className="p-3 bg-gray-50 text-xs text-gray-500 flex justify-between">
                                <span>Doprava</span>
                                <span>{o.deliveryFee} Kč</span>
                              </div>
                            )}
                            {o.packagingFee > 0 && (
                              <div className="p-3 bg-gray-50 text-xs text-gray-500 flex justify-between">
                                <span>{t('common.packaging')}</span>
                                <span>{o.packagingFee} Kč</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Total & Actions */}
                        <div className="flex justify-between items-center pt-4">
                           <div className="text-sm font-bold text-gray-500">Celkem k úhradě</div>
                           <div className="text-xl font-bold text-accent">{total} Kč</div>
                        </div>

                        {/* QR & Invoice */}
                        <div className="flex gap-2 mt-4 flex-wrap">
                           <button onClick={() => setQrModalOrder(o)} className="flex-1 py-2 border rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 text-sm font-bold"><QrCode size={16}/> QR Platba</button>
                           
                           {/* Proforma Button */}
                           <button onClick={() => printInvoice(o, 'proforma')} className="flex-1 py-2 border rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 text-sm font-bold"><FileText size={16}/> Záloha</button>
                           
                           {/* Final Invoice Button - Only if delivered AND final date exists */}
                           {o.status === OrderStatus.DELIVERED && o.finalInvoiceDate && (
                               <button onClick={() => printInvoice(o, 'final')} className="flex-1 py-2 border border-green-200 bg-green-50 text-green-700 rounded-lg flex items-center justify-center gap-2 hover:bg-green-100 text-sm font-bold">
                                   <FileCheck size={16}/> Daň. doklad
                               </button>
                           )}
                        </div>

                        {/* USER EDIT ACTIONS - Restricted to CREATED status */}
                        {o.status === OrderStatus.CREATED && (
                           <div className="pt-4 border-t mt-4">
                              <button 
                                onClick={(e) => openEditOrderModal(e, o)} 
                                className="w-full py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition"
                              >
                                <Edit size={16}/> Upravit objednávku
                              </button>
                           </div>
                        )}
                        {/* Show cancelled message if cancelled */}
                        {o.status === OrderStatus.CANCELLED && (
                           <div className="pt-4 border-t mt-4 text-center text-xs text-red-500 font-bold">
                              Objednávka byla stornována.
                           </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {myOrders.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                <ShoppingBag size={48} className="mx-auto text-gray-200 mb-4" />
                <h3 className="text-lg font-bold text-gray-400">Zatím žádné objednávky</h3>
              </div>
            )}
          </div>
        </div>

        {/* Profile Sidebar */}
        <div className="space-y-8">
          {/* Personal Info */}
          <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
                <h2 className="text-lg font-bold">Osobní údaje</h2>
                <button onClick={handleSaveInfo} className="text-xs bg-primary text-white px-3 py-1 rounded font-bold hover:bg-black transition">Uložit</button>
            </div>
            
            <div className="space-y-3">
                <div>
                    <label className="text-xs text-gray-400 font-bold uppercase block mb-1">{t('common.name')}</label>
                    <input type="text" className="w-full border rounded p-2 text-sm" value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
                <div>
                    <label className="text-xs text-gray-400 font-bold uppercase block mb-1">Telefon</label>
                    <input type="text" className="w-full border rounded p-2 text-sm" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+420..." />
                </div>
                <div>
                    <label className="text-xs text-gray-400 font-bold uppercase block mb-1">{t('common.email')}</label>
                    <div className="w-full border rounded p-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed">{user.email}</div>
                </div>
            </div>

            {infoMsg && (
                <div className={`text-xs p-2 rounded ${infoMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {infoMsg.text}
                </div>
            )}
            
            <div className="pt-2 border-t mt-2 space-y-3">
                {/* Marketing Consent Toggle */}
                <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer select-none">
                    <input 
                    type="checkbox" 
                    checked={user.marketingConsent || false} 
                    onChange={toggleMarketingConsent} 
                    className="rounded text-accent" 
                    />
                    <span className={user.marketingConsent ? 'text-green-600' : 'text-gray-500'}>
                    {user.marketingConsent ? 'Marketingový souhlas udělen' : 'Marketingový souhlas neudělen'}
                    </span>
                </label>

                {/* Push Notifications Toggle */}
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                        <Smartphone size={16} className="text-accent" />
                        <span className="text-xs font-bold text-gray-700">Mobilní notifikace</span>
                    </div>
                    {isPushSupported ? (
                        <>
                            {Notification.permission === 'denied' ? (
                                <span className="text-[10px] text-red-500 font-bold text-right leading-tight max-w-[100px]">
                                    Povolit v nastavení
                                </span>
                            ) : (
                                <button 
                                    onClick={handlePushToggle}
                                    disabled={isPushLoading}
                                    className={`text-xs px-2 py-1 rounded font-bold transition flex items-center gap-1 ${pushSubscription ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'} ${isPushLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {isPushLoading && <Loader2 size={10} className="animate-spin" />}
                                    {isPushLoading ? 'Zpracovávám...' : (pushSubscription ? 'Zapnuto' : 'Vypnuto')}
                                </button>
                            )}
                        </>
                    ) : (
                        <span className="text-[10px] text-gray-400 italic">Nepodporováno</span>
                    )}
                </div>

                {/* LOGOUT BUTTON - Explicitly added here for mobile visibility */}
                <button 
                    onClick={handleLogout}
                    className="w-full mt-4 flex items-center justify-center gap-2 p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-bold text-sm transition"
                >
                    <LogOut size={16} /> Odhlásit se
                </button>
            </div>
          </div>

          {/* Addresses */}
          <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-lg font-bold">Adresy</h2>
              <div className="flex gap-2">
                <button onClick={() => { setModalType('delivery'); setEditingAddr({}); }} className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">+ Doručovací</button>
                <button onClick={() => { setModalType('billing'); setEditingAddr({}); }} className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">+ Fakturační</button>
              </div>
            </div>
            
            <div className="space-y-4">
              {user.deliveryAddresses.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center"><MapPin size={12} className="mr-1"/> Doručovací</h4>
                  <div className="space-y-2">
                    {user.deliveryAddresses.map(a => (
                      <div key={a.id} className="bg-gray-50 p-3 rounded-lg text-sm relative group">
                        <div className="font-bold">{a.name}</div>
                        <div className="text-gray-600">{a.street}, {a.city}, {a.zip}</div>
                        <div className="text-gray-400 text-xs mt-1">{a.phone}</div>
                        <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                          <button onClick={() => { setEditingAddr(a); setModalType('delivery'); }} className="p-1 hover:bg-white rounded"><Edit size={14}/></button>
                          <button onClick={() => deleteAddr('delivery', a.id)} className="p-1 hover:bg-white rounded text-red-500"><Trash2 size={14}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {user.billingAddresses.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center"><Building size={12} className="mr-1"/> Fakturační</h4>
                  <div className="space-y-2">
                    {user.billingAddresses.map(a => (
                      <div key={a.id} className="bg-gray-50 p-3 rounded-lg text-sm relative group">
                        <div className="font-bold">{a.name}</div>
                        <div className="text-gray-600">{a.street}, {a.city}</div>
                        {a.ic && <div className="text-xs text-gray-400">IČ: {a.ic}</div>}
                        <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                          <button onClick={() => { setEditingAddr(a); setModalType('billing'); }} className="p-1 hover:bg-white rounded"><Edit size={14}/></button>
                          <button onClick={() => deleteAddr('billing', a.id)} className="p-1 hover:bg-white rounded text-red-500"><Trash2 size={14}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Password Change */}
          <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
            <h2 className="text-lg font-bold border-b pb-2 flex items-center"><Lock size={18} className="mr-2"/> Změna hesla</h2>
            <form onSubmit={handleChangePassword} className="space-y-3" noValidate>
              <input 
                type="password" 
                placeholder="Staré heslo" 
                className="w-full border rounded p-2 text-sm" 
                value={oldPass} 
                onChange={e => setOldPass(e.target.value)} 
              />
              
              <div>
                <input 
                    type="password" 
                    placeholder="Nové heslo" 
                    className={`w-full border rounded p-2 text-sm ${passErrors.newPass ? 'border-red-500 bg-red-50' : ''}`}
                    value={newPass} 
                    onChange={e => { setNewPass(e.target.value); setPassErrors({...passErrors, newPass: undefined}); }} 
                />
                {passErrors.newPass && <p className="text-xs text-red-500 mt-1">{passErrors.newPass}</p>}
              </div>

              <div>
                <input 
                    type="password" 
                    placeholder="Potvrdit heslo" 
                    className={`w-full border rounded p-2 text-sm ${passErrors.confirmPass ? 'border-red-500 bg-red-50' : ''}`}
                    value={confirmPass} 
                    onChange={e => { setConfirmPass(e.target.value); setPassErrors({...passErrors, confirmPass: undefined}); }} 
                />
                {passErrors.confirmPass && <p className="text-xs text-red-500 mt-1">{passErrors.confirmPass}</p>}
              </div>

              {passMsg && (
                <div className={`text-xs p-2 rounded ${passMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {passMsg.text}
                </div>
              )}
              <button type="submit" className="w-full bg-primary text-white py-2 rounded font-bold text-sm">Změnit heslo</button>
            </form>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Address Edit Modal (Main Profile Only) */}
      {modalType && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <form onSubmit={saveProfileAddress} className="bg-white p-8 rounded-2xl w-full max-w-md space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold">{editingAddr?.id ? 'Upravit adresu' : 'Nová adresa'}</h2>
            
            {addressError && (
                <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-xs font-bold flex items-center">
                    <AlertCircle size={16} className="mr-2 flex-shrink-0"/> {addressError}
                </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Jméno / Firma</label>
              <input placeholder={t('common.name')} className="w-full border rounded-lg p-3 text-sm" value={editingAddr?.name || ''} onChange={e => setEditingAddr({...editingAddr, name: e.target.value})} />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ulice a č.p.</label>
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
            <div className="flex gap-2 pt-4"><button type="button" onClick={() => setModalType(null)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-xs uppercase">Zrušit</button><button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase shadow-lg">Uložit</button></div>
          </form>
        </div>
      )}

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

      {/* User Edit Order Modal */}
      {isEditOrderModalOpen && editingOrder && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
             <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
             <div className="p-6 border-b flex justify-between items-center bg-gray-50">
               <h2 className="text-xl font-serif font-bold text-primary">Upravit objednávku #{editingOrder.id}</h2>
               <button onClick={() => setIsEditOrderModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={24}/></button>
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

                        {/* Delivery Address - MANUAL ONLY */}
                        {editingOrder.deliveryType === DeliveryType.DELIVERY && (
                            <div className="space-y-2 p-3 bg-white border rounded-lg">
                                <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Doručovací adresa</div>
                                <input placeholder="Jméno / Firma" className="w-full border rounded p-2 text-xs" value={editingOrder.deliveryName || ''} onChange={e => setEditingOrder({...editingOrder, deliveryName: e.target.value})} />
                                <input placeholder="Ulice a č.p." className="w-full border rounded p-2 text-xs" value={editingOrder.deliveryStreet || ''} onChange={e => setEditingOrder({...editingOrder, deliveryStreet: e.target.value})} />
                                <div className="grid grid-cols-2 gap-2">
                                    <input placeholder="Město" className="border rounded p-2 text-xs" value={editingOrder.deliveryCity || ''} onChange={e => setEditingOrder({...editingOrder, deliveryCity: e.target.value})} />
                                    <input placeholder="PSČ" className="border rounded p-2 text-xs" value={editingOrder.deliveryZip || ''} onChange={e => setEditingOrder({...editingOrder, deliveryZip: e.target.value})} />
                                </div>
                                <input placeholder="Telefon (+420...)" className="w-full border rounded p-2 text-xs" value={editingOrder.deliveryPhone || ''} onChange={e => setEditingOrder({...editingOrder, deliveryPhone: e.target.value})} />
                            </div>
                        )}

                        {/* Billing Address - MANUAL ONLY - Selector Removed */}
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

                       {/* PAYMENT METHOD SELECTOR (USER) */}
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
                    
                    {/* FEES & DISCOUNT SUMMARY */}
                    <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>Zboží:</span>
                            <span>{editingOrder.totalPrice} Kč</span>
                        </div>
                        {editingOrder.appliedDiscounts?.map(d => (
                            <div key={d.code} className="flex justify-between text-xs text-green-600">
                                <span>Sleva ({d.code}):</span>
                                <span>-{d.amount} Kč</span>
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
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-2">
                            <span className="font-bold text-sm">CELKEM:</span>
                            <span className="font-bold text-lg text-accent">
                                {/* Correct calculation: (Goods - Discounts) + Fees. Discount does not reduce fees. */}
                                {Math.max(0, editingOrder.totalPrice - (editingOrder.appliedDiscounts?.reduce((sum, d) => sum + d.amount, 0) || 0)) + editingOrder.packagingFee + (editingOrder.deliveryFee || 0)} Kč
                            </span>
                        </div>
                    </div>
                 </div>
               </div>
             </div>
             <div className="p-6 bg-gray-50 border-t flex gap-4">
               <button onClick={() => setIsEditOrderModalOpen(false)} className="flex-1 py-3 bg-white border rounded-xl font-bold text-sm uppercase transition">{t('admin.cancel')}</button>
               <button onClick={handleSaveOrder} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm uppercase shadow-lg transition flex items-center justify-center gap-2"><Save size={16}/> Uložit změny</button>
             </div>
          </div>
         </div>
      )}

      {/* Add Product Modal (Reused for User) */}
      {isAddProductModalOpen && (
         <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[250] p-4">
             <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center"><h3 className="font-bold text-lg">{t('common.add_item')}</h3><button onClick={() => setIsAddProductModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20}/></button></div>
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