
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';
import { ALLERGENS } from '../../constants';
import { generateTranslations } from '../../utils/aiTranslator';
import { Plus, Edit, Trash2, ImageIcon, Check, X, Languages, Globe, Upload, Layers, Search, AlertCircle, Filter } from 'lucide-react';
import { Pagination } from '../../components/Pagination';
import { MultiSelect } from '../../components/MultiSelect';

// ... (TranslationViewModal stays the same) ...
const TranslationViewModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    item: Product | null;
}> = ({ isOpen, onClose, item }) => {
    if (!isOpen || !item || !item.translations) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h3 className="text-xl font-serif font-bold text-primary flex items-center">
                        <Globe className="mr-2 text-accent" size={24}/> 
                        Překlady
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition"><X size={20}/></button>
                </div>

                <div className="space-y-6">
                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                        <h4 className="font-bold text-blue-800 mb-3 flex items-center">
                            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded mr-2">EN</span> 
                            English
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <span className="text-[10px] font-bold text-blue-400 uppercase block mb-1">Name</span>
                                <p className="text-sm font-medium text-gray-800">{item.translations.en?.name || '-'}</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-blue-400 uppercase block mb-1">Description</span>
                                <p className="text-sm text-gray-600 leading-relaxed">{item.translations.en?.description || '-'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-yellow-50/50 rounded-xl p-4 border border-yellow-100">
                        <h4 className="font-bold text-yellow-800 mb-3 flex items-center">
                            <span className="bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded mr-2">DE</span> 
                            Deutsch
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <span className="text-[10px] font-bold text-yellow-500 uppercase block mb-1">Name</span>
                                <p className="text-sm font-medium text-gray-800">{item.translations.de?.name || '-'}</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-yellow-500 uppercase block mb-1">Description</span>
                                <p className="text-sm text-gray-600 leading-relaxed">{item.translations.de?.description || '-'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t flex justify-end">
                    <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-bold text-sm transition">Zavřít</button>
                </div>
            </div>
        </div>
    );
};

export const ProductsTab: React.FC = () => {
    const { products, t, addProduct, updateProduct, deleteProduct, settings, uploadImage, getImageUrl } = useStore();
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{type: string, id: string, name?: string} | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [viewingTranslations, setViewingTranslations] = useState<Product | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    
    // Filters & Pagination
    const [filters, setFilters] = useState({ name: '', category: '', subcategory: '', event: 'all', online: 'all' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);
    const capCategories = useMemo(() => settings.capacityCategories || [], [settings.capacityCategories]);
    
    const getCategoryName = (id: string) => sortedCategories.find(c => c.id === id)?.name || id;

    // Derived subcategories for current editing product's category
    const activeSubcategories = useMemo(() => {
        if (!editingProduct?.category) return [];
        const cat = sortedCategories.find(c => c.id === editingProduct.category);
        if (!cat || !cat.subcategories) return [];
        
        // Normalize: if string, convert to simple obj for consistent mapping
        return cat.subcategories.map(s => 
            typeof s === 'string' ? { id: s, name: s, enabled: true } : s
        ).filter(s => s.enabled);
    }, [editingProduct?.category, sortedCategories]);

    const handleAddClick = () => {
        setSaveError(null);
        setEditingProduct({
            category: sortedCategories[0]?.id || '', 
            unit: 'ks', 
            visibility: { online: true, store: true, stand: true },
            allergens: [],
            images: [],
            price: 0,
            vatRateInner: 12,
            vatRateTakeaway: 12,
            workload: 0,
            workloadOverhead: 0,
            volume: 0,
            noPackaging: false,
            capacityCategoryId: undefined,
            isEventProduct: false,
            subcategory: ''
        });
        setIsProductModalOpen(true);
    };

    const saveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaveError(null);
        if (!editingProduct) return;
        
        const prod = { ...editingProduct } as Product;

        // --- VALIDACE KAPACITNÍ KATEGORIE ---
        if (prod.capacityCategoryId) {
            const conflictingProduct = products.find(p => 
                p.capacityCategoryId === prod.capacityCategoryId && 
                p.category !== prod.category &&
                p.id !== prod.id
            );
            
            if (conflictingProduct) {
                const catName = getCategoryName(conflictingProduct.category);
                const capName = capCategories.find(c => c.id === prod.capacityCategoryId)?.name || prod.capacityCategoryId;
                setSaveError(`Kapacitní skupina "${capName}" je již používána v kategorii "${catName}". Všechny produkty sdílející stejnou kapacitu musí patřit do stejné hlavní kategorie.`);
                return;
            }
        }

        // --- VALIDACE PODKATEGORIE ---
        const catDef = sortedCategories.find(c => c.id === prod.category);
        const subCats = catDef?.subcategories || [];
        
        if (subCats.length > 0) {
            // Normalize IDs for check
            const validIds = subCats.map(s => typeof s === 'string' ? s : s.id);
            if (!prod.subcategory || !validIds.includes(prod.subcategory)) {
                setSaveError(`Pro kategorii "${catDef?.name}" je nutné vybrat platnou podkategorii.`);
                return;
            }
        } else {
            // Clear subcategory if main category has none
            prod.subcategory = undefined;
        }
        
        setIsUploading(true); 
        
        try {
            if (!prod.id) prod.id = Date.now().toString();
            
            if (prod.images && prod.images.length > 0) {
                const processedImages = await Promise.all(prod.images.map(async (img, index) => {
                    if (img.startsWith('data:')) {
                        try {
                            const fileName = `prod-${prod.id}-${Date.now()}-${index}.jpg`;
                            return await uploadImage(img, fileName);
                        } catch (err) {
                            console.error("Failed to upload image:", err);
                            return img; 
                        }
                    }
                    return img;
                }));
                prod.images = processedImages;
            } else {
                prod.images = [];
            }

            if (!prod.category && sortedCategories.length > 0) prod.category = sortedCategories[0].id;
            if (!prod.unit) prod.unit = 'ks';
            if (!prod.visibility) prod.visibility = { online: true, store: true, stand: true };
            if (!prod.allergens) prod.allergens = [];
            
            prod.vatRateInner = Number(prod.vatRateInner ?? 0);
            prod.vatRateTakeaway = Number(prod.vatRateTakeaway ?? 0);
            prod.workload = Number(prod.workload ?? 0);
            prod.workloadOverhead = Number(prod.workloadOverhead ?? 0);
            prod.volume = Number(prod.volume ?? 0); 
            
            if (settings.enableAiTranslation) {
                setIsTranslating(true);
                const translations = await generateTranslations({ 
                    name: prod.name, 
                    description: prod.description 
                });
                prod.translations = translations;
                setIsTranslating(false);
            }

            if (products.some(p => p.id === prod.id)) await updateProduct(prod);
            else await addProduct(prod);
            
            setIsProductModalOpen(false);
        } catch (e) {
            console.error("Save error:", e);
            setSaveError("Chyba při ukládání produktu na server.");
        } finally {
            setIsUploading(false);
            setIsTranslating(false);
        }
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

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            if (filters.name && !p.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
            
            // Subcategory filter text match
            if (filters.subcategory) {
                const term = filters.subcategory.toLowerCase();
                // We compare against ID or try to find name
                const cat = sortedCategories.find(c => c.id === p.category);
                const subObj = cat?.subcategories?.find(s => (typeof s === 'string' ? s : s.id) === p.subcategory);
                const subName = typeof subObj === 'string' ? subObj : subObj?.name || p.subcategory || '';
                
                if (!subName.toLowerCase().includes(term)) return false;
            }
            
            // Multi-category check
            if (filters.category) {
                const selectedCats = filters.category.split(',');
                if (selectedCats.length > 0 && !selectedCats.includes(p.category)) {
                    return false;
                }
            }

            if (filters.event !== 'all') {
                if (filters.event === 'yes' && !p.isEventProduct) return false;
                if (filters.event === 'no' && p.isEventProduct) return false;
            }
            if (filters.online !== 'all') {
                if (filters.online === 'yes' && !p.visibility.online) return false;
                if (filters.online === 'no' && p.visibility.online) return false;
            }
            return true;
        });
    }, [products, filters]);

    const paginatedProducts = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredProducts.slice(start, start + itemsPerPage);
    }, [filteredProducts, currentPage, itemsPerPage]);

    // Prepare category options for MultiSelect
    const categoryOptions = sortedCategories.map(c => ({
        value: c.id,
        label: c.name
    }));

    // Helper to get subcategory Name from ID
    const getSubcategoryName = (catId: string, subId?: string) => {
        if (!subId) return '-';
        const cat = sortedCategories.find(c => c.id === catId);
        if (!cat) return subId;
        const sub = cat.subcategories?.find(s => (typeof s === 'string' ? s : s.id) === subId);
        return typeof sub === 'string' ? sub : (sub?.name || subId);
    };

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-primary">{t('admin.products')}</h2>
                </div>
                <button onClick={handleAddClick} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"><Plus size={16} className="mr-2"/> {t('admin.add_product')}</button>
            </div>

            {/* FILTERS BAR */}
            <div className="bg-white p-4 rounded-xl border shadow-sm grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Název produktu</label>
                    <input 
                        type="text" 
                        className="w-full border rounded p-2 text-xs" 
                        placeholder="Hledat..." 
                        value={filters.name} 
                        onChange={e => setFilters({...filters, name: e.target.value})} 
                    />
                </div>
                <div>
                    <MultiSelect 
                        label="Kategorie"
                        options={categoryOptions}
                        selectedValues={filters.category ? filters.category.split(',') : []}
                        onChange={(values) => setFilters({...filters, category: values.join(',')})}
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Podkategorie</label>
                    <input 
                        type="text" 
                        className="w-full border rounded p-2 text-xs" 
                        placeholder="Text..." 
                        value={filters.subcategory} 
                        onChange={e => setFilters({...filters, subcategory: e.target.value})} 
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">V akci</label>
                    <select 
                        className="w-full border rounded p-2 text-xs bg-white" 
                        value={filters.event} 
                        onChange={e => setFilters({...filters, event: e.target.value})}
                    >
                        <option value="all">{t('filter.all')}</option>
                        <option value="yes">{t('common.yes')}</option>
                        <option value="no">{t('common.no')}</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Online</label>
                    <select 
                        className="w-full border rounded p-2 text-xs bg-white" 
                        value={filters.online} 
                        onChange={e => setFilters({...filters, online: e.target.value})}
                    >
                        <option value="all">{t('filter.all')}</option>
                        <option value="yes">{t('common.yes')}</option>
                        <option value="no">{t('common.no')}</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="min-w-full divide-y">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                    <tr>
                    <th className="px-6 py-4 text-left">Foto</th>
                    <th className="px-6 py-4 text-left">Název</th>
                    <th className="px-6 py-4 text-left">Kategorie</th>
                    <th className="px-6 py-4 text-left">Podkategorie</th>
                    <th className="px-6 py-4 text-center">V akci</th>
                    <th className="px-6 py-4 text-left">Cena</th>
                    <th className="px-6 py-4 text-center">Online</th>
                    <th className="px-6 py-4 text-right">Akce</th>
                    </tr>
                </thead>
                <tbody className="divide-y text-xs">
                    {paginatedProducts.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                        {p.images?.[0] ? <img src={getImageUrl(p.images[0])} className="w-10 h-10 object-cover rounded" /> : <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center"><ImageIcon size={16} className="text-gray-400"/></div>}
                        </td>
                        <td className="px-6 py-4 font-bold">
                            {p.name}
                            {p.translations && (
                                <button onClick={() => setViewingTranslations(p)} className="ml-1 inline-flex items-center text-gray-300 hover:text-accent"><Languages size={12}/></button>
                            )}
                        </td>
                        <td className="px-6 py-4">{getCategoryName(p.category)}</td>
                        <td className="px-6 py-4 text-gray-500">{getSubcategoryName(p.category, p.subcategory)}</td>
                        <td className="px-6 py-4 text-center">
                            {p.isEventProduct && <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 font-bold rounded-full text-[9px] uppercase">AKCE</span>}
                        </td>
                        <td className="px-6 py-4">{p.price} Kč / {p.unit}</td>
                        <td className="px-6 py-4 text-center">{p.visibility?.online ? <Check size={16} className="inline text-green-500"/> : <X size={16} className="inline text-gray-300"/>}</td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button onClick={() => { setSaveError(null); setEditingProduct(p); setIsProductModalOpen(true); }} className="p-1 hover:text-primary"><Edit size={16}/></button>
                        <button onClick={() => setConfirmDelete({type: 'product', id: p.id, name: p.name})} className="p-1 hover:text-red-500 text-gray-400"><Trash2 size={16}/></button>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
                <Pagination 
                    currentPage={currentPage}
                    totalPages={Math.ceil(filteredProducts.length / itemsPerPage)}
                    onPageChange={setCurrentPage}
                    limit={itemsPerPage}
                    onLimitChange={(l) => { setItemsPerPage(l); setCurrentPage(1); }}
                    totalItems={filteredProducts.length}
                />
            </div>

            <TranslationViewModal isOpen={!!viewingTranslations} onClose={() => setViewingTranslations(null)} item={viewingTranslations} />

            {isProductModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                <form onSubmit={saveProduct} className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
                    <div className="flex justify-between items-center border-b pb-4 flex-shrink-0">
                        <h3 className="font-bold text-lg">{editingProduct?.id ? t('admin.edit_product') : t('admin.add_product')}</h3>
                        <button type="button" onClick={() => setIsProductModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full transition"><X size={20}/></button>
                    </div>

                    <div className="flex-grow overflow-y-auto pr-2 space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-400 block mb-1">Název produktu</label>
                                <input required className="w-full border rounded p-2" value={editingProduct?.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-400 block mb-1">Popis</label>
                                <textarea className="w-full border rounded p-2 h-20" value={editingProduct?.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Cena (Kč)</label>
                                    <input type="number" required className="w-full border rounded p-2" value={editingProduct?.price || ''} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Jednotka</label>
                                    <select className="w-full border rounded p-2 bg-white" value={editingProduct?.unit || 'ks'} onChange={e => setEditingProduct({...editingProduct, unit: e.target.value as 'ks'|'kg'})}>
                                        <option value="ks">ks (Kusy)</option>
                                        <option value="kg">kg (Kilogramy)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-400 block mb-1">Kategorie</label>
                                <select 
                                    className="w-full border rounded p-2 bg-white" 
                                    value={editingProduct?.category} 
                                    onChange={e => setEditingProduct({...editingProduct, category: e.target.value, subcategory: ''})} // Reset subcategory on change
                                >
                                    {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            
                            {/* Subcategory Selector (Conditional) */}
                            {activeSubcategories.length > 0 && (
                                <div className="col-span-2 bg-blue-50 p-2 rounded border border-blue-100">
                                    <label className="text-xs font-bold text-blue-700 block mb-1">Podkategorie (Povinné)</label>
                                    <select 
                                        className="w-full border rounded p-2 bg-white" 
                                        value={editingProduct?.subcategory || ''} 
                                        onChange={e => setEditingProduct({...editingProduct, subcategory: e.target.value})}
                                        required
                                    >
                                        <option value="">- Vyberte podkategorii -</option>
                                        {activeSubcategories.map(sub => (
                                            <option key={sub.id} value={sub.id}>{sub.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
                            <h4 className="font-bold text-sm text-gray-500 uppercase">Logistika a Časování</h4>
                            <div className="grid grid-cols-4 gap-4">
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Objednat předem (dny)</label><input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.leadTimeDays || ''} onChange={e => setEditingProduct({...editingProduct, leadTimeDays: Number(e.target.value)})} /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Trvanlivost (dny)</label><input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.shelfLifeDays || ''} onChange={e => setEditingProduct({...editingProduct, shelfLifeDays: Number(e.target.value)})} /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Min. odběr (ks)</label><input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.minOrderQuantity || ''} onChange={e => setEditingProduct({...editingProduct, minOrderQuantity: Number(e.target.value)})} /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Objem (ml)</label><input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.volume || ''} onChange={e => setEditingProduct({...editingProduct, volume: Number(e.target.value)})} /></div>
                            </div>
                            <div className="flex flex-col gap-2 pt-1">
                                <label className="flex items-center space-x-2 text-sm"><input type="checkbox" checked={editingProduct?.noPackaging ?? false} onChange={e => setEditingProduct({...editingProduct, noPackaging: e.target.checked})} className="rounded text-accent"/><span>Nebalí se (nezapočítávat do objemu krabic)</span></label>
                                <label className="flex items-center space-x-2 text-sm font-bold text-purple-700 bg-purple-50 p-2 rounded border border-purple-100"><input type="checkbox" checked={editingProduct?.isEventProduct ?? false} onChange={e => setEditingProduct({...editingProduct, isEventProduct: e.target.checked})} className="rounded text-purple-600 focus:ring-purple-600"/><span>PRODUKT JE V AKCI (Event)</span></label>
                            </div>
                        </div>

                        {/* ... rest of the form ... */}
                        <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
                            <h4 className="font-bold text-sm text-gray-500 uppercase">Ekonomika a Kapacity</h4>
                            <div className="grid grid-cols-4 gap-4">
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Pracnost (body)</label><input type="number" min="0" className="w-full border rounded p-2 text-sm" value={editingProduct?.workload ?? ''} onChange={e => setEditingProduct({...editingProduct, workload: Number(e.target.value)})} /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Režie přípravy</label><input type="number" min="0" className="w-full border rounded p-2 text-sm" value={editingProduct?.workloadOverhead ?? ''} onChange={e => setEditingProduct({...editingProduct, workloadOverhead: Number(e.target.value)})} /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">DPH Prodejna (%)</label><input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.vatRateInner ?? ''} onChange={e => setEditingProduct({...editingProduct, vatRateInner: Number(e.target.value)})} /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">DPH S sebou (%)</label><input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.vatRateTakeaway ?? ''} onChange={e => setEditingProduct({...editingProduct, vatRateTakeaway: Number(e.target.value)})} /></div>
                            </div>
                            <div className="pt-2">
                                <label className="text-xs font-bold text-gray-400 block mb-1">Kapacitní skupina (sdílená režie přípravy)</label>
                                <select 
                                    className="w-full border rounded p-2 text-sm bg-white" 
                                    value={editingProduct?.capacityCategoryId || ''} 
                                    onChange={e => setEditingProduct({...editingProduct, capacityCategoryId: e.target.value || undefined})}
                                >
                                    <option value="">- Žádná (příprava samostatně) -</option>
                                    {capCategories.map(cc => (
                                        <option key={cc.id} value={cc.id}>{cc.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-2">Viditelnost</label>
                            <div className="flex gap-4">
                                <label className="flex items-center space-x-2 text-sm"><input type="checkbox" checked={editingProduct?.visibility?.online ?? true} onChange={e => setEditingProduct({...editingProduct, visibility: { ...editingProduct?.visibility || { online: true, store: true, stand: true }, online: e.target.checked }})} /><span>E-shop</span></label>
                                <label className="flex items-center space-x-2 text-sm"><input type="checkbox" checked={editingProduct?.visibility?.store ?? true} onChange={e => setEditingProduct({...editingProduct, visibility: { ...editingProduct?.visibility || { online: true, store: true, stand: true }, store: e.target.checked }})} /><span>Prodejna</span></label>
                                <label className="flex items-center space-x-2 text-sm"><input type="checkbox" checked={editingProduct?.visibility?.stand ?? true} onChange={e => setEditingProduct({...editingProduct, visibility: { ...editingProduct?.visibility || { online: true, store: true, stand: true }, stand: e.target.checked }})} /><span>Stánek</span></label>
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
                                        <img src={getImageUrl(img)} className="w-full h-full object-cover" />
                                        <button type="button" onClick={() => setEditingProduct({...editingProduct, images: editingProduct.images?.filter((_, i) => i !== idx)})} className="absolute top-0 right-0 bg-red-500 text-white p-1 opacity-0 group-hover:opacity-100 transition"><X size={12}/></button>
                                    </div>
                                ))}
                                <label className={`w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <Plus size={24} />
                                    <input type="file" className="hidden" onChange={handleImageFileChange} disabled={isUploading} />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex-shrink-0 pt-4 border-t mt-2">
                        {saveError && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded flex items-start gap-2 mb-4 animate-in slide-in-from-bottom-2">
                                <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                                <p className="text-xs text-red-700 font-bold">{saveError}</p>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setIsProductModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">{t('admin.cancel')}</button>
                            <button type="submit" disabled={isTranslating || isUploading} className="flex-1 py-2 bg-primary text-white rounded flex justify-center items-center">
                                {isUploading ? 'Nahrávám...' : isTranslating ? 'Překládám...' : t('common.save')}
                            </button>
                        </div>
                    </div>
                </form>
                </div>
            )}
        </div>
    );
};
