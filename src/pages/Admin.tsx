
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { 
    Product, Category, DiscountCode, PackagingType, DayConfig, 
    OrderStatus, User, DeliveryRegion, PickupLocation, 
    DiscountType, RegionException, Order, Language, DeliveryType, Address 
} from '../types';
import { ALLERGENS } from '../constants';
import { 
    LayoutList, Plus, Edit, Trash2, Database, HardDrive, Server, 
    Download, Upload, FileText, Check, X, User as UserIcon, 
    Ban, ImageIcon, Store, Truck, Filter, AlertCircle, Save 
} from 'lucide-react';

const RegionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    region: Partial<DeliveryRegion>;
    onSave: (r: DeliveryRegion) => void;
    orders: Order[];
}> = ({ isOpen, onClose, region, onSave }) => {
    const [formData, setFormData] = useState<Partial<DeliveryRegion>>(region);
    const [newZip, setNewZip] = useState('');
    const [newException, setNewException] = useState<Partial<RegionException>>({ date: '', isOpen: false });

    React.useEffect(() => { setFormData(region); }, [region]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as DeliveryRegion);
    };

    const addZip = () => {
        if (newZip && !formData.zips?.includes(newZip)) {
            setFormData({ ...formData, zips: [...(formData.zips || []), newZip] });
            setNewZip('');
        }
    };

    const removeZip = (z: string) => {
        setFormData({ ...formData, zips: formData.zips?.filter(zip => zip !== z) });
    };
    
    const addException = () => {
        if(newException.date) {
            setFormData({ ...formData, exceptions: [...(formData.exceptions || []), newException as RegionException] });
            setNewException({ date: '', isOpen: false });
        }
    };

    const removeException = (date: string) => {
        setFormData({ ...formData, exceptions: formData.exceptions?.filter(e => e.date !== date) });
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
             <form onSubmit={handleSubmit} className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
                 <h3 className="font-bold text-lg">{formData.id ? 'Upravit region' : 'Nový region'}</h3>
                 <div className="space-y-3">
                    <input className="w-full border rounded p-2" placeholder="Název" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
                    <div className="grid grid-cols-2 gap-2">
                        <input type="number" className="border rounded p-2" placeholder="Cena dopravy" value={formData.price || ''} onChange={e => setFormData({...formData, price: Number(e.target.value)})} required />
                        <input type="number" className="border rounded p-2" placeholder="Zdarma od" value={formData.freeFrom || ''} onChange={e => setFormData({...formData, freeFrom: Number(e.target.value)})} required />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                         <input type="time" className="border rounded p-2" value={formData.deliveryTimeStart || ''} onChange={e => setFormData({...formData, deliveryTimeStart: e.target.value})} />
                         <input type="time" className="border rounded p-2" value={formData.deliveryTimeEnd || ''} onChange={e => setFormData({...formData, deliveryTimeEnd: e.target.value})} />
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded">
                        <label className="text-xs font-bold block mb-1">PSČ</label>
                        <div className="flex gap-2 mb-2">
                            <input className="border rounded p-1 flex-1" value={newZip} onChange={e => setNewZip(e.target.value)} placeholder="PSČ" />
                            <button type="button" onClick={addZip} className="bg-gray-200 px-3 rounded">+</button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {formData.zips?.map(z => (
                                <span key={z} className="bg-white border px-2 py-1 rounded text-xs flex items-center gap-1">{z} <button type="button" onClick={() => removeZip(z)}><X size={10}/></button></span>
                            ))}
                        </div>
                    </div>

                     <div className="bg-gray-50 p-3 rounded">
                        <label className="text-xs font-bold block mb-1">Výjimky</label>
                        <div className="flex gap-2 mb-2 items-end">
                             <input type="date" className="border rounded p-1" value={newException.date} onChange={e => setNewException({...newException, date: e.target.value})} />
                             <label className="text-xs flex items-center"><input type="checkbox" checked={newException.isOpen} onChange={e => setNewException({...newException, isOpen: e.target.checked})} /> Otevřeno</label>
                             <button type="button" onClick={addException} className="bg-gray-200 px-3 rounded">+</button>
                        </div>
                        {newException.isOpen && (
                             <div className="flex gap-2 mb-2">
                                 <input type="time" className="border rounded p-1 w-20" value={newException.deliveryTimeStart || ''} onChange={e => setNewException({...newException, deliveryTimeStart: e.target.value})} />
                                 <input type="time" className="border rounded p-1 w-20" value={newException.deliveryTimeEnd || ''} onChange={e => setNewException({...newException, deliveryTimeEnd: e.target.value})} />
                             </div>
                        )}
                        <div className="space-y-1">
                            {formData.exceptions?.map(ex => (
                                <div key={ex.date} className="flex justify-between text-xs border-b">
                                    <span>{ex.date}: {ex.isOpen ? 'JINÝ ČAS' : 'ZAVŘENO'}</span>
                                    <button type="button" onClick={() => removeException(ex.date)}><X size={10}/></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={formData.enabled ?? true} onChange={e => setFormData({...formData, enabled: e.target.checked})} />
                        <span className="text-sm">Aktivní</span>
                    </label>
                 </div>
                 <div className="flex gap-2 pt-4">
                      <button type="button" onClick={onClose} className="flex-1 py-2 bg-gray-100 rounded">Zrušit</button>
                      <button type="submit" className="flex-1 py-2 bg-primary text-white rounded">Uložit</button>
                 </div>
             </form>
        </div>
    );
};

export const Admin: React.FC = () => {
    const { 
        dataSource, setDataSource, allUsers, orders, products, discountCodes, dayConfigs, settings, 
        importDatabase, t, updateProduct, addProduct, deleteProduct, updateSettings, 
        updateDiscountCode, addDiscountCode, deleteDiscountCode, updateDayConfig, 
        updateUserAdmin, addUser, updateOrder, updateOrderStatus, formatDate, removeDiacritics, getDailyLoad,
        getDeliveryRegion, getRegionInfoForDate, getPickupPointInfo, checkAvailability
    } = useStore();

    const [activeTab, setActiveTab] = useState('orders');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [restoreSelection, setRestoreSelection] = useState({
        users: true, orders: true, products: true, discountCodes: true, dayConfigs: true, settings: true
    });
    
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
    
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
    const [editingDiscount, setEditingDiscount] = useState<Partial<DiscountCode> | null>(null);
    
    const [isPackagingModalOpen, setIsPackagingModalOpen] = useState(false);
    const [editingPackaging, setEditingPackaging] = useState<Partial<PackagingType> | null>(null);
    
    const [isDayConfigModalOpen, setIsDayConfigModalOpen] = useState(false);
    const [editingDayConfig, setEditingDayConfig] = useState<Partial<DayConfig> | null>(null);

    const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
    const [editingRegion, setEditingRegion] = useState<Partial<DeliveryRegion> | null>(null);
    
    const [isPickupModalOpen, setIsPickupModalOpen] = useState(false);
    const [editingPickup, setEditingPickup] = useState<Partial<PickupLocation> | null>(null);
    const [newPickupException, setNewPickupException] = useState<Partial<RegionException>>({ date: '', isOpen: false });

    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [userForm, setUserForm] = useState({ name: '', email: '', phone: '', role: 'customer' as 'customer' | 'admin' | 'driver' });

    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [orderSaveError, setOrderSaveError] = useState<string | null>(null);

    const [showLoadHistory, setShowLoadHistory] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [userFilters, setUserFilters] = useState({ search: '', spentMin: '', spentMax: '', ordersMin: '', ordersMax: '', marketing: '', status: '' });
    
    // Order Filters
    const [orderFilters, setOrderFilters] = useState({ id: '', dateFrom: '', dateTo: '', customer: '', status: '', ic: '' });
    
    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const [notifyCustomer, setNotifyCustomer] = useState(false);
    
    const [confirmDelete, setConfirmDelete] = useState<{type: string, id: string, name?: string} | null>(null);

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);
    
    // Helpers for Edit Order Modal
    const [selectedDeliveryAddrId, setSelectedDeliveryAddrId] = useState('');
    const [selectedBillingAddrId, setSelectedBillingAddrId] = useState('');
    const orderUser = useMemo(() => editingOrder ? allUsers.find(u => u.id === editingOrder.userId) : null, [editingOrder, allUsers]);

    const loadDates = useMemo(() => {
        const dates = new Set<string>();
        orders.forEach(o => dates.add(o.deliveryDate));
        dayConfigs.forEach(c => dates.add(c.date));
        const today = new Date().toISOString().split('T')[0];
        if (!showLoadHistory) {
             return Array.from(dates).filter(d => d >= today).sort();
        }
        return Array.from(dates).sort().reverse();
    }, [orders, dayConfigs, showLoadHistory]);

    const filteredUsers = useMemo(() => {
        return allUsers.filter(u => {
            if (userFilters.search) {
                const term = userFilters.search.toLowerCase();
                if (!u.name.toLowerCase().includes(term) && !u.email.toLowerCase().includes(term)) return false;
            }
            if (userFilters.marketing === 'yes' && !u.marketingConsent) return false;
            if (userFilters.marketing === 'no' && u.marketingConsent) return false;
            if (userFilters.status === 'active' && u.isBlocked) return false;
            if (userFilters.status === 'blocked' && !u.isBlocked) return false;
            
            const userOrders = orders.filter(o => o.userId === u.id);
            const spent = userOrders.reduce((sum, o) => sum + o.totalPrice, 0);
            
            if (userFilters.spentMin && spent < Number(userFilters.spentMin)) return false;
            if (userFilters.spentMax && spent > Number(userFilters.spentMax)) return false;
            if (userFilters.ordersMin && userOrders.length < Number(userFilters.ordersMin)) return false;
            if (userFilters.ordersMax && userOrders.length > Number(userFilters.ordersMax)) return false;
            
            return true;
        });
    }, [allUsers, orders, userFilters]);

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

    const getCategoryName = (id: string) => sortedCategories.find(c => c.id === id)?.name || id;
    
    const getDayCapacityLimit = (date: string, catId: string) => {
        const config = dayConfigs.find(d => d.date === date);
        return config?.capacityOverrides?.[catId] ?? settings.defaultCapacities[catId] ?? 0;
    };

    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && editingProduct) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setEditingProduct(prev => ({ ...prev, images: [...(prev?.images || []), base64] }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUserExport = () => {
        const csvContent = "data:text/csv;charset=utf-8," 
            + ["ID,Name,Email,Phone,Role,Marketing,Status"].join(",") + "\n"
            + filteredUsers.filter(u => selectedUserIds.includes(u.id)).map(u => 
                `${u.id},"${u.name}",${u.email},${u.phone},${u.role},${u.marketingConsent?'YES':'NO'},${u.isBlocked?'BLOCKED':'ACTIVE'}`
            ).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "users_export.csv");
        document.body.appendChild(link);
        link.click();
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

    const openUserModal = (u?: User) => {
        setEditingUser(u || null);
        setUserForm(u ? { name: u.name, email: u.email, phone: u.phone, role: u.role } : { name: '', email: '', phone: '', role: 'customer' });
        setIsUserModalOpen(true);
    };

    const handleUserModalSave = async () => {
        if (editingUser) {
            await updateUserAdmin({ ...editingUser, ...userForm });
        } else {
            await addUser(userForm.name, userForm.email, userForm.phone, userForm.role);
        }
        setIsUserModalOpen(false);
    };

    const openOrderModal = (o: Order) => {
        setEditingOrder(JSON.parse(JSON.stringify(o)));
        setOrderSaveError(null);
        setSelectedDeliveryAddrId(''); 
        setSelectedBillingAddrId(''); 
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
            // Delivery
            if (!editingOrder.deliveryAddress) {
                setOrderSaveError('Vyplňte doručovací adresu.');
                return;
            }
            // Parse ZIP from address string or use selected logic. 
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

        // 2. Validate Capacity (excluding this order's own load)
        const availability = checkAvailability(editingOrder.deliveryDate, editingOrder.items, editingOrder.id);
        if (!availability.allowed && availability.status !== 'available') {
            setOrderSaveError(`Kapacita: ${availability.reason || 'Termín není dostupný'}`);
            return;
        }

        // 3. Save
        const success = await updateOrder(editingOrder);
        if (success) setIsOrderModalOpen(false);
        else setOrderSaveError('Chyba při ukládání (API Error).');
    };

    const handleSelectDeliveryAddress = (addrId: string) => {
        setSelectedDeliveryAddrId(addrId);
        if (!addrId || !orderUser) return;
        const addr = orderUser.deliveryAddresses.find(a => a.id === addrId);
        if (addr) {
            setEditingOrder(prev => prev ? {
                ...prev,
                deliveryAddress: `${addr.name}\n${addr.street}\n${addr.city}\n${addr.zip}\nTel: ${addr.phone}`
            } : null);
        }
    };

    const handleSelectBillingAddress = (addrId: string) => {
        setSelectedBillingAddrId(addrId);
        if (!addrId || !orderUser) return;
        const addr = orderUser.billingAddresses.find(a => a.id === addrId);
        if (addr) {
            setEditingOrder(prev => prev ? {
                ...prev,
                billingAddress: `${addr.name}, ${addr.street}, ${addr.city}${addr.ic ? `, IČ: ${addr.ic}` : ''}${addr.dic ? `, DIČ: ${addr.dic}` : ''}`
            } : null);
        }
    };

    const handleBulkStatusChange = async (status: OrderStatus) => {
        if (!status) return;
        if (confirm(`Opravdu změnit stav ${selectedOrders.length} objednávek na ${status}?`)) {
            await updateOrderStatus(selectedOrders, status, notifyCustomer);
            setSelectedOrders([]);
        }
    };

    const handleCategoryDeleteCheck = (cat: Category) => {
        const hasProducts = products.some(p => p.category === cat.id && !p.visibility.online);
        if (hasProducts) {
             alert('Kategorie obsahuje produkty. Nelze smazat.');
             return;
        }
        const newCats = settings.categories.filter(c => c.id !== cat.id);
        updateSettings({...settings, categories: newCats});
    };
    
    const handleProductDeleteCheck = (p: Product) => {
         setConfirmDelete({type: 'product', id: p.id, name: p.name});
    };
    
    const savePickup = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!editingPickup) return;
        let newLocations = [...(settings.pickupLocations || [])];
        const loc = { ...editingPickup } as PickupLocation;
        
        if (!loc.id) {
            loc.id = 'loc-' + Date.now();
            newLocations.push(loc);
        } else {
            newLocations = newLocations.map(l => l.id === loc.id ? loc : l);
        }
        await updateSettings({ ...settings, pickupLocations: newLocations });
        setIsPickupModalOpen(false);
    };
    
    const addPickupException = () => {
        if (!newPickupException.date) return;

        if (!newPickupException.isOpen) {
            const conflictingOrders = orders.filter(o => {
                if (o.deliveryDate !== newPickupException.date) return false;
                if (o.status === OrderStatus.CANCELLED) return false;
                if (o.deliveryType !== 'pickup') return false; 
                return o.pickupLocationId === editingPickup?.id;
            });

            if (conflictingOrders.length > 0) {
                alert(`Nelze uzavřít tento den (${newPickupException.date}) pro toto odběrné místo.\n\nExistuje ${conflictingOrders.length} aktivních objednávek, které mají toto místo a datum zvolené.`);
                return;
            }
        }

        if (editingPickup?.exceptions?.some(e => e.date === newPickupException.date)) {
            alert('Výjimka pro toto datum již existuje.');
            return;
        }

        setEditingPickup(prev => ({
            ...prev,
            exceptions: [...(prev?.exceptions || []), newPickupException as RegionException]
        }));
        setNewPickupException({ date: '', isOpen: false });
    };
    
    const removePickupException = (date: string) => {
         setEditingPickup(prev => ({
            ...prev,
            exceptions: prev?.exceptions?.filter(e => e.date !== date)
         }));
    };
    
    const saveRegion = async (r: DeliveryRegion) => {
        let newRegions = [...settings.deliveryRegions];
        if(!r.id) {
            r.id = 'reg-' + Date.now();
            newRegions.push(r);
        } else {
            newRegions = newRegions.map(reg => reg.id === r.id ? r : reg);
        }
        await updateSettings({...settings, deliveryRegions: newRegions});
        setIsRegionModalOpen(false);
    };

    React.useEffect(() => {
        if (confirmDelete) {
            if (confirm(`Opravdu smazat ${confirmDelete.name || 'položku'}?`)) {
                if (confirmDelete.type === 'product') deleteProduct(confirmDelete.id);
                if (confirmDelete.type === 'discount') deleteDiscountCode(confirmDelete.id);
                if (confirmDelete.type === 'packaging') {
                    const newPkg = settings.packaging.types.filter(p => p.id !== confirmDelete.id);
                    updateSettings({...settings, packaging: {...settings.packaging, types: newPkg}});
                }
                if (confirmDelete.type === 'exception') {
                    // handled elsewhere
                }
                if (confirmDelete.type === 'region') {
                     const newRegs = settings.deliveryRegions.filter(r => r.id !== confirmDelete.id);
                     updateSettings({...settings, deliveryRegions: newRegs});
                }
                if (confirmDelete.type === 'pickup') {
                     const newLocs = settings.pickupLocations.filter(l => l.id !== confirmDelete.id);
                     updateSettings({...settings, pickupLocations: newLocs});
                }
            }
            setConfirmDelete(null);
        }
    }, [confirmDelete]);

    const saveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct) return;
        const prod = { ...editingProduct } as Product;
        if (!prod.id) prod.id = Date.now().toString();
        
        if (!prod.images) prod.images = [];
        if (!prod.visibility) prod.visibility = { online: true, store: true, stand: true };
        if (!prod.allergens) prod.allergens = [];
        
        prod.vatRateInner = Number(prod.vatRateInner ?? 0);
        prod.vatRateTakeaway = Number(prod.vatRateTakeaway ?? 0);
        prod.workload = Number(prod.workload ?? 0);
        prod.workloadOverhead = Number(prod.workloadOverhead ?? 0);
        
        if (products.some(p => p.id === prod.id)) await updateProduct(prod);
        else await addProduct(prod);
        setIsProductModalOpen(false);
    };

    const saveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCategory) return;
        
        const newCats = [...settings.categories];
        const cat = { ...editingCategory } as Category;
        
        if (!cat.id) {
            cat.id = removeDiacritics(cat.name).toLowerCase().replace(/\s+/g, '-');
            if (newCats.some(c => c.id === cat.id)) {
                alert('Kategorie s tímto ID již existuje.');
                return;
            }
        }
        
        if (newCats.some(c => c.id === cat.id)) {
            const index = newCats.findIndex(c => c.id === cat.id);
            newCats[index] = cat;
        } else {
            newCats.push(cat);
        }
        
        await updateSettings({ ...settings, categories: newCats });
        setIsCategoryModalOpen(false);
    };

    const saveDiscount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDiscount) return;
        const disc = { ...editingDiscount } as DiscountCode;
        if (discountCodes.some(d => d.id === disc.id)) await updateDiscountCode(disc);
        else await addDiscountCode(disc);
        setIsDiscountModalOpen(false);
    };

    const savePackaging = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPackaging) return;
        let updatedTypes = [...settings.packaging.types];
        const pkg = { ...editingPackaging } as PackagingType;
        if (updatedTypes.some(p => p.id === pkg.id)) {
            updatedTypes = updatedTypes.map(p => p.id === pkg.id ? pkg : p);
        } else {
            updatedTypes.push({ ...pkg, id: 'pkg-' + Date.now() });
        }
        await updateSettings({ ...settings, packaging: { ...settings.packaging, types: updatedTypes } });
        setIsPackagingModalOpen(false);
    };

    const saveDayConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDayConfig) return;
        await updateDayConfig(editingDayConfig as DayConfig);
        setIsDayConfigModalOpen(false);
    };

    const saveOperator = async (e: React.FormEvent) => {
        e.preventDefault();
        await updateSettings({ ...settings });
        alert('Nastavení uloženo.');
    };

    const getRestoreLabel = (key: string) => {
        switch(key) {
            case 'users': return t('admin.users');
            case 'orders': return t('admin.orders');
            case 'products': return t('admin.products');
            case 'discountCodes': return t('admin.discounts');
            case 'dayConfigs': return t('admin.exceptions'); 
            case 'settings': return t('admin.settings');
            default: return key;
        }
    };

    const handleImport = async () => {
        if (!importFile) return;
        
        const readFile = (file: File): Promise<string> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target?.result as string);
                reader.onerror = e => reject(e);
                reader.readAsText(file);
            });
        };

        try {
            const text = await readFile(importFile);
            const data = JSON.parse(text);
            
            if (!window.confirm('Opravdu chcete přepsat stávající data? Tato akce je nevratná.')) return;
            
            const res = await importDatabase(data, restoreSelection);
            if (res.success) {
                alert(t('admin.import_success'));
                setImportFile(null);
            } else {
                alert('Import failed: ' + res.message);
            }
        } catch (e: any) {
            console.error(e);
            alert('Chyba při zpracování souboru: ' + e.message);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* ... Dashboard Header & Tabs ... */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-serif font-bold text-gray-800 tracking-tight">{t('admin.dashboard')}</h1>
                <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl shadow-sm overflow-x-auto">
                {(['orders', 'users', 'load', 'products', 'categories', 'delivery', 'pickup', 'capacities', 'discounts', 'packaging', 'operator', 'payments', 'backup', 'db'] as const).map(tab => (
                    <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)} 
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition whitespace-nowrap ${activeTab === tab ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:bg-white/50'}`}
                    >
                    {tab === 'db' ? 'DB' : tab === 'categories' ? 'Kategorie' : tab === 'pickup' ? 'Odběr' : t(`admin.${tab}`)}
                    </button>
                ))}
                </div>
            </div>

            {activeTab === 'db' && (
                <div className="animate-fade-in space-y-8">
                <div className="bg-white p-8 rounded-2xl border shadow-sm max-w-2xl mx-auto text-center">
                    <h2 className="text-2xl font-bold mb-6 flex items-center justify-center gap-2">
                        <Database className="text-accent" /> Databázové připojení
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => { if (dataSource !== 'api') setDataSource('local'); }}
                            disabled={dataSource === 'api'}
                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${dataSource === 'local' ? 'border-accent bg-yellow-50/50' : dataSource === 'api' ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                            <div className={`p-4 rounded-full ${dataSource === 'local' ? 'bg-accent text-white' : 'bg-gray-100 text-gray-400'}`}><HardDrive size={32} /></div>
                            <div><h3 className="font-bold text-lg">Interní paměť</h3></div>
                            {dataSource === 'local' && <Check className="text-green-500" />}
                        </button>
                        <button 
                            onClick={() => setDataSource('api')}
                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${dataSource === 'api' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                            <div className={`p-4 rounded-full ${dataSource === 'api' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}><Server size={32} /></div>
                            <div><h3 className="font-bold text-lg">MariaDB</h3></div>
                            {dataSource === 'api' && <Check className="text-green-500" />}
                        </button>
                    </div>
                </div>
                </div>
            )}

            {activeTab === 'backup' && (
            <div className="bg-white p-8 rounded-xl shadow-sm border max-w-2xl mx-auto animate-fade-in">
                <h2 className="text-xl font-bold mb-6 flex items-center justify-center gap-2"><Database className="text-primary"/> {t('admin.backup')}</h2>
                <div className="bg-gray-50 p-4 rounded-lg text-center mb-8 border">
                    <p className="text-sm text-gray-500 mb-1">Aktuální zdroj dat</p>
                    <p className="font-bold text-lg text-primary flex items-center justify-center gap-2">
                        {dataSource === 'api' ? <Server size={18} className="text-blue-600"/> : <HardDrive size={18} className="text-accent"/>}
                        {dataSource === 'api' ? 'MariaDB (Databáze)' : 'Lokální Paměť (Browser)'}
                    </p>
                </div>
                <div className="space-y-8">
                    <div>
                        <h3 className="font-bold text-lg mb-2 flex items-center"><Download size={18} className="mr-2"/> {t('admin.export_title')}</h3>
                        <p className="text-sm text-gray-500 mb-4">{t('admin.export_desc')}</p>
                        <button onClick={() => {
                            const data = { users: allUsers, orders, products, discountCodes, dayConfigs, settings };
                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `backup_4gracie_${formatDate(new Date().toISOString())}_${dataSource}.json`;
                            a.click();
                        }} className="w-full bg-primary text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center hover:bg-gray-800 transition"><Download size={20} className="mr-2"/> Stáhnout JSON Zálohu</button>
                    </div>
                    <div className="border-t pt-6">
                        <h3 className="font-bold text-lg mb-2 flex items-center"><Upload size={18} className="mr-2"/> {t('admin.import_title')}</h3>
                        <p className="text-sm text-gray-500 mb-4">{t('admin.import_desc')}</p>
                        {dataSource === 'api' && (
                            <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-xs mb-4 flex items-start">
                                <Server size={16} className="mr-2 flex-shrink-0 mt-0.5"/>
                                Import proběhne jako transakce do databáze. Všechna stávající data budou nahrazena daty ze souboru.
                            </div>
                        )}
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition cursor-pointer relative mb-4">
                            <input 
                                type="file" 
                                accept=".json" 
                                onChange={e => setImportFile(e.target.files ? e.target.files[0] : null)} 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            {importFile ? (
                                <div className="text-green-600 font-bold flex flex-col items-center">
                                    <FileText size={32} className="mb-2"/>
                                    {importFile.name}
                                </div>
                            ) : (
                                <div className="text-gray-400 flex flex-col items-center">
                                    <Upload size={32} className="mb-2"/>
                                    <span>Klikněte pro výběr souboru</span>
                                </div>
                            )}
                        </div>
                        {importFile && (
                            <div className="mb-4 bg-gray-50 p-4 rounded-xl border">
                                <h4 className="font-bold text-sm mb-2">{t('admin.restore_sections')}</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {(Object.keys(restoreSelection) as Array<keyof typeof restoreSelection>).map(key => (
                                        <label key={key} className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={restoreSelection[key]} 
                                                onChange={e => setRestoreSelection({...restoreSelection, [key]: e.target.checked})}
                                                className="rounded text-accent focus:ring-accent"
                                            />
                                            <span className="capitalize">{getRestoreLabel(key as string)}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                        {importFile && (
                            <button 
                                onClick={handleImport} 
                                className="mt-2 w-full bg-red-600 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center hover:bg-red-700 transition shadow-lg"
                            >
                                <Upload size={20} className="mr-2"/> {t('admin.perform_import')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
            )}

            {activeTab === 'orders' && (
                <div className="animate-fade-in space-y-4">
                <div className="flex justify-between mb-4">
                    <button onClick={exportToAccounting} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow-sm"><FileText size={16} className="mr-2 text-green-600" /> {t('admin.export')}</button>
                    {selectedOrders.length > 0 && (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-accent/10 px-3 py-1 rounded-lg border border-accent/20">
                        <span className="text-[10px] font-bold text-primary mr-3">{t('admin.orders')}: {selectedOrders.length}</span>
                        <select className="text-[10px] border rounded bg-white p-1 mr-2" onChange={e => handleBulkStatusChange(e.target.value as OrderStatus)}>
                            <option value="">{t('admin.status_update')}...</option>
                            {Object.values(OrderStatus).map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
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
                            {Object.values(OrderStatus).map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
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
                </div>
            )}

            {activeTab === 'users' && (
                <div className="animate-fade-in space-y-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-primary flex items-center"><UserIcon className="mr-2 text-accent" /> {t('admin.user_management')}</h2>
                    <div className="flex gap-2">
                        {selectedUserIds.length > 0 && (
                            <button onClick={handleUserExport} className="bg-white border border-green-500 text-green-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center hover:bg-green-50">
                                <Download size={16} className="mr-2"/> Exportovat vybrané ({selectedUserIds.length})
                            </button>
                        )}
                        <button onClick={() => openUserModal()} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"><Plus size={16} className="mr-2"/> {t('admin.new_user')}</button>
                    </div>
                </div>
                
                <div className="bg-white p-4 rounded-2xl border shadow-sm mb-4">
                    <div className="flex flex-wrap gap-4 text-xs items-end">
                        <div className="flex-1 min-w-[200px]">
                            <div className="mb-1 font-bold text-gray-400">Hledat (Jméno, Email)</div>
                            <input type="text" className="w-full border rounded p-2" placeholder="Text..." value={userFilters.search} onChange={e => setUserFilters({...userFilters, search: e.target.value})} />
                        </div>
                        <div>
                            <div className="mb-1 font-bold text-gray-400">{t('common.spent')} (Kč)</div>
                            <div className="flex gap-2">
                                <input type="number" className="w-20 border rounded p-2" placeholder="Od" value={userFilters.spentMin} onChange={e => setUserFilters({...userFilters, spentMin: e.target.value})} />
                                <input type="number" className="w-20 border rounded p-2" placeholder="Do" value={userFilters.spentMax} onChange={e => setUserFilters({...userFilters, spentMax: e.target.value})} />
                            </div>
                        </div>
                        <div>
                            <div className="mb-1 font-bold text-gray-400">{t('admin.orders')}</div>
                            <div className="flex gap-2">
                                <input type="number" className="w-16 border rounded p-2" placeholder="Od" value={userFilters.ordersMin} onChange={e => setUserFilters({...userFilters, ordersMin: e.target.value})} />
                                <input type="number" className="w-16 border rounded p-2" placeholder="Do" value={userFilters.ordersMax} onChange={e => setUserFilters({...userFilters, ordersMax: e.target.value})} />
                            </div>
                        </div>
                        <div>
                            <div className="mb-1 font-bold text-gray-400">Marketing</div>
                            <select className="border rounded p-2 bg-white w-24" value={userFilters.marketing} onChange={e => setUserFilters({...userFilters, marketing: e.target.value})}>
                                <option value="">{t('filter.all')}</option>
                                <option value="yes">{t('common.yes')}</option>
                                <option value="no">{t('common.no')}</option>
                            </select>
                        </div>
                        <div>
                            <div className="mb-1 font-bold text-gray-400">{t('common.status')}</div>
                            <select className="border rounded p-2 bg-white w-24" value={userFilters.status} onChange={e => setUserFilters({...userFilters, status: e.target.value})}>
                                <option value="">{t('filter.all')}</option>
                                <option value="active">{t('common.active')}</option>
                                <option value="blocked">{t('common.blocked')}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                        <tr>
                        <th className="px-6 py-4 text-center w-10">
                            <input 
                                type="checkbox" 
                                onChange={e => setSelectedUserIds(e.target.checked ? filteredUsers.map(u => u.id) : [])} 
                                checked={selectedUserIds.length > 0 && selectedUserIds.length === filteredUsers.length} 
                            />
                        </th>
                        <th className="px-6 py-4 text-left">{t('common.name')}</th>
                        <th className="px-6 py-4 text-left">{t('common.email')}</th>
                        <th className="px-6 py-4 text-left">{t('common.role')}</th>
                        <th className="px-6 py-4 text-center">{t('admin.orders')}</th>
                        <th className="px-6 py-4 text-right">{t('common.spent')}</th>
                        <th className="px-6 py-4 text-center">Marketing</th>
                        <th className="px-6 py-4 text-center">{t('common.status')}</th>
                        <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                        {filteredUsers.map(u => {
                        const userOrders = orders.filter(o => o.userId === u.id);
                        const totalSpent = userOrders.reduce((sum, o) => sum + o.totalPrice + o.packagingFee + (o.deliveryFee||0), 0);
                        return (
                            <tr key={u.id} className={`hover:bg-gray-50 ${u.isBlocked ? 'bg-red-50' : ''}`}>
                            <td className="px-6 py-4 text-center">
                                <input 
                                    type="checkbox" 
                                    checked={selectedUserIds.includes(u.id)} 
                                    onChange={() => setSelectedUserIds(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])} 
                                />
                            </td>
                            <td className="px-6 py-4 font-bold">{u.name}</td>
                            <td className="px-6 py-4 text-gray-600">{u.email}<br/><span className="text-[10px]">{u.phone}</span></td>
                            <td className="px-6 py-4 uppercase font-bold text-[10px]">{u.role}</td>
                            <td className="px-6 py-4 text-center">{userOrders.length}</td>
                            <td className="px-6 py-4 text-right font-mono">{totalSpent} Kč</td>
                            <td className="px-6 py-4 text-center">
                                {u.marketingConsent ? <span className="text-green-600 font-bold">ANO</span> : <span className="text-gray-400">NE</span>}
                            </td>
                            <td className="px-6 py-4 text-center">
                                {u.isBlocked ? <span className="text-red-600 font-bold flex items-center justify-center"><Ban size={14} className="mr-1"/> {t('common.blocked')}</span> : <span className="text-green-600 font-bold">{t('common.active')}</span>}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <button onClick={() => openUserModal(u)} className="text-blue-600 font-bold hover:underline">{t('common.detail_edit')}</button>
                            </td>
                            </tr>
                        );
                        })}
                    </tbody>
                    </table>
                </div>
                </div>
            )}

            {activeTab === 'categories' && (
                <div className="animate-fade-in space-y-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-primary flex items-center"><LayoutList className="mr-2 text-accent" /> Kategorie produktů</h2>
                    <button onClick={() => { setEditingCategory({ order: sortedCategories.length + 1, enabled: true }); setIsCategoryModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"><Plus size={16} className="mr-2"/> Nová kategorie</button>
                </div>

                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y">
                        <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                            <tr>
                                <th className="px-6 py-4 text-left">Pořadí</th>
                                <th className="px-6 py-4 text-left">Název</th>
                                <th className="px-6 py-4 text-left">ID (Slug)</th>
                                <th className="px-6 py-4 text-center">Viditelnost</th>
                                <th className="px-6 py-4 text-right">Akce</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                            {sortedCategories.map(cat => (
                                <tr key={cat.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-mono font-bold text-gray-500">{cat.order}</td>
                                    <td className="px-6 py-4 font-bold text-sm">{cat.name}</td>
                                    <td className="px-6 py-4 font-mono text-gray-400">{cat.id}</td>
                                    <td className="px-6 py-4 text-center">
                                        {cat.enabled ? <span className="text-green-500 font-bold">Aktivní</span> : <span className="text-gray-400">Skryto</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button onClick={() => { setEditingCategory(cat); setIsCategoryModalOpen(true); }} className="p-1 hover:text-primary"><Edit size={16}/></button>
                                        <button onClick={() => handleCategoryDeleteCheck(cat)} className="p-1 hover:text-red-500 text-gray-400"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {sortedCategories.length === 0 && (
                        <div className="p-8 text-center text-gray-400">Žádná kategorie</div>
                    )}
                </div>
                </div>
            )}

            {/* Other tabs rendering calls (Products, Load, etc) */}
            {activeTab === 'products' && (
                <div className="animate-fade-in space-y-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-primary">{t('admin.products')}</h2>
                    <button onClick={() => { setEditingProduct({}); setIsProductModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"><Plus size={16} className="mr-2"/> {t('admin.add_product')}</button>
                </div>
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                        <tr>
                        <th className="px-6 py-4 text-left">Foto</th>
                        <th className="px-6 py-4 text-left">Název</th>
                        <th className="px-6 py-4 text-left">Kategorie</th>
                        <th className="px-6 py-4 text-left">Cena</th>
                        <th className="px-6 py-4 text-center">Online</th>
                        <th className="px-6 py-4 text-right">Akce</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                        {products.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                            {p.images?.[0] ? <img src={p.images[0]} className="w-10 h-10 object-cover rounded" /> : <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center"><ImageIcon size={16} className="text-gray-400"/></div>}
                            </td>
                            <td className="px-6 py-4 font-bold">{p.name}</td>
                            <td className="px-6 py-4">{getCategoryName(p.category)}</td>
                            <td className="px-6 py-4">{p.price} Kč / {p.unit}</td>
                            <td className="px-6 py-4 text-center">{p.visibility?.online ? <Check size={16} className="inline text-green-500"/> : <X size={16} className="inline text-gray-300"/>}</td>
                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                            <button onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }} className="p-1 hover:text-primary"><Edit size={16}/></button>
                            <button onClick={() => handleProductDeleteCheck(p)} className="p-1 hover:text-red-500 text-gray-400"><Trash2 size={16}/></button>
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                </div>
            )}

            {activeTab === 'load' && (
                <div className="animate-fade-in space-y-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-primary">{t('admin.load')}</h2>
                    <button onClick={() => setShowLoadHistory(!showLoadHistory)} className="text-xs bg-white border px-3 py-1 rounded hover:bg-gray-50">
                    {showLoadHistory ? t('admin.view_current') : t('admin.view_history')}
                    </button>
                </div>
                
                <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
                    <table className="min-w-full divide-y">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                        <tr>
                        <th className="px-6 py-4 text-left min-w-[120px]">Datum</th>
                        <th className="px-6 py-4 text-left w-32">Stav</th>
                        {sortedCategories.map(cat => (
                            <th key={cat.id} className="px-6 py-4 text-left min-w-[150px]">{cat.name}</th>
                        ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                        {loadDates.map(date => {
                        const load = getDailyLoad(date);
                        const dayConfig = dayConfigs.find(d => d.date === date);
                        const isClosed = dayConfig && !dayConfig.isOpen;
                        
                        return (
                            <tr key={date} className={`hover:bg-gray-50 ${isClosed ? 'bg-red-50' : ''}`}>
                            <td className="px-6 py-4 font-mono font-bold text-sm">
                                {formatDate(date)}
                            </td>
                            <td className="px-6 py-4">
                                {isClosed ? 
                                <span className="text-red-600 font-bold uppercase text-[10px]">{t('admin.exception_closed')}</span> 
                                : <span className="text-green-600 font-bold uppercase text-[10px]">Otevřeno</span>
                                }
                            </td>
                            {sortedCategories.map(cat => {
                                const limit = getDayCapacityLimit(date, cat.id);
                                const current = load[cat.id] || 0;
                                const percent = limit > 0 ? Math.min(100, (current / limit) * 100) : 0;
                                let color = 'bg-green-500';
                                if (percent > 80) color = 'bg-orange-500';
                                if (percent >= 100) color = 'bg-red-500';
                                
                                return (
                                <td key={cat.id} className="px-6 py-4 align-middle">
                                    <div className="w-full">
                                    <div className="flex justify-between mb-1">
                                        <span className="font-mono text-[10px]">{Math.round(current)} / {limit}</span>
                                        <span className="font-bold text-[10px]">{Math.round(percent)}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-full border border-gray-100">
                                        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${percent}%` }}></div>
                                    </div>
                                    </div>
                                </td>
                                );
                            })}
                            </tr>
                        );
                        })}
                    </tbody>
                    </table>
                    {loadDates.length === 0 && (
                        <div className="p-8 text-center text-gray-400">Žádná data pro zobrazení</div>
                    )}
                </div>
                </div>
            )}

            {activeTab === 'discounts' && (
                <div className="animate-fade-in space-y-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-primary">{t('admin.discounts')}</h2>
                    <button onClick={() => { setEditingDiscount({ id: Date.now().toString(), enabled: true, type: DiscountType.PERCENTAGE }); setIsDiscountModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"><Plus size={16} className="mr-2"/> {t('admin.add_discount')}</button>
                </div>
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                        <tr>
                        <th className="px-6 py-4 text-left">Kód</th>
                        <th className="px-6 py-4 text-left">Hodnota</th>
                        <th className="px-6 py-4 text-left">Platnost</th>
                        <th className="px-6 py-4 text-center">Stav</th>
                        <th className="px-6 py-4 text-right">Akce</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                        {discountCodes.map(d => (
                        <tr key={d.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-mono font-bold">{d.code}</td>
                            <td className="px-6 py-4">{d.value} {d.type === DiscountType.PERCENTAGE ? '%' : 'Kč'}</td>
                            <td className="px-6 py-4">{d.validFrom || '∞'} - {d.validTo || '∞'}</td>
                            <td className="px-6 py-4 text-center">{d.enabled ? <span className="text-green-500 font-bold">Aktivní</span> : <span className="text-red-500">Neaktivní</span>}</td>
                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                            <button onClick={() => { setEditingDiscount(d); setIsDiscountModalOpen(true); }} className="p-1 hover:text-primary"><Edit size={16}/></button>
                            <button onClick={() => setConfirmDelete({type: 'discount', id: d.id, name: d.code})} className="p-1 hover:text-red-500 text-gray-400"><Trash2 size={16}/></button>
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                </div>
            )}

            {activeTab === 'packaging' && (
                <div className="animate-fade-in space-y-6">
                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <h3 className="font-bold mb-4">{t('admin.settings')}</h3>
                    <div className="flex items-center gap-4">
                    <label className="text-sm text-gray-600">{t('admin.pkg_limit')} (Kč):</label>
                    <input type="number" className="border rounded p-2 w-32" value={settings.packaging.freeFrom} onChange={e => updateSettings({...settings, packaging: {...settings.packaging, freeFrom: Number(e.target.value)}})} />
                    <button onClick={() => updateSettings(settings)} className="text-xs bg-primary text-white px-3 py-2 rounded font-bold">Uložit limit</button>
                    </div>
                </div>
                
                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold">{t('admin.packaging')}</h3>
                    <button onClick={() => { setEditingPackaging({}); setIsPackagingModalOpen(true); }} className="bg-white border hover:bg-gray-50 px-3 py-1 rounded text-xs font-bold flex items-center"><Plus size={14} className="mr-1"/> {t('admin.pkg_new')}</button>
                    </div>
                    <div className="space-y-2">
                    {settings.packaging.types.map(p => (
                        <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                        <div>
                            <span className="font-bold text-sm block">{p.name}</span>
                            <span className="text-xs text-gray-500">{p.volume} ml</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-bold text-sm">{p.price} Kč</span>
                            <button onClick={() => { setEditingPackaging(p); setIsPackagingModalOpen(true); }} className="text-gray-400 hover:text-primary"><Edit size={16}/></button>
                            <button onClick={() => setConfirmDelete({type: 'packaging', id: p.id, name: p.name})} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
                        </div>
                        </div>
                    ))}
                    </div>
                </div>
                </div>
            )}

            {activeTab === 'delivery' && (
                <div className="animate-fade-in space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-primary">{t('admin.delivery')}</h2>
                    <button onClick={() => { setEditingRegion({ enabled: true, zips: [], exceptions: [] }); setIsRegionModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"><Plus size={16} className="mr-2"/> {t('admin.zone_new')}</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {settings.deliveryRegions.map(r => (
                    <div key={r.id} className={`bg-white p-6 rounded-2xl border shadow-sm ${!r.enabled ? 'opacity-75 bg-gray-50' : ''}`}>
                        <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="font-bold text-lg">{r.name}</h3>
                            <div className="text-xs text-gray-500 mt-1">{r.deliveryTimeStart || '?'} - {r.deliveryTimeEnd || '?'}</div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setEditingRegion(r); setIsRegionModalOpen(true); }} className="p-1 hover:bg-gray-100 rounded"><Edit size={16}/></button>
                            <button onClick={() => setConfirmDelete({type: 'region', id: r.id, name: r.name})} className="p-1 hover:bg-red-50 rounded text-red-500"><Trash2 size={16}/></button>
                        </div>
                        </div>
                        <div className="flex justify-between text-sm mb-4 bg-gray-50 p-3 rounded-lg">
                        <div>Cena: <strong>{r.price} Kč</strong></div>
                        <div>Zdarma od: <strong>{r.freeFrom} Kč</strong></div>
                        </div>
                        <div className="text-xs text-gray-500 font-mono break-all">{r.zips.join(', ')}</div>
                        
                        {r.exceptions && r.exceptions.length > 0 && (
                            <div className="mt-4 border-t pt-3">
                                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Výjimky v kalendáři:</div>
                                <div className="space-y-1">
                                    {r.exceptions.map((ex, idx) => (
                                        <div key={idx} className="flex justify-between text-xs bg-gray-50 p-1.5 rounded">
                                            <span className="font-mono">{ex.date}</span>
                                            <span>
                                                {ex.isOpen ? (
                                                    <span className="text-blue-600 font-bold">Změna času ({ex.deliveryTimeStart}-{ex.deliveryTimeEnd})</span>
                                                ) : (
                                                    <span className="text-red-600 font-bold">ZAVŘENO</span>
                                                )}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    ))}
                </div>
                </div>
            )}

            {activeTab === 'pickup' && (
                <div className="animate-fade-in space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-primary flex items-center"><Store className="mr-2 text-accent"/> Odběrná místa</h2>
                        <button 
                            onClick={() => { 
                                setEditingPickup({ 
                                    enabled: true, 
                                    exceptions: [], 
                                    openingHours: { 
                                        1: { isOpen: true, start: '08:00', end: '18:00' },
                                        2: { isOpen: true, start: '08:00', end: '18:00' },
                                        3: { isOpen: true, start: '08:00', end: '18:00' },
                                        4: { isOpen: true, start: '08:00', end: '18:00' },
                                        5: { isOpen: true, start: '08:00', end: '18:00' },
                                        6: { isOpen: false, start: '09:00', end: '12:00' },
                                        0: { isOpen: false, start: '09:00', end: '12:00' }
                                    } 
                                }); 
                                setIsPickupModalOpen(true); 
                            }} 
                            className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"
                        >
                            <Plus size={16} className="mr-2"/> Nové místo
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {(settings.pickupLocations || []).map(loc => (
                            <div key={loc.id} className={`bg-white p-6 rounded-2xl border shadow-sm ${!loc.enabled ? 'opacity-75 bg-gray-50' : ''}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg">{loc.name}</h3>
                                        <div className="text-xs text-gray-500 mt-1">{loc.street}, {loc.city}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setEditingPickup(loc); setIsPickupModalOpen(true); }} className="p-1 hover:bg-gray-100 rounded"><Edit size={16}/></button>
                                        <button onClick={() => setConfirmDelete({type: 'pickup', id: loc.id, name: loc.name})} className="p-1 hover:bg-red-50 rounded text-red-500"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                                <div className="space-y-1 text-[10px] text-gray-500 border-t pt-2">
                                    <div className="flex justify-between"><span>Po:</span> <strong>{loc.openingHours[1]?.isOpen ? `${loc.openingHours[1].start}-${loc.openingHours[1].end}` : 'Zavřeno'}</strong></div>
                                    <div className="flex justify-between"><span>Pá:</span> <strong>{loc.openingHours[5]?.isOpen ? `${loc.openingHours[5].start}-${loc.openingHours[5].end}` : 'Zavřeno'}</strong></div>
                                    <div className="flex justify-between"><span>Ne:</span> <strong>{loc.openingHours[0]?.isOpen ? `${loc.openingHours[0].start}-${loc.openingHours[0].end}` : 'Zavřeno'}</strong></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'operator' && (
                <div className="animate-fade-in max-w-2xl bg-white p-8 rounded-2xl border shadow-sm">
                <h2 className="text-xl font-bold mb-6">{t('admin.company_data')}</h2>
                <form onSubmit={saveOperator} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-gray-400 block mb-1">Název</label><input className="w-full border rounded p-2" value={settings.companyDetails.name} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, name: e.target.value}})} /></div>
                    <div><label className="text-xs font-bold text-gray-400 block mb-1">Email</label><input className="w-full border rounded p-2" value={settings.companyDetails.email} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, email: e.target.value}})} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-gray-400 block mb-1">Telefon</label><input className="w-full border rounded p-2" value={settings.companyDetails.phone} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, phone: e.target.value}})} /></div>
                    <div><label className="text-xs font-bold text-gray-400 block mb-1">Web/Jiné</label><input className="w-full border rounded p-2" disabled value="www.4gracie.cz" /></div>
                    </div>
                    <hr className="border-gray-100" />
                    <div><label className="text-xs font-bold text-gray-400 block mb-1">Ulice</label><input className="w-full border rounded p-2" value={settings.companyDetails.street} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, street: e.target.value}})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-gray-400 block mb-1">Město</label><input className="w-full border rounded p-2" value={settings.companyDetails.city} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, city: e.target.value}})} /></div>
                    <div><label className="text-xs font-bold text-gray-400 block mb-1">PSČ</label><input className="w-full border rounded p-2" value={settings.companyDetails.zip} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, zip: e.target.value}})} /></div>
                    </div>
                    <hr className="border-gray-100" />
                    <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-gray-400 block mb-1">IČ</label><input className="w-full border rounded p-2" value={settings.companyDetails.ic} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, ic: e.target.value}})} /></div>
                    <div><label className="text-xs font-bold text-gray-400 block mb-1">DIČ</label><input className="w-full border rounded p-2" value={settings.companyDetails.dic} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, dic: e.target.value}})} /></div>
                    </div>
                    <div><label className="text-xs font-bold text-gray-400 block mb-1">Číslo účtu</label><input className="w-full border rounded p-2" value={settings.companyDetails.bankAccount} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, bankAccount: e.target.value}})} /></div>
                    <div className="pt-4"><button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg font-bold shadow-lg">Uložit změny</button></div>
                </form>
                </div>
            )}

            {activeTab === 'capacities' && (
                <div className="animate-fade-in space-y-8">
                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <h3 className="font-bold mb-4">{t('admin.global_limits')}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {sortedCategories.map(cat => (
                        <div key={cat.id}>
                        <label className="text-xs font-bold text-gray-400 block mb-1">{cat.name}</label>
                        <input type="number" className="w-full border rounded p-2" value={settings.defaultCapacities[cat.id]} onChange={e => updateSettings({...settings, defaultCapacities: {...settings.defaultCapacities, [cat.id]: Number(e.target.value)}})} />
                        </div>
                    ))}
                    </div>
                    <button onClick={() => updateSettings(settings)} className="mt-4 bg-primary text-white px-4 py-2 rounded text-xs font-bold">Uložit globální limity</button>
                </div>

                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold">{t('admin.exceptions')}</h3>
                    <button onClick={() => { setEditingDayConfig({ date: '', isOpen: false }); setIsDayConfigModalOpen(true); }} className="bg-white border hover:bg-gray-50 px-3 py-1 rounded text-xs font-bold flex items-center"><Plus size={14} className="mr-1"/> {t('admin.exception_add')}</button>
                    </div>
                    <div className="space-y-2">
                    {dayConfigs.map((c, idx) => (
                        <div key={idx} className={`flex justify-between items-center p-3 rounded-lg border ${c.isOpen ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                        <div>
                            <span className="font-mono font-bold block">{formatDate(c.date)}</span>
                            <span className={`text-xs font-bold ${c.isOpen ? 'text-blue-600' : 'text-red-600'}`}>{c.isOpen ? t('admin.exception_open') : t('admin.exception_closed')}</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setEditingDayConfig(c); setIsDayConfigModalOpen(true); }} className="p-1 hover:bg-white rounded"><Edit size={16}/></button>
                            <button onClick={() => setConfirmDelete({type: 'exception', id: c.date})} className="p-1 hover:bg-white rounded text-red-500"><Trash2 size={16}/></button>
                        </div>
                        </div>
                    ))}
                    </div>
                </div>
                </div>
            )}

            {activeTab === 'payments' && (
                <div className="animate-fade-in max-w-2xl">
                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                    <h2 className="text-xl font-bold mb-6">{t('admin.payment_methods')}</h2>
                    <div className="space-y-4">
                    {settings.paymentMethods.map((pm, idx) => (
                        <div key={pm.id} className="flex items-center justify-between p-4 border rounded-xl bg-gray-50">
                        <div>
                            <h4 className="font-bold">{pm.label}</h4>
                            <p className="text-xs text-gray-500">{pm.description}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={pm.enabled} onChange={e => {
                                const newMethods = [...settings.paymentMethods];
                                newMethods[idx].enabled = e.target.checked;
                                updateSettings({...settings, paymentMethods: newMethods});
                            }} />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                        </div>
                    ))}
                    </div>
                </div>
                </div>
            )}

            {/* MODALS */}
            
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
                                        
                                        {/* Delivery Type */}
                                        <div>
                                            <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('checkout.delivery')}</label>
                                            <div className="flex gap-2">
                                                <button 
                                                    type="button"
                                                    onClick={() => setEditingOrder({...editingOrder, deliveryType: DeliveryType.PICKUP, deliveryAddress: undefined})}
                                                    className={`flex-1 py-2 text-xs font-bold rounded border ${editingOrder.deliveryType === DeliveryType.PICKUP ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600'}`}
                                                >
                                                    {t('checkout.pickup')}
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => setEditingOrder({...editingOrder, deliveryType: DeliveryType.DELIVERY, pickupLocationId: undefined})}
                                                    className={`flex-1 py-2 text-xs font-bold rounded border ${editingOrder.deliveryType === DeliveryType.DELIVERY ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600'}`}
                                                >
                                                    {t('admin.delivery')}
                                                </button>
                                            </div>
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
                                                {orderUser && orderUser.deliveryAddresses.length > 0 && (
                                                    <div>
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Vybrat z adres zákazníka</label>
                                                        <select 
                                                            className="w-full border rounded p-2 text-sm mb-2"
                                                            value={selectedDeliveryAddrId}
                                                            onChange={e => handleSelectDeliveryAddress(e.target.value)}
                                                        >
                                                            <option value="">-- Použít uloženou adresu --</option>
                                                            {orderUser.deliveryAddresses.map(a => (
                                                                <option key={a.id} value={a.id}>{a.name}, {a.street}, {a.city}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">{t('common.street')} (Text)</label>
                                                    <textarea className="w-full border rounded p-2 text-sm h-20" value={editingOrder.deliveryAddress || ''} onChange={e => setEditingOrder({...editingOrder, deliveryAddress: e.target.value})}/>
                                                </div>
                                            </>
                                        )}

                                        {/* Billing Address Selector */}
                                        <div className="pt-2 border-t mt-2">
                                            {orderUser && orderUser.billingAddresses.length > 0 && (
                                                <div>
                                                    <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Vybrat fakturační adresu</label>
                                                    <select 
                                                        className="w-full border rounded p-2 text-sm mb-2"
                                                        value={selectedBillingAddrId}
                                                        onChange={e => handleSelectBillingAddress(e.target.value)}
                                                    >
                                                        <option value="">-- Použít uloženou fakturační --</option>
                                                        {orderUser.billingAddresses.map(a => (
                                                            <option key={a.id} value={a.id}>{a.name} {a.ic ? `(IČ: ${a.ic})` : ''}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                            <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Fakturační adresa (Text)</label>
                                            <textarea className="w-full border rounded p-2 text-sm h-16" value={editingOrder.billingAddress || ''} onChange={e => setEditingOrder({...editingOrder, billingAddress: e.target.value})}/>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center">
                                        <span className="font-bold text-sm">Celkem (Automatický výpočet):</span>
                                        <span className="font-bold text-lg text-accent">{editingOrder.totalPrice + editingOrder.packagingFee + (editingOrder.deliveryFee || 0)} Kč</span>
                                    </div>
                                    <div className="border rounded-2xl p-4 text-sm text-gray-500 italic">
                                        Editace položek košíku je dostupná v detailu (rozbalení sekce položek není implementováno v tomto náhledu, použijte "Detail" v tabulce pokud je to nutné pro admina).
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

            <RegionModal 
                isOpen={isRegionModalOpen} 
                onClose={() => setIsRegionModalOpen(false)} 
                region={editingRegion || {}} 
                onSave={saveRegion}
                orders={orders}
            />

            {isCategoryModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={saveCategory} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                        <h3 className="font-bold text-lg">{editingCategory?.id ? 'Upravit kategorii' : 'Nová kategorie'}</h3>
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">Název kategorie</label>
                            <input required className="w-full border rounded p-2" value={editingCategory?.name || ''} onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">ID (Slug) - neměnit pokud to není nutné</label>
                            <input required disabled={!!editingCategory?.id && sortedCategories.some(c => c.id === editingCategory.id)} className="w-full border rounded p-2 bg-gray-50" value={editingCategory?.id || ''} onChange={e => setEditingCategory({ ...editingCategory, id: e.target.value })} placeholder="např. 'wrapy' (bez mezer)" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">Pořadí</label>
                            <input type="number" required className="w-full border rounded p-2" value={editingCategory?.order || ''} onChange={e => setEditingCategory({ ...editingCategory, order: Number(e.target.value) })} />
                        </div>
                        <label className="flex items-center gap-2 mt-2">
                            <input type="checkbox" checked={editingCategory?.enabled ?? true} onChange={e => setEditingCategory({ ...editingCategory, enabled: e.target.checked })} />
                            <span className="text-sm">Aktivní / Viditelná</span>
                        </label>
                        <div className="flex gap-2 pt-4">
                            <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">{t('admin.cancel')}</button>
                            <button type="submit" className="flex-1 py-2 bg-primary text-white rounded">{t('common.save')}</button>
                        </div>
                    </form>
                </div>
            )}
            
            {isProductModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                <form onSubmit={saveProduct} className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
                    <h3 className="font-bold text-lg">{editingProduct?.id ? t('admin.edit_product') : t('admin.add_product')}</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-400 block mb-1">Název produktu</label>
                                <input required className="w-full border rounded p-2" value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-400 block mb-1">Popis</label>
                                <textarea className="w-full border rounded p-2 h-20" value={editingProduct?.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Cena (Kč)</label>
                                <input type="number" required className="w-full border rounded p-2" value={editingProduct?.price || ''} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Kategorie</label>
                                <select className="w-full border rounded p-2" value={editingProduct?.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}>
                                    {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
                            <h4 className="font-bold text-sm text-gray-500 uppercase">Logistika a Časování</h4>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 block mb-1">Objednat předem (dny)</label>
                                    <input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.leadTimeDays || ''} onChange={e => setEditingProduct({...editingProduct, leadTimeDays: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 block mb-1">Trvanlivost (dny)</label>
                                    <input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.shelfLifeDays || ''} onChange={e => setEditingProduct({...editingProduct, shelfLifeDays: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 block mb-1">Min. odběr (ks)</label>
                                    <input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.minOrderQuantity || ''} onChange={e => setEditingProduct({...editingProduct, minOrderQuantity: Number(e.target.value)})} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
                            <h4 className="font-bold text-sm text-gray-500 uppercase">Ekonomika a Kapacity</h4>
                            <div className="grid grid-cols-4 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 block mb-1">Pracnost (body)</label>
                                    <input type="number" min="0" className="w-full border rounded p-2 text-sm" value={editingProduct?.workload ?? ''} onChange={e => setEditingProduct({...editingProduct, workload: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 block mb-1">Kap. přípravy (Overhead)</label>
                                    <input type="number" min="0" className="w-full border rounded p-2 text-sm" value={editingProduct?.workloadOverhead ?? ''} onChange={e => setEditingProduct({...editingProduct, workloadOverhead: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 block mb-1">DPH Prodejna (%)</label>
                                    <input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.vatRateInner ?? ''} onChange={e => setEditingProduct({...editingProduct, vatRateInner: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 block mb-1">DPH S sebou (%)</label>
                                    <input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.vatRateTakeaway ?? ''} onChange={e => setEditingProduct({...editingProduct, vatRateTakeaway: Number(e.target.value)})} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-2">Viditelnost</label>
                            <div className="flex gap-4">
                                <label className="flex items-center space-x-2 text-sm">
                                    <input type="checkbox" checked={editingProduct?.visibility?.online ?? true} onChange={e => setEditingProduct({...editingProduct, visibility: { ...editingProduct?.visibility || { online: true, store: true, stand: true }, online: e.target.checked }})} />
                                    <span>E-shop (Online)</span>
                                </label>
                                <label className="flex items-center space-x-2 text-sm">
                                    <input type="checkbox" checked={editingProduct?.visibility?.store ?? true} onChange={e => setEditingProduct({...editingProduct, visibility: { ...editingProduct?.visibility || { online: true, store: true, stand: true }, store: e.target.checked }})} />
                                    <span>Prodejna (Kasa)</span>
                                </label>
                                <label className="flex items-center space-x-2 text-sm">
                                    <input type="checkbox" checked={editingProduct?.visibility?.stand ?? true} onChange={e => setEditingProduct({...editingProduct, visibility: { ...editingProduct?.visibility || { online: true, store: true, stand: true }, stand: e.target.checked }})} />
                                    <span>Stánek</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-2">Alergeny</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                                {ALLERGENS.map(a => (
                                    <label key={a.id} className={`flex flex-col items-center justify-center p-2 border rounded cursor-pointer transition hover:bg-gray-50 min-h-[80px] text-center ${editingProduct?.allergens?.includes(a.id) ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-white border-gray-200'}`}>
                                        <input 
                                            type="checkbox" 
                                            className="sr-only"
                                            checked={editingProduct?.allergens?.includes(a.id) ?? false}
                                            onChange={e => {
                                                const current = editingProduct?.allergens || [];
                                                const updated = e.target.checked ? [...current, a.id] : current.filter(id => id !== a.id);
                                                setEditingProduct({...editingProduct, allergens: updated});
                                            }}
                                        />
                                        <span className="font-bold text-lg leading-none mb-1">{a.code}</span>
                                        <span className="text-[9px] leading-tight text-gray-600 line-clamp-2">{a.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-2">{t('common.images')}</label>
                            <div className="flex flex-wrap gap-2">
                                {editingProduct?.images?.map((img, idx) => (
                                    <div key={idx} className="relative w-20 h-20 group rounded-lg overflow-hidden border">
                                        <img src={img} className="w-full h-full object-cover" />
                                        <button type="button" onClick={() => setEditingProduct({...editingProduct, images: editingProduct.images?.filter((_, i) => i !== idx)})} className="absolute top-0 right-0 bg-red-500 text-white p-1 opacity-0 group-hover:opacity-100 transition"><X size={12}/></button>
                                    </div>
                                ))}
                                <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition">
                                    <Plus size={24} />
                                    <span className="text-[10px] mt-1">Nahrát</span>
                                    <input type="file" className="hidden" onChange={handleImageFileChange} />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-4 border-t">
                    <button type="button" onClick={() => setIsProductModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">{t('admin.cancel')}</button>
                    <button type="submit" className="flex-1 py-2 bg-primary text-white rounded">{t('common.save')}</button>
                    </div>
                </form>
                </div>
            )}
            
            {isDayConfigModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={saveDayConfig} className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                        <h3 className="font-bold text-lg">Výjimka v kalendáři</h3>
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">Datum</label>
                            <input type="date" required className="w-full border rounded p-2" value={editingDayConfig?.date || ''} onChange={e => setEditingDayConfig({...editingDayConfig, date: e.target.value})} disabled={!!editingDayConfig?.date && dayConfigs.some(d => d.date === editingDayConfig.date && d !== editingDayConfig)} />
                        </div>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={editingDayConfig?.isOpen ?? false} onChange={e => setEditingDayConfig({...editingDayConfig, isOpen: e.target.checked})} />
                            <span className="text-sm font-bold">Otevřeno</span>
                        </label>
                        
                        {editingDayConfig?.isOpen && (
                            <div className="bg-gray-50 p-3 rounded">
                                <h4 className="text-xs font-bold mb-2">Override Kapacit (Volitelné)</h4>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {sortedCategories.map(cat => (
                                        <div key={cat.id} className="flex justify-between items-center text-xs">
                                            <span>{cat.name}</span>
                                            <input type="number" className="w-20 border rounded p-1" placeholder="Limit" value={editingDayConfig.capacityOverrides?.[cat.id] ?? ''} onChange={e => setEditingDayConfig({
                                                ...editingDayConfig,
                                                capacityOverrides: { ...editingDayConfig.capacityOverrides, [cat.id]: Number(e.target.value) }
                                            })} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-4">
                            <button type="button" onClick={() => setIsDayConfigModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">Zrušit</button>
                            <button type="submit" className="flex-1 py-2 bg-primary text-white rounded">Uložit</button>
                        </div>
                    </form>
                </div>
            )}
            
            {isDiscountModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={saveDiscount} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h3 className="font-bold text-lg">{editingDiscount?.id ? 'Upravit slevu' : 'Nová sleva'}</h3>
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">Kód</label>
                            <input required className="w-full border rounded p-2 uppercase" value={editingDiscount?.code || ''} onChange={e => setEditingDiscount({...editingDiscount, code: e.target.value.toUpperCase()})} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Typ</label>
                                <select className="w-full border rounded p-2" value={editingDiscount?.type} onChange={e => setEditingDiscount({...editingDiscount, type: e.target.value as DiscountType})}>
                                    <option value={DiscountType.PERCENTAGE}>Procenta (%)</option>
                                    <option value={DiscountType.FIXED}>Částka (Kč)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Hodnota</label>
                                <input type="number" required className="w-full border rounded p-2" value={editingDiscount?.value || ''} onChange={e => setEditingDiscount({...editingDiscount, value: Number(e.target.value)})} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Min. hodnota obj. (Kč)</label>
                                <input type="number" className="w-full border rounded p-2" value={editingDiscount?.minOrderValue || ''} onChange={e => setEditingDiscount({...editingDiscount, minOrderValue: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Limit použití (ks)</label>
                                <input type="number" className="w-full border rounded p-2" value={editingDiscount?.maxUsage || ''} onChange={e => setEditingDiscount({...editingDiscount, maxUsage: Number(e.target.value)})} placeholder="0 = neomezeně" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Platnost Od</label>
                                <input type="date" className="w-full border rounded p-2" value={editingDiscount?.validFrom || ''} onChange={e => setEditingDiscount({...editingDiscount, validFrom: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Platnost Do</label>
                                <input type="date" className="w-full border rounded p-2" value={editingDiscount?.validTo || ''} onChange={e => setEditingDiscount({...editingDiscount, validTo: e.target.value})} />
                            </div>
                        </div>
                        
                        <div className="border p-3 rounded-lg">
                            <label className="text-xs font-bold text-gray-400 block mb-2">Platí pro kategorie (nevybráno = vše)</label>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {sortedCategories.map(cat => (
                                    <label key={cat.id} className="flex items-center space-x-2 text-xs cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={editingDiscount?.applicableCategories?.includes(cat.id) ?? false}
                                            onChange={e => {
                                                const current = editingDiscount?.applicableCategories || [];
                                                const updated = e.target.checked 
                                                    ? [...current, cat.id] 
                                                    : current.filter(id => id !== cat.id);
                                                setEditingDiscount({...editingDiscount, applicableCategories: updated});
                                            }}
                                            className="rounded text-accent"
                                        />
                                        <span>{cat.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gray-50 p-3 rounded space-y-2">
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={editingDiscount?.enabled ?? true} onChange={e => setEditingDiscount({...editingDiscount, enabled: e.target.checked})} /> Aktivní
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={editingDiscount?.isStackable ?? false} onChange={e => setEditingDiscount({...editingDiscount, isStackable: e.target.checked})} /> Kombinovatelné
                            </label>
                        </div>
                        <div className="flex gap-2 pt-4">
                            <button type="button" onClick={() => setIsDiscountModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">Zrušit</button>
                            <button type="submit" className="flex-1 py-2 bg-primary text-white rounded">Uložit</button>
                        </div>
                    </form>
                </div>
            )}

            {isPackagingModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={savePackaging} className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                        <h3 className="font-bold text-lg">{editingPackaging?.id ? 'Upravit obal' : 'Nový obal'}</h3>
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">Název</label>
                            <input required className="w-full border rounded p-2" value={editingPackaging?.name || ''} onChange={e => setEditingPackaging({...editingPackaging, name: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Objem (ml)</label>
                                <input type="number" required className="w-full border rounded p-2" value={editingPackaging?.volume || ''} onChange={e => setEditingPackaging({...editingPackaging, volume: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Cena (Kč)</label>
                                <input type="number" required className="w-full border rounded p-2" value={editingPackaging?.price || ''} onChange={e => setEditingPackaging({...editingPackaging, price: Number(e.target.value)})} />
                            </div>
                        </div>
                        <div className="flex gap-2 pt-4">
                            <button type="button" onClick={() => setIsPackagingModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">Zrušit</button>
                            <button type="submit" className="flex-1 py-2 bg-primary text-white rounded">Uložit</button>
                        </div>
                    </form>
                </div>
            )}

            {isPickupModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={savePickup} className="bg-white rounded-2xl w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
                        <h3 className="font-bold text-lg">{editingPickup?.id ? 'Upravit odběrné místo' : 'Nové odběrné místo'}</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Název místa</label>
                                <input required className="w-full border rounded p-2" value={editingPickup?.name || ''} onChange={e => setEditingPickup({ ...editingPickup, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Ulice a č.p.</label>
                                <input required className="w-full border rounded p-2" value={editingPickup?.street || ''} onChange={e => setEditingPickup({ ...editingPickup, street: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Město</label>
                                <input required className="w-full border rounded p-2" value={editingPickup?.city || ''} onChange={e => setEditingPickup({ ...editingPickup, city: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">PSČ</label>
                                <input required className="w-full border rounded p-2" value={editingPickup?.zip || ''} onChange={e => setEditingPickup({ ...editingPickup, zip: e.target.value })} />
                            </div>
                        </div>

                        <div className="border rounded-xl p-4 bg-gray-50">
                            <h4 className="font-bold text-sm mb-3">Otevírací doba</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                {[1, 2, 3, 4, 5, 6, 0].map(day => (
                                    <div key={day} className="flex items-center gap-2">
                                        <span className="w-8 font-bold text-xs">{day === 0 ? 'Ne' : day === 1 ? 'Po' : day === 2 ? 'Út' : day === 3 ? 'St' : day === 4 ? 'Čt' : day === 5 ? 'Pá' : 'So'}</span>
                                        <label className="flex items-center text-xs gap-1">
                                            <input 
                                                type="checkbox" 
                                                checked={editingPickup?.openingHours?.[day]?.isOpen ?? false}
                                                onChange={e => setEditingPickup({
                                                    ...editingPickup,
                                                    openingHours: {
                                                        ...editingPickup?.openingHours,
                                                        [day]: { ...editingPickup?.openingHours?.[day], isOpen: e.target.checked }
                                                    }
                                                })}
                                            />
                                            Otevřeno
                                        </label>
                                        {editingPickup?.openingHours?.[day]?.isOpen && (
                                            <>
                                                <input type="time" className="w-20 p-1 border rounded text-xs" value={editingPickup.openingHours[day].start} onChange={e => setEditingPickup({ ...editingPickup, openingHours: { ...editingPickup.openingHours, [day]: { ...editingPickup.openingHours![day], start: e.target.value } } })} />
                                                <span className="text-xs">-</span>
                                                <input type="time" className="w-20 p-1 border rounded text-xs" value={editingPickup.openingHours[day].end} onChange={e => setEditingPickup({ ...editingPickup, openingHours: { ...editingPickup.openingHours, [day]: { ...editingPickup.openingHours![day], end: e.target.value } } })} />
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white border rounded-xl p-4">
                            <label className="text-xs font-bold text-gray-400 block mb-2">Výjimky otevírací doby</label>
                            <div className="flex gap-2 mb-2 items-end">
                                <div className="flex-1">
                                    <span className="text-[10px] block text-gray-400">Datum</span>
                                    <input type="date" className="w-full border rounded p-1 text-xs" value={newPickupException.date} onChange={e => setNewPickupException({ ...newPickupException, date: e.target.value })} />
                                </div>
                                <div className="flex items-center gap-1 pb-2">
                                    <input type="checkbox" checked={newPickupException.isOpen} onChange={e => setNewPickupException({ ...newPickupException, isOpen: e.target.checked })} />
                                    <span className="text-xs">Otevřeno?</span>
                                </div>
                                {newPickupException.isOpen && (
                                    <>
                                        <div className="w-20"><input type="time" className="w-full border rounded p-1 text-xs" value={newPickupException.deliveryTimeStart || ''} onChange={e => setNewPickupException({ ...newPickupException, deliveryTimeStart: e.target.value })} /></div>
                                        <div className="w-20"><input type="time" className="w-full border rounded p-1 text-xs" value={newPickupException.deliveryTimeEnd || ''} onChange={e => setNewPickupException({ ...newPickupException, deliveryTimeEnd: e.target.value })} /></div>
                                    </>
                                )}
                                <button type="button" onClick={addPickupException} className="bg-accent text-white px-3 py-1.5 rounded text-xs font-bold self-end">+</button>
                            </div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {editingPickup?.exceptions?.map((ex, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs bg-gray-50 p-2 border rounded">
                                        <span>{ex.date}: <strong>{ex.isOpen ? 'Otevřeno' : 'ZAVŘENO'}</strong> {ex.isOpen && `(${ex.deliveryTimeStart} - ${ex.deliveryTimeEnd})`}</span>
                                        <button type="button" onClick={() => removePickupException(ex.date)} className="text-red-500"><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <label className="flex items-center gap-2 mt-2">
                            <input type="checkbox" checked={editingPickup?.enabled ?? true} onChange={e => setEditingPickup({ ...editingPickup, enabled: e.target.checked })} />
                            <span className="text-sm">Aktivní</span>
                        </label>
                        <div className="flex gap-2 pt-4">
                            <button type="button" onClick={() => setIsPickupModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">Zrušit</button>
                            <button type="submit" className="flex-1 py-2 bg-primary text-white rounded">Uložit</button>
                        </div>
                    </form>
                </div>
            )}

            {isUserModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl">
                        <h3 className="font-bold text-lg mb-4">{editingUser ? 'Upravit uživatele' : 'Nový uživatel'}</h3>
                        <div className="space-y-3">
                            <input className="w-full border p-2 rounded" placeholder={t('common.name')} value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} />
                            <input className="w-full border p-2 rounded" placeholder={t('common.email')} value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} />
                            <input className="w-full border p-2 rounded" placeholder={t('common.phone')} value={userForm.phone} onChange={e => setUserForm({...userForm, phone: e.target.value})} />
                            <select className="w-full border p-2 rounded" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as any})}>
                                <option value="customer">Zákazník</option>
                                <option value="driver">Řidič</option>
                                <option value="admin">Administrátor</option>
                            </select>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setIsUserModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded font-bold text-sm">Zrušit</button>
                            <button onClick={handleUserModalSave} className="flex-1 py-2 bg-primary text-white rounded font-bold text-sm">Uložit</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
