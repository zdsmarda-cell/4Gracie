
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, Ingredient, ProductIngredient } from '../../types';
import { ALLERGENS } from '../../constants';
import { Plus, Edit, Trash2, Check, X, ImageIcon, Search, AlertCircle, Languages, Wheat } from 'lucide-react';

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
    const { products, addProduct, updateProduct, deleteProduct, settings, t, tData, uploadImage, getImageUrl, ingredients } = useStore();
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
    const [search, setSearch] = useState('');
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [isUploading, setIsUploading] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);

    // CSS class for number inputs to hide spinners
    const noSpinnerClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

    const getCategoryName = (id: string) => settings.categories.find(c => c.id === id)?.name || id;
    const getCapacityName = (id?: string) => settings.capacityCategories?.find(c => c.id === id)?.name || '-';

    const sortedProducts = useMemo(() => {
        let filtered = products;
        if (search) {
            filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
        }
        // Sort by Category order then Name
        return filtered.sort((a, b) => {
            const catA = settings.categories.find(c => c.id === a.category)?.order || 999;
            const catB = settings.categories.find(c => c.id === b.category)?.order || 999;
            if (catA !== catB) return catA - catB;
            return a.name.localeCompare(b.name);
        });
    }, [products, search, settings.categories]);

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
        if (!editingProduct.name) errors.name = 'Vyplňte název.';
        if (editingProduct.price === undefined) errors.price = 'Vyplňte cenu.';
        if (!editingProduct.unit) errors.unit = 'Vyberte jednotku.';
        if (!editingProduct.category) errors.category = 'Vyberte kategorii.';

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

            if (products.some(prod => prod.id === p.id)) {
                await updateProduct(p);
            } else {
                await addProduct(p);
            }
            setIsProductModalOpen(false);
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

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-primary">{t('admin.products')}</h2>
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                        <input 
                            className="pl-9 p-2 border rounded-lg text-sm w-64 focus:ring-accent outline-none" 
                            placeholder="Hledat produkt..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <button onClick={() => { setEditingProduct({ visibility: { online: true, store: true, stand: true }, allergens: [], images: [], composition: [] }); setIsProductModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow-sm hover:bg-black transition"><Plus size={16} className="mr-2"/> {t('admin.add_product')}</button>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
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
                        {sortedProducts.map(p => (
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
                                    {p.isEventProduct && <span className="ml-2 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">AKCE</span>}
                                </td>
                                <td className="px-6 py-4 text-gray-600">{getCategoryName(p.category)}</td>
                                <td className="px-6 py-4 font-mono">{p.price} Kč / {p.unit}</td>
                                <td className="px-6 py-4 text-center">
                                    {p.visibility?.online ? <Check size={16} className="inline text-green-500"/> : <X size={16} className="inline text-gray-300"/>}
                                </td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                    <button onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }} className="p-1 hover:text-primary"><Edit size={16}/></button>
                                    <button onClick={() => setDeleteTarget(p)} className="p-1 hover:text-red-500 text-gray-400"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {sortedProducts.length === 0 && (
                    <div className="p-12 text-center text-gray-400">Žádné produkty k zobrazení</div>
                )}
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
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Název {validationErrors.name && <span className="text-red-500">*</span>}</label>
                                    <input required className={`w-full border rounded p-2 text-sm font-bold ${validationErrors.name ? 'border-red-500 bg-red-50' : ''}`} value={editingProduct?.name || ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, name: e.target.value} : null)} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Popis</label>
                                    <textarea className="w-full border rounded p-2 h-20 text-sm" value={editingProduct?.description || ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, description: e.target.value} : null)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 block mb-1">Cena (Kč) {validationErrors.price && <span className="text-red-500">*</span>}</label>
                                        <input type="number" required className={`w-full border rounded p-2 text-sm font-mono ${validationErrors.price ? 'border-red-500 bg-red-50' : ''}`} value={editingProduct?.price ?? ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, price: Number(e.target.value)} : null)} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 block mb-1">Jednotka</label>
                                        <select className="w-full border rounded p-2 text-sm bg-white" value={editingProduct?.unit} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, unit: e.target.value as any} : null)}>
                                            <option value="ks">ks</option>
                                            <option value="kg">kg</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 block mb-1">Kategorie {validationErrors.category && <span className="text-red-500">*</span>}</label>
                                        <select className={`w-full border rounded p-2 text-sm bg-white ${validationErrors.category ? 'border-red-500' : ''}`} value={editingProduct?.category} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, category: e.target.value, subcategory: undefined} : null)}>
                                            <option value="">-- Vyberte --</option>
                                            {settings.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
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
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">Objednat předem (dny) {validationErrors.leadTimeDays && <span className="text-red-500">*</span>}</label>
                                            <input type="number" className={`w-full border rounded p-2 text-sm ${validationErrors.leadTimeDays ? 'border-red-500 bg-red-50' : ''} ${noSpinnerClass}`} value={editingProduct?.leadTimeDays || ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, leadTimeDays: Number(e.target.value)} : null)} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">Trvanlivost (dny) {validationErrors.shelfLifeDays && <span className="text-red-500">*</span>}</label>
                                            <input type="number" className={`w-full border rounded p-2 text-sm ${validationErrors.shelfLifeDays ? 'border-red-500 bg-red-50' : ''} ${noSpinnerClass}`} value={editingProduct?.shelfLifeDays || ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, shelfLifeDays: Number(e.target.value)} : null)} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">Min. odběr (ks) {validationErrors.minOrderQuantity && <span className="text-red-500">*</span>}</label>
                                            <input type="number" className={`w-full border rounded p-2 text-sm ${validationErrors.minOrderQuantity ? 'border-red-500 bg-red-50' : ''} ${noSpinnerClass}`} value={editingProduct?.minOrderQuantity || ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, minOrderQuantity: Number(e.target.value)} : null)} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 block mb-1">Objem (ml/g) {validationErrors.volume && <span className="text-red-500">*</span>}</label>
                                            <input type="number" className={`w-full border rounded p-2 text-sm ${validationErrors.volume ? 'border-red-500 bg-red-50' : ''} ${noSpinnerClass}`} value={editingProduct?.volume || ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, volume: Number(e.target.value)} : null)} />
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
                                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                                        {ALLERGENS.map(a => (
                                            <label key={a.id} className={`flex flex-col items-center justify-center p-1 border rounded cursor-pointer transition hover:bg-gray-50 min-h-[50px] text-center ${editingProduct?.allergens?.includes(a.id) ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-white border-gray-200'}`}>
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
                                                <span className="font-bold text-sm leading-none">{a.code}</span>
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
