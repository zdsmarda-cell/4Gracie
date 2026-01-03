
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { 
    Product, Category, DiscountCode, PackagingType, DayConfig, 
    DeliveryRegion, PickupLocation, RegionException, PaymentMethodConfig,
    OrderStatus, User, DiscountType, Order, DeliveryType
} from '../types';
import { ALLERGENS } from '../constants';
import { 
    LayoutList, Plus, Edit, Trash2, Database, HardDrive, Server, 
    Download, Upload, FileText, Check, X, User as UserIcon, 
    Ban, ImageIcon, Store, Truck, AlertTriangle, Info, Calculator
} from 'lucide-react';

import { OrdersTab } from './admin/OrdersTab';
import { UsersTab } from './admin/UsersTab';
import { ProductsTab } from './admin/ProductsTab';
import { DiscountsTab } from './admin/DiscountsTab';
import { DeliveryTab, PickupTab } from './admin/LogisticsTabs';

// --- Shared Components for Admin ---

const DeleteConfirmationModal: React.FC<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onClose: () => void;
}> = ({ isOpen, title, message, onConfirm, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <Trash2 size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-sm text-gray-500 mb-6">{message}</p>
                    <div className="flex gap-3 w-full">
                        <button onClick={onClose} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200 transition">Zrušit</button>
                        <button onClick={onConfirm} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition">Smazat</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ValidationAlertModal: React.FC<{
    isOpen: boolean;
    message: string;
    onClose: () => void;
}> = ({ isOpen, message, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4 text-orange-600">
                        <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Nelze provést akci</h3>
                    <p className="text-sm text-gray-500 mb-6">{message}</p>
                    <button onClick={onClose} className="w-full py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-gray-800 transition">Rozumím</button>
                </div>
            </div>
        </div>
    );
};

const PaymentMethodModal: React.FC<{
    isOpen: boolean;
    method: Partial<PaymentMethodConfig>;
    onClose: () => void;
    onSave: (m: PaymentMethodConfig) => void;
}> = ({ isOpen, method, onClose, onSave }) => {
    const [formData, setFormData] = useState(method);
    
    useEffect(() => { setFormData(method); }, [method]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <h3 className="font-bold text-lg mb-4">Upravit platební metodu</h3>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold text-gray-400 block mb-1">Název</label>
                        <input className="w-full border rounded p-2" value={formData.label || ''} onChange={e => setFormData({...formData, label: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 block mb-1">Popis</label>
                        <textarea className="w-full border rounded p-2 h-24" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
                    </div>
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={formData.enabled} onChange={e => setFormData({...formData, enabled: e.target.checked})} />
                        <span className="text-sm">Aktivní</span>
                    </label>
                </div>
                <div className="flex gap-2 mt-6">
                    <button onClick={onClose} className="flex-1 py-2 bg-gray-100 rounded font-bold text-sm">Zrušit</button>
                    <button onClick={() => onSave(formData as PaymentMethodConfig)} className="flex-1 py-2 bg-primary text-white rounded font-bold text-sm">Uložit</button>
                </div>
            </div>
        </div>
    );
};

// --- NEW COMPONENT: Load Detail Modal ---
const LoadDetailModal: React.FC<{
    date: string | null;
    onClose: () => void;
}> = ({ date, onClose }) => {
    const { orders, products, settings, dayConfigs, formatDate } = useStore();

    const detailData = useMemo(() => {
        if (!date) return null;

        const activeOrders = orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED);
        const groupedByCategory: Record<string, {
            products: Record<string, { name: string, quantity: number, workload: number, overhead: number }>;
            totalWorkload: number;
        }> = {};

        // Initialize Categories
        settings.categories.forEach(cat => {
            groupedByCategory[cat.id] = { products: {}, totalWorkload: 0 };
        });

        activeOrders.forEach(order => {
            order.items.forEach(item => {
                const productDef = products.find(p => p.id === item.id);
                // Use definition or item snapshot (fallback)
                const workload = Number(productDef?.workload ?? item.workload ?? 0);
                const overhead = Number(productDef?.workloadOverhead ?? item.workloadOverhead ?? 0);
                const catId = item.category;

                if (!groupedByCategory[catId]) {
                    // Handle legacy categories or deleted ones
                    groupedByCategory[catId] = { products: {}, totalWorkload: 0 };
                }

                if (!groupedByCategory[catId].products[item.id]) {
                    groupedByCategory[catId].products[item.id] = {
                        name: item.name,
                        quantity: 0,
                        workload: workload,
                        overhead: overhead
                    };
                }

                groupedByCategory[catId].products[item.id].quantity += item.quantity;
            });
        });

        // Calculate Totals per Category
        Object.keys(groupedByCategory).forEach(catId => {
            let catTotal = 0;
            Object.values(groupedByCategory[catId].products).forEach(p => {
                // Formula: (Qty * Workload) + Overhead (Once per day per product type)
                // Note: Overhead logic matches getDailyLoad in StoreContext
                const productTotal = (p.quantity * p.workload) + p.overhead;
                catTotal += productTotal;
            });
            groupedByCategory[catId].totalWorkload = catTotal;
        });

        return groupedByCategory;
    }, [date, orders, products, settings]);

    const getCapacityLimit = (date: string, catId: string) => {
        const config = dayConfigs.find(d => d.date === date);
        return config?.capacityOverrides?.[catId] ?? settings.defaultCapacities[catId] ?? 0;
    };

    const handleExport = () => {
        if (!detailData || !date) return;

        const rows = [];
        // Add BOM for Excel UTF-8 compatibility
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
        
        // Header
        rows.push(["Produkt", "Množství", "Kategorie", "Pracnost Celkem"]);

        Object.keys(detailData).forEach(catId => {
            const catName = settings.categories.find(c => c.id === catId)?.name || catId;
            const products = Object.values(detailData[catId].products);
            
            products.forEach(p => {
                if (p.quantity > 0) {
                    const totalPoints = (p.quantity * p.workload) + p.overhead;
                    // Escape quotes in names
                    rows.push([`"${p.name.replace(/"/g, '""')}"`, p.quantity, `"${catName}"`, totalPoints]);
                }
            });
        });

        // Convert to CSV string (using semicolon for Excel in CZ locale usually)
        csvContent += rows.map(e => e.join(";")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `produkty_den_${date}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!date || !detailData) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[250] p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="text-xl font-bold text-primary flex items-center">
                        <Calculator className="mr-2 text-accent" /> Detail vytížení: {formatDate(date)}
                    </h2>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleExport} 
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-bold shadow-sm"
                            title="Stáhnout seznam do Excelu"
                        >
                            <Download size={16} /> Exportovat
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={24}/></button>
                    </div>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-8">
                    {settings.categories.sort((a,b) => a.order - b.order).map(cat => {
                        const data = detailData[cat.id];
                        // Skip categories with no load if you prefer, or show them as empty
                        // Showing all allows admins to see limits even if empty
                        const productList = Object.values(data?.products || {});
                        const limit = getCapacityLimit(date, cat.id);
                        const usagePercent = limit > 0 ? Math.round((data.totalWorkload / limit) * 100) : 0;
                        const isOverLimit = data.totalWorkload > limit;

                        return (
                            <div key={cat.id} className="border rounded-2xl overflow-hidden">
                                <div className="bg-gray-100 px-6 py-3 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-800">{cat.name}</h3>
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="font-mono">
                                            <span className={isOverLimit ? "text-red-600 font-bold" : "text-gray-700"}>{Math.round(data.totalWorkload)}</span> 
                                            <span className="text-gray-400"> / {limit}</span>
                                        </div>
                                        <div className={`px-2 py-0.5 rounded text-xs font-bold ${isOverLimit ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                                            {usagePercent}%
                                        </div>
                                    </div>
                                </div>
                                
                                {productList.length > 0 ? (
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                                            <tr>
                                                <th className="px-6 py-3 text-left">Produkt</th>
                                                <th className="px-6 py-3 text-center">Počet (ks)</th>
                                                <th className="px-6 py-3 text-right">Pracnost / ks</th>
                                                <th className="px-6 py-3 text-right">Kap. přípravy (Overhead)</th>
                                                <th className="px-6 py-3 text-right">Celkem body</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-sm">
                                            {productList.map((p, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="px-6 py-3 font-medium text-gray-900">{p.name}</td>
                                                    <td className="px-6 py-3 text-center font-bold">{p.quantity}</td>
                                                    <td className="px-6 py-3 text-right text-gray-500">{p.workload}</td>
                                                    <td className="px-6 py-3 text-right text-gray-500">{p.overhead}</td>
                                                    <td className="px-6 py-3 text-right font-bold text-primary">
                                                        {(p.quantity * p.workload) + p.overhead}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-6 text-center text-gray-400 text-sm italic">
                                        Žádné objednávky v této kategorii.
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export const Admin: React.FC = () => {
    const { 
        dataSource, setDataSource, t, products, dayConfigs, settings, 
        updateSettings, updateDayConfig, removeDayConfig,
        formatDate, removeDiacritics, getDailyLoad, orders
    } = useStore();

    const [activeTab, setActiveTab] = useState('orders');
    
    // Cross-tab filter state
    const [ordersTabFilterDate, setOrdersTabFilterDate] = useState<string | null>(null);
    const [loadDetailDate, setLoadDetailDate] = useState<string | null>(null); // New State for Modal

    // Modal States
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
    
    const [isPackagingModalOpen, setIsPackagingModalOpen] = useState(false);
    const [editingPackaging, setEditingPackaging] = useState<Partial<PackagingType> | null>(null);
    
    const [isDayConfigModalOpen, setIsDayConfigModalOpen] = useState(false);
    const [editingDayConfig, setEditingDayConfig] = useState<Partial<DayConfig> | null>(null);

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState<Partial<PaymentMethodConfig> | null>(null);

    // Alert & Confirm States
    const [validationMessage, setValidationMessage] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{type: string, id: string, name: string} | null>(null);

    const [showLoadHistory, setShowLoadHistory] = useState(false);

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);
    
    const loadDates = useMemo(() => {
        const dates = new Set<string>();
        
        // Add dates from orders
        orders.forEach(o => {
            if (o.deliveryDate) dates.add(o.deliveryDate);
        });

        // Add dates from exceptions
        dayConfigs.forEach(c => dates.add(c.date));
        
        const today = new Date().toISOString().split('T')[0];
        if (!showLoadHistory) {
             return Array.from(dates).filter(d => d >= today).sort();
        }
        return Array.from(dates).sort().reverse();
    }, [dayConfigs, orders, showLoadHistory]);

    const getDayCapacityLimit = (date: string, catId: string) => {
        const config = dayConfigs.find(d => d.date === date);
        return config?.capacityOverrides?.[catId] ?? settings.defaultCapacities[catId] ?? 0;
    };

    // --- HANDLERS ---

    // Category Handlers
    const handleCategoryDeleteRequest = (cat: Category) => {
        const productsInCategory = products.filter(p => p.category === cat.id);
        
        if (productsInCategory.length > 0) {
             setValidationMessage(`Kategorii "${cat.name}" nelze smazat, protože obsahuje ${productsInCategory.length} produktů. Nejprve produkty přesuňte nebo smažte.`);
             return;
        }
        setDeleteTarget({ type: 'category', id: cat.id, name: cat.name });
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

    // Packaging Handlers
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

    // Payment Handlers
    const savePaymentMethod = async (method: PaymentMethodConfig) => {
        const newMethods = settings.paymentMethods.map(m => m.id === method.id ? method : m);
        await updateSettings({ ...settings, paymentMethods: newMethods });
        setIsPaymentModalOpen(false);
    };

    // Day Config Handlers
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

    // Unified Delete Confirm Handler
    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;

        if (deleteTarget.type === 'category') {
            const newCats = settings.categories.filter(c => c.id !== deleteTarget.id);
            await updateSettings({...settings, categories: newCats});
        }
        if (deleteTarget.type === 'packaging') {
            const newPkg = settings.packaging.types.filter(p => p.id !== deleteTarget.id);
            await updateSettings({...settings, packaging: {...settings.packaging, types: newPkg}});
        }
        if (deleteTarget.type === 'exception') {
            await removeDayConfig(deleteTarget.id);
        }

        setDeleteTarget(null);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-serif font-bold text-gray-800 tracking-tight">{t('admin.dashboard')}</h1>
                <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl shadow-sm overflow-x-auto">
                {(['orders', 'users', 'load', 'products', 'categories', 'delivery', 'pickup', 'capacities', 'discounts', 'packaging', 'operator', 'payments', 'db'] as const).map(tab => (
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

            {/* --- ALERTS & MODALS --- */}
            <DeleteConfirmationModal 
                isOpen={!!deleteTarget}
                title={`Smazat ${deleteTarget?.name}?`}
                message="Tato akce je nevratná a položka bude trvale odstraněna."
                onConfirm={handleConfirmDelete}
                onClose={() => setDeleteTarget(null)}
            />

            <ValidationAlertModal 
                isOpen={!!validationMessage}
                message={validationMessage || ''}
                onClose={() => setValidationMessage(null)}
            />

            {/* Load Detail Modal */}
            <LoadDetailModal 
                date={loadDetailDate} 
                onClose={() => setLoadDetailDate(null)} 
            />

            {/* --- TABS --- */}

            {activeTab === 'orders' && (
                <OrdersTab 
                    initialDate={ordersTabFilterDate} 
                    onClearInitialDate={() => setOrdersTabFilterDate(null)} 
                />
            )}
            
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'products' && <ProductsTab />}
            {activeTab === 'discounts' && <DiscountsTab />}
            {activeTab === 'delivery' && <DeliveryTab />}
            {activeTab === 'pickup' && <PickupTab />}

            {/* ... Categories, Packaging, Payments, Operator, DB tabs remain unchanged ... */}
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
                                        <button onClick={() => handleCategoryDeleteRequest(cat)} className="p-1 hover:text-red-500 text-gray-400"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {sortedCategories.length === 0 && (
                        <div className="p-8 text-center text-gray-400">Žádné kategorie</div>
                    )}
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
                            <button onClick={() => setDeleteTarget({type: 'packaging', id: p.id, name: p.name})} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
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
                        <div className="flex-1 mr-4">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold">{pm.label}</h4>
                                <button onClick={() => { setEditingPayment(pm); setIsPaymentModalOpen(true); }} className="text-gray-400 hover:text-primary"><Edit size={14} /></button>
                            </div>
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
                        <th className="px-6 py-4 text-left min-w-[140px]">Datum</th>
                        <th className="px-6 py-4 text-left w-32">Stav</th>
                        <th className="px-6 py-4 text-center">Objednávky</th>
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
                        const activeOrderCount = orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED).length;
                        
                        return (
                            <tr key={date} className={`hover:bg-gray-50 ${isClosed ? 'bg-red-50' : ''}`}>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-sm">{formatDate(date)}</span>
                                    <button 
                                        onClick={() => setLoadDetailDate(date)} 
                                        className="text-gray-400 hover:text-accent p-1 bg-white border rounded-full shadow-sm"
                                        title="Detail vytížení"
                                    >
                                        <Info size={14}/>
                                    </button>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                {isClosed ? 
                                <span className="text-red-600 font-bold uppercase text-[10px]">{t('admin.exception_closed')}</span> 
                                : <span className="text-green-600 font-bold uppercase text-[10px]">Otevřeno</span>
                                }
                            </td>
                            <td className="px-6 py-4 text-center">
                                {activeOrderCount > 0 ? (
                                    <button 
                                        onClick={() => {
                                            setOrdersTabFilterDate(date);
                                            setActiveTab('orders');
                                        }}
                                        className="text-blue-600 font-bold hover:underline bg-blue-50 px-2 py-1 rounded transition hover:bg-blue-100"
                                        title="Zobrazit objednávky pro tento den"
                                    >
                                        {activeOrderCount}
                                    </button>
                                ) : (
                                    <span className="text-gray-400 font-medium">0</span>
                                )}
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
                            <button onClick={() => setDeleteTarget({type: 'exception', id: c.date, name: formatDate(c.date)})} className="p-1 hover:bg-white rounded text-red-500"><Trash2 size={16}/></button>
                        </div>
                        </div>
                    ))}
                    </div>
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

            {/* --- Modals for Editing --- */}
            
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

            {isPaymentModalOpen && editingPayment && (
                <PaymentMethodModal
                    isOpen={isPaymentModalOpen}
                    method={editingPayment}
                    onClose={() => setIsPaymentModalOpen(false)}
                    onSave={savePaymentMethod}
                />
            )}

        </div>
    );
};
