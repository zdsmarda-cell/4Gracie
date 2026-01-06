
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Category, CapacityCategory } from '../../types';
import { generateTranslations } from '../../utils/aiTranslator';
import { LayoutList, Plus, Edit, Trash2, Languages, Globe, X, AlertTriangle, Layers } from 'lucide-react';

const TranslationViewModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    item: Category | CapacityCategory | null;
}> = ({ isOpen, onClose, item }) => {
    if (!isOpen || !item || !item.translations) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h3 className="text-xl font-serif font-bold text-primary flex items-center">
                        <Globe className="mr-2 text-accent" size={24}/> 
                        Překlady
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition"><X size={20}/></button>
                </div>

                <div className="space-y-4">
                    <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100">
                        <div className="flex justify-between items-center mb-1">
                            <h4 className="font-bold text-blue-800 text-sm">English</h4>
                            <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">EN</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800">{item.translations.en?.name || '-'}</p>
                    </div>

                    <div className="bg-yellow-50/50 rounded-xl p-3 border border-yellow-100">
                        <div className="flex justify-between items-center mb-1">
                            <h4 className="font-bold text-yellow-800 text-sm">Deutsch</h4>
                            <span className="bg-yellow-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">DE</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800">{item.translations.de?.name || '-'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const WarningModal: React.FC<{
    isOpen: boolean;
    message: string;
    onClose: () => void;
}> = ({ isOpen, message, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4 text-orange-600">
                        <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Upozornění</h3>
                    <p className="text-sm text-gray-500 mb-6">{message}</p>
                    <button onClick={onClose} className="w-full py-2 bg-gray-900 text-white rounded-lg font-bold text-sm hover:bg-black transition">Rozumím</button>
                </div>
            </div>
        </div>
    );
};

const DeleteConfirmModal: React.FC<{
    isOpen: boolean;
    title: string;
    onConfirm: () => void;
    onClose: () => void;
}> = ({ isOpen, title, onConfirm, onClose }) => {
    const { t } = useStore();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <Trash2 size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-sm text-gray-500 mb-6">{t('confirm.delete_message')}</p>
                    <div className="flex gap-3 w-full">
                        <button onClick={onClose} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200 transition">{t('common.cancel')}</button>
                        <button onClick={onConfirm} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition">{t('common.delete')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const CategoriesTab: React.FC = () => {
    const { settings, updateSettings, t, tData, products, removeDiacritics } = useStore();
    
    // Toggle between Standard and Capacity
    const [viewMode, setViewMode] = useState<'standard' | 'capacity'>('standard');
    
    // Standard category state
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
    
    // Capacity category state
    const [isCapModalOpen, setIsCapModalOpen] = useState(false);
    const [editingCap, setEditingCap] = useState<Partial<CapacityCategory> | null>(null);

    const [isTranslating, setIsTranslating] = useState(false);
    const [viewingTranslations, setViewingTranslations] = useState<Category | CapacityCategory | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Category | CapacityCategory | null>(null);
    const [warningMessage, setWarningMessage] = useState<string | null>(null);

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);
    const capacityCategories = useMemo(() => settings.capacityCategories || [], [settings.capacityCategories]);

    const saveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCategory) return;
        
        setIsTranslating(true);
        const cat = { ...editingCategory } as Category;
        
        if (!cat.id) {
            cat.id = removeDiacritics(cat.name).toLowerCase().replace(/\s+/g, '-');
            if (settings.categories.some(c => c.id === cat.id)) { 
                setWarningMessage('Kategorie s tímto ID již existuje.'); 
                setIsTranslating(false);
                return; 
            }
        }

        if (settings.enableAiTranslation) {
            cat.translations = await generateTranslations({ name: cat.name });
        }

        const newCats = [...settings.categories];
        const index = newCats.findIndex(c => c.id === cat.id);
        if (index > -1) newCats[index] = cat;
        else newCats.push(cat);

        await updateSettings({ ...settings, categories: newCats });
        setIsTranslating(false);
        setIsCategoryModalOpen(false);
    };

    const saveCapacityCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCap) return;
        
        setIsTranslating(true);
        const cap = { ...editingCap } as CapacityCategory;
        if (!cap.id) cap.id = 'cc-' + Date.now();

        if (settings.enableAiTranslation) {
            cap.translations = await generateTranslations({ name: cap.name });
        }

        const newCaps = [...(settings.capacityCategories || [])];
        const index = newCaps.findIndex(c => c.id === cap.id);
        if (index > -1) newCaps[index] = cap;
        else newCaps.push(cap);

        await updateSettings({ ...settings, capacityCategories: newCaps });
        setIsTranslating(false);
        setIsCapModalOpen(false);
    };

    const handleDeleteRequest = (item: Category | CapacityCategory) => {
        if ('order' in item) {
            // Standard category
            if (products.some(p => p.category === item.id)) { 
                setWarningMessage('Standardní kategorie obsahuje aktivní produkty. Nelze smazat.');
                return; 
            }
        } else {
            // Capacity category
            if (products.some(p => p.capacityCategoryId === item.id)) {
                setWarningMessage('Tato kapacitní kategorie je stále přiřazena k některým produktům. Nelze ji smazat.');
                return;
            }
        }
        setDeleteTarget(item);
    };

    const performDelete = async () => {
        if (!deleteTarget) return;
        if ('order' in deleteTarget) {
            const newCats = settings.categories.filter(c => c.id !== deleteTarget.id);
            await updateSettings({ ...settings, categories: newCats });
        } else {
            const newCaps = (settings.capacityCategories || []).filter(c => c.id !== deleteTarget.id);
            await updateSettings({ ...settings, capacityCategories: newCaps });
        }
        setDeleteTarget(null);
    };

    return (
        <div className="animate-fade-in space-y-6">
            {/* TOGGLE */}
            <div className="flex justify-center">
                <div className="bg-gray-100 p-1 rounded-xl flex gap-1 shadow-inner border border-gray-200">
                    <button 
                        onClick={() => setViewMode('standard')}
                        className={`px-6 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${viewMode === 'standard' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <LayoutList size={14}/> Standardní kategorie
                    </button>
                    <button 
                        onClick={() => setViewMode('capacity')}
                        className={`px-6 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${viewMode === 'capacity' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Layers size={14}/> Kapacitní kategorie
                    </button>
                </div>
            </div>

            {viewMode === 'standard' ? (
                <>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-primary flex items-center"><LayoutList className="mr-2 text-accent" /> {t('admin.categories')}</h2>
                        <button onClick={() => { setEditingCategory({ order: sortedCategories.length + 1, enabled: true }); setIsCategoryModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"><Plus size={16} className="mr-2"/> {t('admin.cat_new')}</button>
                    </div>
                    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                        <table className="min-w-full divide-y">
                            <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                                <tr>
                                    <th className="px-6 py-4 text-left">{t('admin.tbl_order')}</th>
                                    <th className="px-6 py-4 text-left">{t('admin.tbl_name')}</th>
                                    <th className="px-6 py-4 text-left">{t('admin.tbl_id_slug')}</th>
                                    <th className="px-6 py-4 text-center">{t('admin.tbl_visibility')}</th>
                                    <th className="px-6 py-4 text-right">{t('admin.tbl_actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-xs">
                                {sortedCategories.map(cat => (
                                    <tr key={cat.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-mono font-bold text-gray-500">{cat.order}</td>
                                        <td className="px-6 py-4 font-bold text-sm">
                                            {tData(cat, 'name')}
                                            {cat.translations && (
                                                <button onClick={() => setViewingTranslations(cat)} className="ml-2 inline-flex items-center text-gray-400 hover:text-accent"><Languages size={14}/></button>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-gray-400">{cat.id}</td>
                                        <td className="px-6 py-4 text-center">
                                            {cat.enabled ? <span className="text-green-500 font-bold">{t('common.active')}</span> : <span className="text-gray-400">Skryto</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            <button onClick={() => { setEditingCategory(cat); setIsCategoryModalOpen(true); }} className="p-1 hover:text-primary"><Edit size={16}/></button>
                                            <button onClick={() => handleDeleteRequest(cat)} className="p-1 hover:text-red-500 text-gray-400"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-primary flex items-center"><Layers className="mr-2 text-accent" /> Kapacitní skupiny (Sdílená příprava)</h2>
                        <button onClick={() => { setEditingCap({ name: '' }); setIsCapModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"><Plus size={16} className="mr-2"/> Nová skupina</button>
                    </div>
                    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                        <table className="min-w-full divide-y">
                            <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                                <tr>
                                    <th className="px-6 py-4 text-left">Název skupiny</th>
                                    <th className="px-6 py-4 text-left">ID</th>
                                    <th className="px-6 py-4 text-center">Produkty</th>
                                    <th className="px-6 py-4 text-right">Akce</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-xs">
                                {capacityCategories.map(cap => {
                                    const linkedCount = products.filter(p => p.capacityCategoryId === cap.id).length;
                                    return (
                                        <tr key={cap.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-bold text-sm">
                                                {tData(cap, 'name')}
                                                {cap.translations && (
                                                    <button 
                                                        onClick={() => setViewingTranslations(cap)} 
                                                        className="ml-2 inline-flex items-center text-gray-400 hover:text-accent transition"
                                                        title="Zobrazit překlady"
                                                    >
                                                        <Languages size={14}/>
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-mono text-gray-400">{cap.id}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full font-bold ${linkedCount > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'}`}>
                                                    {linkedCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                <button onClick={() => { setEditingCap(cap); setIsCapModalOpen(true); }} className="p-1 hover:text-primary"><Edit size={16}/></button>
                                                <button onClick={() => handleDeleteRequest(cap)} className="p-1 hover:text-red-500 text-gray-400"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {capacityCategories.length === 0 && (
                            <div className="p-8 text-center text-gray-400 italic">Žádné kapacitní kategorie nejsou definovány.</div>
                        )}
                    </div>
                </>
            )}

            <TranslationViewModal isOpen={!!viewingTranslations} onClose={() => setViewingTranslations(null)} item={viewingTranslations} />
            <WarningModal isOpen={!!warningMessage} message={warningMessage || ''} onClose={() => setWarningMessage(null)} />
            <DeleteConfirmModal isOpen={!!deleteTarget} title={`${t('common.delete')} ${deleteTarget?.name}?`} onConfirm={performDelete} onClose={() => setDeleteTarget(null)} />

            {/* Standard Category Modal */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={saveCategory} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                        <h3 className="font-bold text-lg">{editingCategory?.id ? 'Upravit kategorii' : 'Nová kategorie'}</h3>
                        <div><label className="text-xs font-bold text-gray-400 block mb-1">Název</label><input required className="w-full border rounded p-2" value={editingCategory?.name || ''} onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })} /></div>
                        <div><label className="text-xs font-bold text-gray-400 block mb-1">Pořadí</label><input type="number" required className="w-full border rounded p-2" value={editingCategory?.order || ''} onChange={e => setEditingCategory({ ...editingCategory, order: Number(e.target.value) })} /></div>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={editingCategory?.enabled ?? true} onChange={e => setEditingCategory({ ...editingCategory, enabled: e.target.checked })} /><span className="text-sm">Aktivní</span></label>
                        <div className="flex gap-2 pt-4">
                            <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">{t('admin.cancel')}</button>
                            <button type="submit" disabled={isTranslating} className="flex-1 py-2 bg-primary text-white rounded flex justify-center items-center">
                                {isTranslating ? <Languages size={14} className="animate-pulse"/> : t('common.save')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Capacity Category Modal */}
            {isCapModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={saveCapacityCategory} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                        <h3 className="font-bold text-lg">{editingCap?.id ? 'Upravit kapacitní skupinu' : 'Nová kapacitní skupina'}</h3>
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">Název skupiny (např. Fritéza)</label>
                            <input required className="w-full border rounded p-2" value={editingCap?.name || ''} onChange={e => setEditingCap({ ...editingCap, name: e.target.value })} />
                        </div>
                        <div className="flex gap-2 pt-4">
                            <button type="button" onClick={() => setIsCapModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">Zrušit</button>
                            <button type="submit" disabled={isTranslating} className="flex-1 py-2 bg-primary text-white rounded flex justify-center items-center">
                                {isTranslating ? <Languages size={14} className="animate-pulse"/> : 'Uložit'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
