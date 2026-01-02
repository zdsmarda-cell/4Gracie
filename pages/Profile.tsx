
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Navigate } from 'react-router-dom';
import { Trash2, Plus, Edit, MapPin, Building, X, ChevronDown, ChevronUp, FileText, QrCode, Minus, Check, AlertCircle, Lock, Save, ShoppingBag, Clock } from 'lucide-react';
import { Address, Order, OrderStatus, Product, DeliveryType, Language, PaymentMethod, ProductCategory } from '../types';

export const Profile: React.FC = () => {
  const { user, orders, t, updateUser, settings, printInvoice, updateOrder, updateOrderStatus, checkAvailability, products, getDeliveryRegion, changePassword, generateCzIban, removeDiacritics } = useStore();
  const [modalType, setModalType] = useState<'billing' | 'delivery' | null>(null);
  const [editingAddr, setEditingAddr] = useState<Partial<Address> | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [qrModalOrder, setQrModalOrder] = useState<Order | null>(null);
  
  // Order Editing State
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);

  // Password Change State
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

  if (!user) return <Navigate to="/" />;

  const myOrders = orders.filter(o => o.userId === user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const saveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalType || !editingAddr?.street) return;
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

  const openEditOrderModal = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setEditingOrder(JSON.parse(JSON.stringify(order))); // Deep copy
    setIsEditOrderModalOpen(true);
  };

  const handleEditOrderQuantity = (itemId: string, delta: number) => {
    if (!editingOrder) return;
    const updatedItems = editingOrder.items.map(i => {
      if (i.id === itemId) return { ...i, quantity: Math.max(0, i.quantity + delta) };
      return i;
    }).filter(i => i.quantity > 0);
    const subtotal = updatedItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
    setEditingOrder({ ...editingOrder, items: updatedItems, totalPrice: subtotal });
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
    const subtotal = updatedItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
    setEditingOrder({ ...editingOrder, items: updatedItems, totalPrice: subtotal });
  };

  const handleSaveOrder = () => {
    if(!editingOrder) return;
    
    // Check Date Availability - PASS EXCLUDE ID to prevent self-collision
    const availability = checkAvailability(editingOrder.deliveryDate, editingOrder.items, editingOrder.id);
    if (!availability.allowed && availability.status !== 'available') {
       alert(availability.reason || 'Vybraný termín není dostupný.');
       return;
    }
    
    // Update fees logic (simplified)
    const itemsTotal = editingOrder.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const packagingFee = itemsTotal >= settings.packaging.freeFrom ? 0 : 50;
    
    // Keep original delivery fee unless logic is complex, for now we trust the existing fee or manual admin adjustments. 
    // In a real app, we would recalculate delivery fee based on address/region here.

    updateOrder({
      ...editingOrder,
      totalPrice: itemsTotal,
      packagingFee
    });
    setIsEditOrderModalOpen(false);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);
    
    if (newPass !== confirmPass) {
      setPassMsg({ type: 'error', text: 'Nová hesla se neshodují.' });
      return;
    }
    if (newPass.length < 4) {
      setPassMsg({ type: 'error', text: 'Heslo musí mít alespoň 4 znaky.' });
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
                        <span className="text-xs text-gray-400 ml-2 font-mono">{o.deliveryDate}</span>
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
            <h2 className="text-lg font-bold border-b pb-2">Osobní údaje</h2>
            <div>
              <label className="text-xs text-gray-400 font-bold uppercase">{t('common.name')}</label>
              <div className="font-medium">{user.name}</div>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-bold uppercase">{t('common.email')}</label>
              <div className="font-medium">{user.email}</div>
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

      {/* Address Edit Modal */}
      {modalType && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <form onSubmit={saveAddress} className="bg-white p-8 rounded-2xl w-full max-w-md space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold">{editingAddr?.id ? 'Upravit adresu' : 'Nová adresa'}</h2>
            <input placeholder="Jméno / Firma" className="w-full border rounded-lg p-3 text-sm" required value={editingAddr?.name || ''} onChange={e => setEditingAddr({...editingAddr, name: e.target.value})} />
            <input placeholder="Ulice a č.p." className="w-full border rounded-lg p-3 text-sm" required value={editingAddr?.street || ''} onChange={e => setEditingAddr({...editingAddr, street: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="Město" className="border rounded-lg p-3 text-sm" required value={editingAddr?.city || ''} onChange={e => setEditingAddr({...editingAddr, city: e.target.value})} />
              <input placeholder="PSČ" className="border rounded-lg p-3 text-sm" required value={editingAddr?.zip || ''} onChange={e => setEditingAddr({...editingAddr, zip: e.target.value})} />
            </div>
            
            {/* Added Phone Field */}
            <input placeholder="Kontaktní telefon" className="w-full border rounded-lg p-3 text-sm" required={modalType === 'delivery'} value={editingAddr?.phone || ''} onChange={e => setEditingAddr({...editingAddr, phone: e.target.value})} />

            {modalType === 'billing' && (
               <div className="grid grid-cols-2 gap-4">
                 <input placeholder="IČ (volitelné)" className="border rounded-lg p-3 text-sm" value={editingAddr?.ic || ''} onChange={e => setEditingAddr({...editingAddr, ic: e.target.value})} />
                 <input placeholder="DIČ (volitelné)" className="border rounded-lg p-3 text-sm" value={editingAddr?.dic || ''} onChange={e => setEditingAddr({...editingAddr, dic: e.target.value})} />
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
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <h3 className="font-bold text-gray-400 uppercase text-xs tracking-widest border-b pb-2">Nastavení</h3>
                    <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
                       <div className="grid grid-cols-2 gap-2">
                         <div><label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('common.date')}</label><input type="date" className="w-full border rounded p-2 text-sm" value={editingOrder.deliveryDate} onChange={e => setEditingOrder({...editingOrder, deliveryDate: e.target.value})}/></div>
                         <div><label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('checkout.delivery')}</label><select className="w-full border rounded p-2 text-sm" value={editingOrder.deliveryType} onChange={e => setEditingOrder({...editingOrder, deliveryType: e.target.value as DeliveryType})}><option value={DeliveryType.PICKUP}>{t('checkout.pickup')}</option><option value={DeliveryType.DELIVERY}>{t('admin.delivery')}</option></select></div>
                       </div>
                       <div><label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('common.street')}</label><textarea className="w-full border rounded p-2 text-sm h-20" value={editingOrder.deliveryAddress} onChange={e => setEditingOrder({...editingOrder, deliveryAddress: e.target.value})}/></div>
                       <div>
                         <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('admin.comm_lang')}</label>
                         <select className="w-full border rounded p-2 text-sm" value={editingOrder.language || Language.CS} onChange={e => setEditingOrder({...editingOrder, language: e.target.value as Language})}>
                           {Object.values(Language).map(lang => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
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
                            <th className="px-3 py-2 text-left">Název</th>
                            <th className="px-3 py-2 text-center">Ks</th>
                            <th className="px-3 py-2 text-right">Cena</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                          {editingOrder.items.map(item => (
                            <tr key={item.id}>
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
                    <div className="bg-gray-50 p-4 rounded-xl flex justify-between items-center">
                      <span className="font-bold text-sm">Celkem (odhad):</span>
                      <span className="font-bold text-lg text-accent">{editingOrder.items.reduce((sum, i) => sum + i.price * i.quantity, 0) + editingOrder.packagingFee + (editingOrder.deliveryFee || 0)} Kč</span>
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
            <h3 className="font-bold text-lg">{t('common.add_item')}</h3>
            <div className="overflow-y-auto divide-y flex-grow">
              {products.filter(p => p.visibility.online).map(p => (
                <div key={p.id} className="flex justify-between items-center py-2">
                  <div><span className="font-bold text-sm">{p.name}</span><br/><span className="text-xs text-gray-400">{p.price} Kč / {p.unit}</span></div>
                  <button onClick={() => { handleAddProductToOrder(p); setIsAddProductModalOpen(false); }} className="bg-accent text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-yellow-600 transition">Přidat</button>
                </div>
              ))}
            </div>
            <button onClick={() => setIsAddProductModalOpen(false)} className="w-full bg-gray-100 py-2 rounded-lg font-bold text-sm">{t('admin.cancel')}</button>
          </div>
         </div>
      )}

    </div>
  );
};
