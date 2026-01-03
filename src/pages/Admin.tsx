
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { 
    Category, PackagingType, DayConfig, 
} from '../types';
import { 
    LayoutList, Plus, Edit, Trash2, Database, HardDrive, Server, 
    Check
} from 'lucide-react';

import { OrdersTab } from './admin/OrdersTab';
import { UsersTab } from './admin/UsersTab';
import { ProductsTab } from './admin/ProductsTab';
import { DiscountsTab } from './admin/DiscountsTab';
import { DeliveryTab, PickupTab } from './admin/LogisticsTabs';

export const Admin: React.FC = () => {
    const { 
        dataSource, setDataSource, orders, products, dayConfigs, settings, 
        t, updateSettings, 
        updateDayConfig, removeDayConfig,
        formatDate, removeDiacritics, getDailyLoad 
    } = useStore();

    const [activeTab, setActiveTab] = useState('orders');
    
    // States for inline tabs (Categories, Packaging, Capacities)
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
    
    const [isPackagingModalOpen, setIsPackagingModalOpen] = useState(false);
    const [editingPackaging, setEditingPackaging] = useState<Partial<PackagingType> | null>(null);
    
    const [isDayConfigModalOpen, setIsDayConfigModalOpen] = useState(false);
    const [editingDayConfig, setEditingDayConfig] = useState<Partial<DayConfig> | null>(null);
    
    const [showLoadHistory, setShowLoadHistory] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{type: string, id: string, name?: string} | null>(null);

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);
    
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

    const getDayCapacityLimit = (date: string, catId: string) => {
        const config = dayConfigs.find(d => d.date === date);
        return config?.capacityOverrides?.[catId] ?? settings.defaultCapacities[catId] ?? 0;
    };

    // --- Handlers for inline tabs ---
    const handleCategoryDeleteCheck = (cat: Category) => {
        const hasProducts = products.some(p => p.category === cat.id && !p.visibility.online);
        if (hasProducts) { alert('Kategorie obsahuje produkty. Nelze smazat.'); return; }
        const newCats = settings.categories.filter(c => c.id !== cat.id);
        updateSettings({...settings, categories: newCats});
    };

    const saveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCategory) return;
        const newCats = [...settings.categories];
        const cat = { ...editingCategory } as Category;
        if (!cat.id) {
            cat.id = removeDiacritics(cat.name).toLowerCase().replace(/\s+/g, '-');
            if (newCats.some(c => c.id === cat.id)) { alert('Kategorie s tímto ID již existuje.'); return; }
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

    useEffect(() => {
        if (confirmDelete) {
            if (confirm(`Opravdu smazat ${confirmDelete.name || 'položku'}?`)) {
                if (confirmDelete.type === 'packaging') {
                    const newPkg = settings.packaging.types.filter(p => p.id !== confirmDelete.id);
                    updateSettings({...settings, packaging: {...settings.packaging, types: newPkg}});
                }
                if (confirmDelete.type === 'exception') {
                    removeDayConfig(confirmDelete.id);
                }
            }
            setConfirmDelete(null);
        }
    }, [confirmDelete]);

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-serif font-bold text-gray-800 tracking-tight">{t('admin.dashboard')}</h1>
                <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl shadow-sm overflow-x-auto">
                {/* Note: 'backup' is removed from this list */}
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

            {/* --- SEPARATE COMPONENTS --- */}
            {activeTab === 'orders' && <OrdersTab />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'products' && <ProductsTab />}
            {activeTab === 'discounts' && <DiscountsTab />}
            {activeTab === 'delivery' && <DeliveryTab />}
            {activeTab === 'pickup' && <PickupTab />}

            {/* --- INLINE TABS (Categories, Load, Packaging, Operator, Capacities, Payments, DB) --- */}

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
                        <div className="p-8 text-center text-gray-400">Žádné kategorie</div>
                    )}
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

            {/* --- MODALS --- */}

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

        </div>
    );
};
