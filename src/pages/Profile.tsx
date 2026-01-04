import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Navigate } from 'react-router-dom';
import { Trash2, Plus, Edit, MapPin, Building, X, ChevronDown, ChevronUp, FileText, QrCode, Minus, Check, AlertCircle, Lock, Save, ShoppingBag, Clock, ImageIcon, Search } from 'lucide-react';
import { Address, Order, OrderStatus, Product, DeliveryType, Language, PaymentMethod, ProductCategory } from '../types';
import { CustomCalendar } from '../components/CustomCalendar';

export const Profile: React.FC = () => {
  const { user, orders, t, updateUser, settings, printInvoice, updateOrder, updateOrderStatus, checkAvailability, products, getDeliveryRegion, changePassword, generateCzIban, removeDiacritics, formatDate, getRegionInfoForDate, getPickupPointInfo, calculatePackagingFee, validateDiscount } = useStore();
  
  // General Modal State
  const [modalType, setModalType] = useState<'billing' | 'delivery' | null>(null);
  const [editingAddr, setEditingAddr] = useState<Partial<Address> | null>(null);
  
  // Order List State
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [qrModalOrder, setQrModalOrder] = useState<Order | null>(null);
  
  // Order Editing State
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [orderSaveError, setOrderSaveError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  
  // Helpers for selector state in Order Edit
  const [selectedDeliveryAddrId, setSelectedDeliveryAddrId] = useState('');
  const [selectedBillingAddrId, setSelectedBillingAddrId] = useState('');
  
  // Address Modal within Order Edit context
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressModalMode, setAddressModalMode] = useState<'create' | 'edit'>('create');
  const [addressModalType, setAddressModalType] = useState<'delivery' | 'billing'>('delivery');
  const [addressForm, setAddressForm] = useState<Partial<Address>>({});
  const [addressError, setAddressError] = useState<string | null>(null);

  // Password Change State
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

  // Personal Info Edit State
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [infoMsg, setInfoMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

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
      if (!editingOrder || editingOrder.deliveryType !== DeliveryType.DELIVERY || !editingOrder.deliveryAddress) return undefined;
      const zipMatch = editingOrder.deliveryAddress.match(/\d{3}\s?\d{2}/);
      return zipMatch ? getDeliveryRegion(zipMatch[0]) : undefined;
  }, [editingOrder?.deliveryAddress, editingOrder?.deliveryType]);

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

  // Generic Address Save (Profile Tab)
  const saveProfileAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalType || !editingAddr) return;
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
        
        // 4. Update Order State
        setEditingOrder({ 
            ...editingOrder, 
            items, 
            appliedDiscounts: validDiscounts,
            totalPrice: itemsTotal,
            packagingFee 
        });
  };

  const openEditOrderModal = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setEditingOrder(JSON.parse(JSON.stringify(order))); // Deep copy
    setOrderSaveError(null);
    setSelectedDeliveryAddrId('');
    setSelectedBillingAddrId('');
    
    // Try to match current string addresses to IDs for selectors
    if (order.deliveryType === DeliveryType.DELIVERY && order.deliveryAddress) {
        const match = user.deliveryAddresses.find(a => order.deliveryAddress?.includes(a.street));
        if (match) setSelectedDeliveryAddrId(match.id);
    }
    if (order.billingAddress) {
        const match = user.billingAddresses.find(a => order.billingAddress?.includes(a.street));
        if (match) setSelectedBillingAddrId(match.id);
    }

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
    } else {
        if (!editingOrder.deliveryAddress) {
            setOrderSaveError('Vyplňte doručovací adresu.');
            return;
        }
        // ZIP Validation
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

    // 2. Check Date Availability - PASS EXCLUDE ID to prevent self-collision
    const availability = checkAvailability(editingOrder.deliveryDate, editingOrder.items, editingOrder.id);
    if (!availability.allowed && availability.status !== 'available') {
       setOrderSaveError(availability.reason || 'Vybraný termín není dostupný.');
       return;
    }
    
    const success = await updateOrder(editingOrder);
    if (success) setIsEditOrderModalOpen(false);
    else setOrderSaveError('Chyba při ukládání.');
  };

  const handleSelectDeliveryAddress = (addrId: string) => {
    setSelectedDeliveryAddrId(addrId);
    if (!addrId) return;
    const addr = user.deliveryAddresses.find(a => a.id === addrId);
    if (addr) {
        const zip = addr.zip.replace(/\s/g, '');
        const region = getDeliveryRegion(zip);
        const deliveryFee = region ? (editingOrder && editingOrder.totalPrice >= region.freeFrom ? 0 : region.price) : 0;

        setEditingOrder(prev => prev ? {
            ...prev,
            deliveryAddress: `${addr.name}\n${addr.street}\n${addr.city}\n${addr.zip}\nTel: ${addr.phone}`,
            deliveryFee
        } : null);
    }
  };

  const handleSelectBillingAddress = (addrId: string) => {
    setSelectedBillingAddrId(addrId);
    if (!addrId) return;
    const addr = user.billingAddresses.find(a => a.id === addrId);
    if (addr) {
        setEditingOrder(prev => prev ? {
            ...prev,
            billingAddress: `${addr.name}, ${addr.street}, ${addr.city}` + (addr.ic ? `, IČ: ${addr.ic}` : '')
        } : null);
    }
  };

  // --- ADDRESS MODAL WITHIN ORDER EDIT ---
  
  const openOrderAddressModal = (mode: 'create' | 'edit', type: 'delivery' | 'billing') => {
      setAddressModalMode(mode);
      setAddressModalType(type);
      setAddressError(null);
      
      if (mode === 'edit') {
          const id = type === 'delivery' ? selectedDeliveryAddrId : selectedBillingAddrId;
          const list = type === 'delivery' ? user.deliveryAddresses : user.billingAddresses;
          const existing = list.find(a => a.id === id);
          if (!existing) {
              alert('Nejdříve vyberte adresu k editaci.');
              return;
          }
          setAddressForm({ ...existing });
      } else {
          setAddressForm({});
      }
      setIsAddressModalOpen(true);
  };

  const handleOrderAddressSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setAddressError(null);
      
      // Validation
      if (!addressForm.name || addressForm.name.length < 3) { setAddressError(t('validation.name_length')); return; }
      if (!addressForm.street) { setAddressError(t('validation.street_required')); return; }
      if (!addressForm.city) { setAddressError(t('validation.city_required')); return; }
      if (!addressForm.zip || !/^\d{5}$/.test(addressForm.zip.replace(/\s/g, ''))) { setAddressError(t('validation.zip_format')); return; }
      if (!addressForm.phone) { setAddressError(t('validation.phone_format')); return; }

      const newAddr = { ...addressForm, id: addressForm.id || Date.now().toString() } as Address;
      const key = addressModalType === 'delivery' ? 'deliveryAddresses' : 'billingAddresses';
      
      let updatedList;
      if (addressModalMode === 'edit') {
          updatedList = user[key].map(a => a.id === newAddr.id ? newAddr : a);
      } else {
          updatedList = [...user[key], newAddr];
      }

      // 1. Update User Profile
      await updateUser({ ...user, [key]: updatedList });

      // 2. Select the address in the dropdown and update the text preview
      if (addressModalType === 'delivery') {
          setSelectedDeliveryAddrId(newAddr.id);
          handleSelectDeliveryAddress(newAddr.id); // Triggers text update + fee calc
      } else {
          setSelectedBillingAddrId(newAddr.id);
          handleSelectBillingAddress(newAddr.id);
      }

      setIsAddressModalOpen(false);
  };

  // --- PASSWORD & MISC ---

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);
    
    if (newPass !== confirmPass) {
      setPassMsg({ type: 'error', text: 'Nová hesla se neshodují.' });
      return;
    }
    if (newPass.length < 4) {
      setPassMsg({ type: 'error', text: t('validation.password_length') });
      return;
    }

    const result = changePassword(oldPass, newPass);
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
        {/* ... Orders Column (unchanged) ... */}
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
                                    <img src={item.images[0]} alt={item.name} className="w-8 h-8 rounded object-cover" />
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
                        <div className="flex gap-3 mt-4">
                           <button onClick={() => setQrModalOrder(o)} className="flex-1 py-2 border rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 text-sm font-bold"><QrCode size={16}/> QR Platba</button>
                           <button onClick={() => printInvoice(o)} className="flex-1 py-2 border rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 text-sm font-bold"><FileText size={16}/> Faktura</button>
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
            
            {/* Marketing Consent Toggle */}
            <div className="pt-2 border-t mt-2">
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
            <form onSubmit={handleChangePassword} className="space-y-3">
              <input type="password" placeholder="Staré heslo" required className="w-full border rounded p-2 text-sm" value={oldPass} onChange={e => setOldPass(e.target.value)} />
              <input type="password" placeholder="Nové heslo" required className="w-full border rounded p-2 text-sm" value={newPass} onChange={e => setNewPass(e.target.value)} />
              <input type="password" placeholder="Potvrdit heslo" required className="w-full border rounded p-2 text-sm" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
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

      {/* Profile Address Edit Modal */}
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
             <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
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
                        {/* Custom Calendar Implementation */}
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

                       <div className="grid grid-cols-1 gap-2">
                         <div><label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('checkout.delivery')}</label><select className="w-full border rounded p-2 text-sm" value={editingOrder.deliveryType} onChange={e => setEditingOrder({...editingOrder, deliveryType: e.target.value as DeliveryType})}><option value={DeliveryType.PICKUP}>{t('checkout.pickup')}</option><option value={DeliveryType.DELIVERY}>{t('admin.delivery')}</option></select></div>
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
                                        setEditingOrder({...editingOrder, pickupLocationId: e.target.value, deliveryAddress: loc ? `Osobní odběr: ${loc.name}, ${loc.street}, ${loc.city}` : ''});
                                    }}
                                >
                                    <option value="">Vyberte místo...</option>
                                    {settings.pickupLocations?.filter(l => l.enabled).map(l => (
                                        <option key={l.id} value={l.id}>{l.name} ({l.street})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Delivery Address Selector */}
                        {editingOrder.deliveryType === DeliveryType.DELIVERY && (
                            <>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[9px] font-bold text-gray-400 uppercase">Vybrat doručovací adresu</label>
                                        <div className="flex gap-2">
                                            {selectedDeliveryAddrId && (
                                                <button onClick={() => openOrderAddressModal('edit', 'delivery')} className="text-[9px] font-bold text-blue-600 hover:underline">Editovat</button>
                                            )}
                                            <button onClick={() => openOrderAddressModal('create', 'delivery')} className="text-[9px] font-bold text-green-600 hover:underline">+ Nová</button>
                                        </div>
                                    </div>
                                    <select 
                                        className="w-full border rounded p-2 text-sm mb-2"
                                        value={selectedDeliveryAddrId}
                                        onChange={e => handleSelectDeliveryAddress(e.target.value)}
                                    >
                                        <option value="">-- Vyberte adresu --</option>
                                        {user.deliveryAddresses.map(a => (
                                            <option key={a.id} value={a.id}>{a.name}, {a.street}, {a.city}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('common.street')} (Text)</label>
                                    <textarea className="w-full border rounded p-2 text-sm h-20" value={editingOrder.deliveryAddress || ''} onChange={e => setEditingOrder({...editingOrder, deliveryAddress: e.target.value})}/>
                                </div>
                            </>
                        )}

                        {/* Billing Address Selector */}
                        <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[9px] font-bold text-gray-400 uppercase">Fakturační adresa</label>
                                <div className="flex gap-2">
                                    {selectedBillingAddrId && (
                                        <button onClick={() => openOrderAddressModal('edit', 'billing')} className="text-[9px] font-bold text-blue-600 hover:underline">Editovat</button>
                                    )}
                                    <button onClick={() => openOrderAddressModal('create', 'billing')} className="text-[9px] font-bold text-green-600 hover:underline">+ Nová</button>
                                </div>
                            </div>
                            <select 
                                className="w-full border rounded p-2 text-sm mb-2"
                                value={selectedBillingAddrId}
                                onChange={e => handleSelectBillingAddress(e.target.value)}
                            >
                                <option value="">-- Vyberte adresu --</option>
                                {user.billingAddresses.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}, {a.street}, {a.city}</option>
                                ))}
                            </select>
                            <textarea className="w-full border rounded p-2 text-sm h-16" value={editingOrder.billingAddress || ''} onChange={e => setEditingOrder({...editingOrder, billingAddress: e.target.value})} placeholder="Fakturační adresa textově..."/>
                        </div>

                       <div>
                         <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('admin.comm_lang')}</label>
                         <select className="w-full border rounded p-2 text-sm" value={editingOrder.language || Language.CS} onChange={e => setEditingOrder({...editingOrder, language: e.target.value as Language})}>
                           {Object.values(Language).map(lang => <option key={lang as string} value={lang as string}>{(lang as string).toUpperCase()}</option>)}
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
                                      <img src={item.images[0]} alt={item.name} className="w-8 h-8 rounded object-cover" />
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
                    
                    {/* FEES SUMMARY */}
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
                            <span className="font-bold text-lg text-accent">{Math.max(0, editingOrder.totalPrice - (editingOrder.appliedDiscounts?.reduce((sum, d) => sum + d.amount, 0) || 0) + editingOrder.packagingFee + (editingOrder.deliveryFee || 0))} Kč</span>
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

      {/* New Address Modal (Inside Order Edit) */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[250] p-4">
            <form onSubmit={handleOrderAddressSave} className="bg-white p-6 rounded-2xl w-full max-w-md space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold">{addressModalMode === 'create' ? 'Nová adresa' : 'Upravit adresu'} ({addressModalType === 'delivery' ? 'Doručovací' : 'Fakturační'})</h3>
                
                {addressError && (
                    <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-xs font-bold flex items-center">
                        <AlertCircle size={16} className="mr-2 flex-shrink-0"/> {addressError}
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Jméno / Firma</label>
                    <input className="w-full border rounded p-2 text-sm" value={addressForm.name || ''} onChange={e => setAddressForm({...addressForm, name: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ulice a č.p.</label>
                    <input className="w-full border rounded p-2 text-sm" value={addressForm.street || ''} onChange={e => setAddressForm({...addressForm, street: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Město</label>
                        <input className="w-full border rounded p-2 text-sm" value={addressForm.city || ''} onChange={e => setAddressForm({...addressForm, city: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">PSČ</label>
                        <input className="w-full border rounded p-2 text-sm" value={addressForm.zip || ''} onChange={e => setAddressForm({...addressForm, zip: e.target.value})} />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefon</label>
                    <input className="w-full border rounded p-2 text-sm" value={addressForm.phone || ''} onChange={e => setAddressForm({...addressForm, phone: e.target.value})} />
                </div>
                
                {addressModalType === 'billing' && (
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">IČ</label>
                            <input className="w-full border rounded p-2 text-sm" value={addressForm.ic || ''} onChange={e => setAddressForm({...addressForm, ic: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">DIČ</label>
                            <input className="w-full border rounded p-2 text-sm" value={addressForm.dic || ''} onChange={e => setAddressForm({...addressForm, dic: e.target.value})} />
                        </div>
                    </div>
                )}

                <div className="flex gap-2 pt-4">
                    <button type="button" onClick={() => setIsAddressModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded text-sm font-bold">Zrušit</button>
                    <button type="submit" className="flex-1 py-2 bg-primary text-white rounded text-sm font-bold">Uložit</button>
                </div>
            </form>
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
                          <img src={p.images[0]} alt={p.name} className="w-10 h-10 rounded object-cover"/>
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