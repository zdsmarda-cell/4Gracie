
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, Ingredient, ProductIngredient } from '../../types';
import { ALLERGENS } from '../../constants';
import { Plus, Edit, Trash2, Check, X, ImageIcon, Search, AlertCircle, Wheat, RefreshCw, Filter } from 'lucide-react';
import { Pagination } from '../../components/Pagination';
import { MultiSelect } from '../../components/MultiSelect';

const DeleteConfirmModal: React.FC<{
    isOpen: boolean;
    title: string;
    onConfirm: () => void;
    onClose: () => void;
}> = ({ isOpen, title, onConfirm, onClose }) => {
    const { t } = useStore();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
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

export const ProductsTab: React.FC = () => {
    const { products, addProduct, updateProduct, deleteProduct, searchProducts, settings, t, tData, uploadImage, getImageUrl, ingredients } = useStore();
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
    
    // Filters & Pagination State
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);
    const [isListLoading, setIsListLoading] = useState(false);

    const [filters, setFilters] = useState({
        search: '',
        categories: '',
        minPrice: '',
        maxPrice: '',
        visibility: '',
        isEvent: 'all',
        noPackaging: 'all'
    });

    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [isUploading, setIsUploading] = useState(false);

    // CSS class for number inputs to hide spinners
    const noSpinnerClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

    const getCategoryName = (id: string) => settings.categories.find(c => c.id === id)?.name || id;

    // Load Data
    const loadData = async () => {
        setIsListLoading(true);
        try {
            const res = await searchProducts({
                page,
                limit,
                ...filters
            });
            setDisplayedProducts(res.products);
            setTotalItems(res.total);
            setTotalPages(res.pages);
        } catch(e) {
            console.error(e);
        } finally {
            setIsListLoading(false);
        }
    };

    // Trigger load on filter/page change
    useEffect(() => {
        loadData();
    }, [page, limit, filters]); // removed searchProducts from deps to avoid loop if unstable

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1); // Reset to page 1 on filter change
    };

    const clearFilters = () => {
        setFilters({
            search: '',
            categories: '',
            minPrice: '',
            maxPrice: '',
            visibility: '',
            isEvent: 'all',
            noPackaging: 'all'
        });
        setPage(1);
    };

    // Subcategories for current editing product's category
    const availableSubcategories = useMemo(() => {
        if (!editingProduct?.category) return [];
        const cat = settings.categories.find(c => c.id === editingProduct.category);
        if (!cat || !cat.subcategories) return [];
        return cat.subcategories.map(s => typeof s === 'string' ? { id: s, name: s } : s);
    }, [editingProduct?.category, settings.categories]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationErrors({});
        if (!editingProduct) return;

        const errors: Record<string, string> = {};
        
        // Strict Validation
        if (!editingProduct.name || editingProduct.name.trim().length === 0) {
            errors.name = t('validation.required');
        }
        if (editingProduct.price === undefined || editingProduct.price === null || isNaN(Number(editingProduct.price))) {
            errors.price = t('validation.required');
        } else if (Number(editingProduct.price) < 0) {
            errors.price = 'Cena musí být 0 nebo vyšší';
        }
        
        if (!editingProduct.unit) {
            errors.unit = t('validation.required');
        }
        if (!editingProduct.category) {
            errors.category = t('validation.required');
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }

        setIsUploading(true);
        try {
            const p = { ...editingProduct } as Product;
            if (!p.id) p.id = Date.now().toString();
            
            // Image Upload Handling
            if (p.images && p.images.length > 0) {
                const newImages = [];
                for (const img of p.images) {
                    if (img.startsWith('data:')) {
                        // It's a new base64 image, upload it
                        const url = await uploadImage(img, `prod-${p.id}-${Date.now()}.jpg`);
                        newImages.push(url);
                    } else {
                        newImages.push(img);
                    }
                }
                p.images = newImages;
            }

            // Defaults
            if (!p.visibility) p.visibility = { online: true, store: true, stand: true };
            if (!p.allergens) p.allergens = [];
            p.vatRateInner = Number(p.vatRateInner ?? 0);
            p.vatRateTakeaway = Number(p.vatRateTakeaway ?? 0);
            p.workload = Number(p.workload ?? 0);
            p.workloadOverhead = Number(p.workloadOverhead ?? 0);
            p.price = Number(p.price);
            
            // Ensure noPackaging is boolean
            p.noPackaging = !!p.noPackaging;

            if (products.some(prod => prod.id === p.id)) {
                await updateProduct(p);
            } else {
                await addProduct(p);
            }
            setIsProductModalOpen(false);
            loadData(); // Refresh list
        } catch (e) {
            console.error(e);
            alert('Chyba při ukládání.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && editingProduct) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setEditingProduct(prev => prev ? ({ ...prev, images: [...(prev.images || []), base64] }) : null);
            };
            reader.readAsDataURL(file);
        }
    };

    const confirmDelete = async () => {
        if (deleteTarget) {
            await deleteProduct(deleteTarget.id);
            setDeleteTarget(null);
            loadData(); // Refresh list
        }
    };

    const handleAddIngredient = (ingredientId: string) => {
        if (!editingProduct) return;
        const currentComp = editingProduct.composition || [];
        if (currentComp.some(c => c.ingredientId === ingredientId)) return;
        
        setEditingProduct({
            ...editingProduct,
            composition: [...currentComp, { ingredientId, quantity: 0 }]
        });
    };

    const handleRemoveIngredient = (ingredientId: string) => {
        if (!editingProduct) return;
        setEditingProduct({
            ...editingProduct,
            composition: editingProduct.composition?.filter(c => c.ingredientId !== ingredientId)
        });
    };

    const handleIngredientQuantityChange = (ingredientId: string, qty: number) => {
        if (!editingProduct) return;
        setEditingProduct({
            ...editingProduct,
            composition: editingProduct.composition?.map(c => 
                c.ingredientId === ingredientId ? { ...c, quantity: qty } : c
            )
        });
    };
    
    // Filter Option Maps
    const categoryOptions = useMemo(() => settings.categories.map(c => ({ value: c.id, label: c.name })), [settings.categories]);
    const visibilityOptions = [
        { value: 'online', label: 'E-shop' },
        { value: 'store', label: 'Prodejna' },
        { value: 'stand', label: 'Stánek' }
    ];

    const hasActiveFilters = Object.values(filters).some(val => val !== '' && val !== 'all');

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-primary">{t('admin.products')}</h2>
                    <button 
                        onClick={loadData} 
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition" 
                        title="Obnovit"
                    >
                        <RefreshCw size={18} className={isListLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
                <button onClick={() => { setEditingProduct({ visibility: { online: true, store: true, stand: true }, allergens: [], images: [], composition: [] }); setIsProductModalOpen(true); setValidationErrors({}); }} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow-sm hover:bg-black transition"><Plus size={16} className="mr-2"/> {t('admin.add_product')}</button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border shadow-sm grid grid-cols-2 md:grid-cols-7 gap-3 mb-4 items-end">
                <div className="col-span-2 md:col-span-1">
                    <label className="text-[10px] font-bold text-gray-400 block mb-1">Hledat</label>
                    <div className="relative">
                        <Search size={14} className="absolute left-2 top-2 text-gray-400"/>
                        <input className="w-full border rounded pl-7 p-1.5 text-xs" placeholder="Název..." value={filters.search} onChange={e => handleFilterChange('search', e.target.value)} />
                    </div>
                </div>
                <div className="col-span-2 md:col-span-1">
                    <MultiSelect 
                        label="Kategorie"
                        options={categoryOptions}
                        selectedValues={filters.categories ? filters.categories.split(',') : []}
                        onChange={v => handleFilterChange('categories', v.join(','))}
                    />
                </div>
                <div className="col-span-2 md:col-span-1">
                     <label className="text-[10px] font-bold text-gray-400 block mb-1">Cena</label>
                     <div className="flex gap-1">
                         <input type="number" className="w-1/2 border rounded p-1.5 text-xs" placeholder="Od" value={filters.minPrice} onChange={e => handleFilterChange('minPrice', e.target.value)} />
                         <input type="number" className="w-1/2 border rounded p-1.5 text-xs" placeholder="Do" value={filters.maxPrice} onChange={e => handleFilterChange('maxPrice', e.target.value)} />
                     </div>
                </div>
                <div className="col-span-2 md:col-span-1">
                    <MultiSelect 
                        label="Viditelnost"
                        options={visibilityOptions}
                        selectedValues={filters.visibility ? filters.visibility.split(',') : []}
                        onChange={v => handleFilterChange('visibility', v.join(','))}
                    />
                </div>
                <div>
                     <label className="text-[10px] font-bold text-gray-400 block mb-1">Akční zboží</label>
                     <select className="w-full border rounded p-1.5 text-xs bg-white" value={filters.isEvent} onChange={e => handleFilterChange('isEvent', e.target.value)}>
                         <option value="all">Vše</option>
                         <option value="yes">Ano</option>
                         <option value="no">Ne</option>
                     </select>
                </div>
                <div>
                     <label className="text-[10px] font-bold text-gray-400 block mb-1">Bez obalu</label>
                     <select className="w-full border rounded p-1.5 text-xs bg-white" value={filters.noPackaging} onChange={e => handleFilterChange('noPackaging', e.target.value)}>
                         <option value="all">Vše</option>
                         <option value="yes">Ano</option>
                         <option value="no">Ne</option>
                     </select>
                </div>
                <div>
                    {hasActiveFilters && (
                        <button onClick={clearFilters} className="w-full text-xs text-red-500 hover:text-red-700 font-bold flex items-center justify-center p-1.5 mb-[1px]">
                            <X size={14} className="mr-1"/> Zrušit
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y">
                        <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                            <tr>
                                <th className="px-6 py-4 text-left w-20">Foto</th>
                                <th className="px-6 py-4 text-left">{t('admin.tbl_name')}</th>
                                <th className="px-6 py-4 text-left">{t('admin.tbl_category')}</th>
                                <th className="px-6 py-4 text-left">{t('admin.tbl_price')}</th>
                                <th className="px-6 py-4 text-center">{t('admin.tbl_visibility')}</th>
                                <th className="px-6 py-4 text-right">{t('admin.tbl_actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                            {displayedProducts.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        {p.images?.[0] ? (
                                            <img src={getImageUrl(p.images[0], 'small')} className="w-10 h-10 object-cover rounded" loading="lazy" />
                                        ) : (
                                            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-300"><ImageIcon size={16}/></div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-900">
                                        {tData(p, 'name')}
                                        <div className="flex gap-1 mt-1">
                                            {p.isEventProduct && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">AKCE</span>}
                                            {p.noPackaging && <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[9px] font-bold">BEZ OBALU</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{getCategoryName(p.category)}</td>
                                    <td className="px-6 py-4 font-mono">{p.price} Kč / {p.unit}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-1">
                                            {p.visibility?.online && <span className="w-2 h-2 rounded-full bg-green-500" title="E-shop"></span>}
                                            {p.visibility?.store && <span className="w-2 h-2 rounded-full bg-blue-500" title="Prodejna"></span>}
                                            {p.visibility?.stand && <span className="w-2 h-2 rounded-full bg-orange-500" title="Stánek"></span>}
                                            {(!p.visibility?.online && !p.visibility?.store && !p.visibility?.stand) && <span className="text-gray-300"><X size={14}/></span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); setValidationErrors({}); }} className="p-1 hover:text-primary"><Edit size={16}/></button>
                                        <button onClick={() => setDeleteTarget(p)} className="p-1 hover:text-red-500 text-gray-400"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {displayedProducts.length === 0 && (
                        <div className="p-12 text-center text-gray-400">Žádné produkty k zobrazení</div>
                    )}
                </div>
                
                <Pagination 
                    currentPage={page} 
                    totalPages={totalPages} 
                    onPageChange={setPage} 
                    limit={limit} 
                    onLimitChange={(l) => { setLimit(l); setPage(1); }} 
                    totalItems={totalItems} 
                />
            </div>

            <DeleteConfirmModal 
                isOpen={!!deleteTarget} 
                title={`Smazat produkt ${deleteTarget?.name}?`} 
                onConfirm={confirmDelete} 
                onClose={() => setDeleteTarget(null)} 
            />

            {isProductModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={handleSave} className="bg-white rounded-2xl w-full max-w-4xl p-6 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
                        <h3 className="font-bold text-lg border-b pb-4 sticky top-0 bg-white z-10 flex justify-between items-center">
                            <span>{editingProduct?.id && !editingProduct.id.startsWith('Date') ? t('admin.edit_product') : t('admin.add_product')}</span>
                            <div className="flex items-center gap-2">
                                {isUploading && <span className="text-xs text-blue-600 animate-pulse font-bold mr-2">Ukládám...</span>}
                                <button type="button" onClick={() => setIsProductModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                            </div>
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-grow overflow-y-auto">
                            {/* LEFT COLUMN: BASIC INFO */}
                            <div className="space-y-4">
                                <h4 className="font-bold text-sm text-primary uppercase border-b pb-1 mb-3">Základní informace</h4>
                                
                                {/* NAME */}
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">
                                        Název {validationErrors.name && <span className="text-red-500">*</span>}
                                    </label>
                                    <input 
                                        className={`w-full border rounded p-2 text-sm font-bold ${validationErrors.name ? 'border-red-500 bg-red-50' : ''}`} 
                                        value={editingProduct?.name || ''} 
                                        onChange={e => {
                                            setEditingProduct(editingProduct ? {...editingProduct, name: e.target.value} : null);
                                            setValidationErrors({...validationErrors, name: ''});
                                        }} 
                                    />
                                    {validationErrors.name && <div className="text-red-500 text-[10px] mt-1">{validationErrors.name}</div>}
                                </div>

                                {/* DESCRIPTION */}
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Popis</label>
                                    <textarea className="w-full border rounded p-2 h-20 text-sm" value={editingProduct?.description || ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, description: e.target.value} : null)} />
                                </div>
                                
                                {/* PRICE & UNIT */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 block mb-1">
                                            Cena (Kč) {validationErrors.price && <span className="text-red-500">*</span>}
                                        </label>
                                        <input 
                                            type="number" 
                                            className={`w-full border rounded p-2 text-sm font-mono ${noSpinnerClass} ${validationErrors.price ? 'border-red-500 bg-red-50' : ''}`} 
                                            value={editingProduct?.price ?? ''} 
                                            onChange={e => {
                                                setEditingProduct(editingProduct ? {...editingProduct, price: Number(e.target.value)} : null);
                                                setValidationErrors({...validationErrors, price: ''});
                                            }} 
                                        />
                                        {validationErrors.price && <div className="text-red-500 text-[10px] mt-1">{validationErrors.price}</div>}
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 block mb-1">
                                            Jednotka {validationErrors.unit && <span className="text-red-500">*</span>}
                                        </label>
                                        <select 
                                            className={`w-full border rounded p-2 text-sm bg-white ${validationErrors.unit ? 'border-red-500 bg-red-50' : ''}`}
                                            value={editingProduct?.unit || ''} 
                                            onChange={e => {
                                                setEditingProduct(editingProduct ? {...editingProduct, unit: e.target.value as any} : null);
                                                setValidationErrors({...validationErrors, unit: ''});
                                            }}
                                        >
                                            <option value="">-- Vyberte --</option>
                                            <option value="ks">ks</option>
                                            <option value="kg">kg</option>
                                        </select>
                                        {validationErrors.unit && <div className="text-red-500 text-[10px] mt-1">{validationErrors.unit}</div>}
                                    </div>
                                </div>

                                {/* CATEGORIES */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 block mb-1">
                                            Kategorie {validationErrors.category && <span className="text-red-500">*</span>}
                                        </label>
                                        <select 
                                            className={`w-full border rounded p-2 text-sm bg-white ${validationErrors.category ? 'border-red-500 bg-red-50' : ''}`} 
                                            value={editingProduct?.category || ''} 
                                            onChange={e => {
                                                setEditingProduct(editingProduct ? {...editingProduct, category: e.target.value, subcategory: undefined} : null);
                                                setValidationErrors({...validationErrors, category: ''});
                                            }}
                                        >
                                            <option value="">-- Vyberte --</option>
                                            {settings.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        {validationErrors.category && <div className="text-red-500 text-[10px] mt-1">{validationErrors.category}</div>}
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 block mb-1">Podkategorie</label>
                                        <select className="w-full border rounded p-2 text-sm bg-white" value={editingProduct?.subcategory || ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, subcategory: e.target.value} : null)} disabled={availableSubcategories.length === 0}>
                                            <option value="">-- Žádná --</option>
                                            {availableSubcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <label className="flex items-center gap-2 p-2 border rounded bg-purple-50 cursor-pointer hover:bg-purple-100 transition">
                                        <input 
                                            type="checkbox" 
                                            checked={editingProduct?.isEventProduct ?? false} 
                                            onChange={e => setEditingProduct(editingProduct ? {...editingProduct, isEventProduct: e.target.checked} : null)} 
                                            className="rounded text-purple-600 focus:ring-purple-600"
                                        />
                                        <span className="text-sm font-bold text-purple-900">Produkt pouze pro AKCE (Eventy)</span>
                                    </label>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-2">{t('common.images')}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {editingProduct?.images?.map((img, idx) => (
                                            <div key={idx} className="relative w-20 h-20 group rounded-lg overflow-hidden border">
                                                <img src={getImageUrl(img)} className="w-full h-full object-cover" />
                                                <button type="button" onClick={() => setEditingProduct(editingProduct ? {...editingProduct, images: editingProduct.images.filter((_, i) => i !== idx)} : null)} className="absolute top-0 right-0 bg-red-500 text-white p-1 opacity-0 group-hover:opacity-100 transition"><X size={12}/></button>
                                            </div>
                                        ))}
                                        <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition">
                                            <Plus size={24} />
                                            <span className="text-[10px] mt-1">Nahrát</span>
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageFileChange} />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: LOGISTICS, ECONOMICS, ALLERGENS, COMPOSITION */}
                            <div className="space-y-6">
                                {/* Composition / Ingredients */}
                                <div className="bg-gray-50 p-4 rounded-xl border">
                                    <h4 className="font-bold text-sm text-gray-500 uppercase mb-3 flex items-center">
                                        <Wheat size={14} className="mr-2"/> Receptura (Suroviny)
                                    </h4>
                                    
                                    <div className="space-y-2 mb-3">
                                        {editingProduct?.composition?.map((comp, idx) => {
                                            const ing = ingredients.find(i => i.id === comp.ingredientId);
                                            if (!ing) return null;
                                            return (
                                                <div key={comp.ingredientId} className="flex items-center gap-2 text-sm bg-white p-2 rounded border border-gray-200">
                                                    <span className="flex-grow font-bold text-gray-700">{ing.name}</span>
                                                    <input 
                                                        type="number" 
                                                        className={`w-16 border rounded p-1 text-right font-mono text-xs ${noSpinnerClass}`}
                                                        placeholder="0"
                                                        step="0.01"
                                                        value={comp.quantity}
                                                        onChange={(e) => handleIngredientQuantityChange(comp.ingredientId, Number(e.target.value))}
                                                    />
                                                    <span className="text-gray-500 w-8 text-xs">{ing.unit}</span>
                                                    <button onClick={() => handleRemoveIngredient(comp.ingredientId)} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                                                </div>
                                            );
                                        })}
                                        {(!editingProduct?.composition || editingProduct.composition.length === 0) && (
                                            <p className="text-xs text-gray-400 italic text-center">Žádné suroviny</p>
                                        )}
                                    </div>

                                    <div className="relative">
                                        <select 
                                            className="w-full border rounded p-2 text-xs bg-white text-gray-600"
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    handleAddIngredient(e.target.value);
                                                    e.target.value = ''; // Reset
                                                }
                                            }}
                                        >
                                            <option value="">+ Přidat surovinu...</option>
                                            {ingredients
                                                .filter(i => !editingProduct?.composition?.some(c => c.ingredientId === i.id))
                                                .filter(i => !i.isHidden) // Only show visible
                                                .sort((a,b) => a.name.localeCompare(b.name))
                                                .map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)
                                            }
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
                                    <h4 className="font-bold text-sm text-gray-500 uppercase">Logistika a Časování</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">Objednat předem (dny)</label>
                                            <input type="number" className={`w-full border rounded p-2 text-sm ${noSpinnerClass}`} value={editingProduct?.leadTimeDays ?? ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, leadTimeDays: Number(e.target.value)} : null)} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">Trvanlivost (dny)</label>
                                            <input type="number" className={`w-full border rounded p-2 text-sm ${noSpinnerClass}`} value={editingProduct?.shelfLifeDays ?? ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, shelfLifeDays: Number(e.target.value)} : null)} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">Min. odběr (ks)</label>
                                            <input type="number" className={`w-full border rounded p-2 text-sm ${noSpinnerClass}`} value={editingProduct?.minOrderQuantity ?? ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, minOrderQuantity: Number(e.target.value)} : null)} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">Objem (ml/g)</label>
                                            <input type="number" className={`w-full border rounded p-2 text-sm ${noSpinnerClass}`} value={editingProduct?.volume ?? ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, volume: Number(e.target.value)} : null)} />
                                        </div>
                                        <div className="col-span-2 md:col-span-4 pt-2">
                                            <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                                                <input 
                                                    type="checkbox" 
                                                    checked={editingProduct?.noPackaging ?? false} 
                                                    onChange={e => setEditingProduct(editingProduct ? {...editingProduct, noPackaging: e.target.checked} : null)} 
                                                    className="rounded text-primary focus:ring-accent"
                                                />
                                                <span className="font-bold text-gray-600">Nepočítat do obalů (nevstupuje do výpočtu objemu krabice)</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
                                    <h4 className="font-bold text-sm text-gray-500 uppercase">Ekonomika a Kapacity</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">Pracnost (body)</label>
                                            <input type="number" min="0" className={`w-full border rounded p-2 text-sm ${noSpinnerClass}`} value={editingProduct?.workload ?? ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, workload: Number(e.target.value)} : null)} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">Režie přípravy</label>
                                            <input type="number" min="0" className={`w-full border rounded p-2 text-sm ${noSpinnerClass}`} value={editingProduct?.workloadOverhead ?? ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, workloadOverhead: Number(e.target.value)} : null)} />
                                        </div>
                                        
                                        {/* Capacity Category Selector */}
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">Kapacitní skupina (Sdílená režie)</label>
                                            <select 
                                                className="w-full border rounded p-2 text-xs bg-white"
                                                value={editingProduct?.capacityCategoryId || ''}
                                                onChange={e => setEditingProduct(editingProduct ? {...editingProduct, capacityCategoryId: e.target.value || undefined} : null)}
                                            >
                                                <option value="">-- Žádná (Samostatná režie) --</option>
                                                {settings.capacityCategories?.map(cc => (
                                                    <option key={cc.id} value={cc.id}>{cc.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">DPH Prodejna (%)</label>
                                            <input type="number" className={`w-full border rounded p-2 text-sm ${noSpinnerClass}`} value={editingProduct?.vatRateInner ?? ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, vatRateInner: Number(e.target.value)} : null)} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">DPH S sebou (%)</label>
                                            <input type="number" className={`w-full border rounded p-2 text-sm ${noSpinnerClass}`} value={editingProduct?.vatRateTakeaway ?? ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, vatRateTakeaway: Number(e.target.value)} : null)} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-2">Viditelnost</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={editingProduct?.visibility?.online ?? true} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, visibility: { ...editingProduct.visibility || { online: true, store: true, stand: true }, online: e.target.checked }} : null)} className="rounded text-primary"/>
                                            <span>E-shop (Online)</span>
                                        </label>
                                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={editingProduct?.visibility?.store ?? true} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, visibility: { ...editingProduct.visibility || { online: true, store: true, stand: true }, store: e.target.checked }} : null)} className="rounded text-primary"/>
                                            <span>Prodejna (Kasa)</span>
                                        </label>
                                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={editingProduct?.visibility?.stand ?? true} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, visibility: { ...editingProduct.visibility || { online: true, store: true, stand: true }, stand: e.target.checked }} : null)} className="rounded text-primary"/>
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
                                                        setEditingProduct(editingProduct ? {...editingProduct, allergens: updated} : null);
                                                    }}
                                                />
                                                <span className="font-bold text-lg leading-none mb-1">{a.code}</span>
                                                <span className="text-[9px] leading-tight text-gray-600 line-clamp-2">{a.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-4 border-t sticky bottom-0 bg-white z-10">
                            <button type="button" onClick={() => setIsProductModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 rounded font-bold text-gray-600 hover:bg-gray-200 transition">{t('admin.cancel')}</button>
                            <button type="submit" disabled={isUploading} className="flex-1 py-2.5 bg-primary text-white rounded font-bold hover:bg-black transition flex items-center justify-center gap-2">
                                {isUploading ? 'Ukládám...' : t('common.save')}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
