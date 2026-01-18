
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';
import { ALLERGENS } from '../../constants';
import { generateTranslations } from '../../utils/aiTranslator';
import { Plus, Edit, Trash2, Check, X, ImageIcon, Languages, AlertTriangle } from 'lucide-react';

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
    const { products, addProduct, updateProduct, deleteProduct, settings, t, uploadImage, getImageUrl } = useStore();
    
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{id: string, name: string} | null>(null);
    
    const [isUploading, setIsUploading] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    // Helper class to hide spinners
    const noSpinnerClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);
    const capCategories = useMemo(() => settings.capacityCategories || [], [settings.capacityCategories]);

    const getCategoryName = (id: string) => sortedCategories.find(c => c.id === id)?.name || id;

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

    const saveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaveError(null);
        setValidationErrors({});
        
        if (!editingProduct) return;
        
        const prod = { ...editingProduct } as Product;
        const errors: Record<string, string> = {};

        // --- VALIDACE POLÍ ---
        if (!prod.name || prod.name.trim().length === 0) {
            errors.name = 'Vyplňte název produktu.';
        }
        if (!prod.description || prod.description.trim().length === 0) {
            errors.description = 'Vyplňte popis produktu.';
        }
        
        const validateNum = (val: number | undefined, key: string, label: string) => {
             if (val === undefined || val === null || isNaN(Number(val)) || String(val).trim() === '') {
                 errors[key] = `Vyplňte ${label}.`;
             } else if (Number(val) < 0) {
                 errors[key] = `Hodnota musí být 0 nebo větší.`;
             }
        };

        validateNum(prod.price, 'price', 'cenu');
        validateNum(prod.leadTimeDays, 'leadTimeDays', 'lhůtu objednání');
        validateNum(prod.shelfLifeDays, 'shelfLifeDays', 'trvanlivost');
        validateNum(prod.minOrderQuantity, 'minOrderQuantity', 'min. odběr');
        validateNum(prod.volume, 'volume', 'objem');
        validateNum(prod.workload, 'workload', 'pracnost');
        validateNum(prod.workloadOverhead, 'workloadOverhead', 'režii');
        validateNum(prod.vatRateInner, 'vatRateInner', 'DPH prodejna');
        validateNum(prod.vatRateTakeaway, 'vatRateTakeaway', 'DPH s sebou');

        // --- VALIDACE PODKATEGORIE ---
        const catDef = sortedCategories.find(c => c.id === prod.category);
        const subCats = catDef?.subcategories || [];
        
        if (subCats.length > 0) {
            // Normalize IDs for check
            const validIds = subCats.map(s => typeof s === 'string' ? s : s.id);
            if (!prod.subcategory || !validIds.includes(prod.subcategory)) {
                errors.subcategory = `Pro kategorii "${catDef?.name}" je nutné vybrat podkategorii.`;
            }
        } else {
            // Clear subcategory if main category has none
            prod.subcategory = undefined;
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            setSaveError('Zkontrolujte červeně zvýrazněná povinná pole.');
            return;
        }

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
            
            // Ensure numbers
            prod.price = Number(prod.price);
            prod.vatRateInner = Number(prod.vatRateInner);
            prod.vatRateTakeaway = Number(prod.vatRateTakeaway);
            prod.workload = Number(prod.workload);
            prod.workloadOverhead = Number(prod.workloadOverhead);
            prod.volume = Number(prod.volume);
            prod.minOrderQuantity = Number(prod.minOrderQuantity);
            prod.leadTimeDays = Number(prod.leadTimeDays);
            prod.shelfLifeDays = Number(prod.shelfLifeDays);
            
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

    return (
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
                        {p.images?.[0] ? <img src={getImageUrl(p.images[0])} className="w-10 h-10 object-cover rounded" /> : <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center"><ImageIcon size={16} className="text-gray-400"/></div>}
                        </td>
                        <td className="px-6 py-4 font-bold">{p.name}</td>
                        <td className="px-6 py-4">{getCategoryName(p.category)}</td>
                        <td className="px-6 py-4">{p.price} Kč / {p.unit}</td>
                        <td className="px-6 py-4 text-center">{p.visibility?.online ? <Check size={16} className="inline text-green-500"/> : <X size={16} className="inline text-gray-300"/>}</td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }} className="p-1 hover:text-primary"><Edit size={16}/></button>
                        <button onClick={() => setDeleteTarget({id: p.id, name: p.name})} className="p-1 hover:text-red-500 text-gray-400"><Trash2 size={16}/></button>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>

            <DeleteConfirmModal 
                isOpen={!!deleteTarget} 
                title={`Smazat ${deleteTarget?.name}?`} 
                onConfirm={confirmDelete} 
                onClose={() => setDeleteTarget(null)} 
            />

            {isProductModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                <form onSubmit={saveProduct} className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
                    <h3 className="font-bold text-lg">{editingProduct?.id ? t('admin.edit_product') : t('admin.add_product')}</h3>
                    
                    {saveError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold flex items-center">
                            <AlertTriangle size={16} className="mr-2 flex-shrink-0"/>
                            {saveError}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-400 block mb-1">Název produktu {validationErrors.name && <span className="text-red-500">*</span>}</label>
                                <input className={`w-full border rounded p-2 ${validationErrors.name ? 'border-red-500 bg-red-50' : ''}`} value={editingProduct?.name || ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, name: e.target.value} : null)} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-400 block mb-1">Popis {validationErrors.description && <span className="text-red-500">*</span>}</label>
                                <textarea className={`w-full border rounded p-2 h-20 ${validationErrors.description ? 'border-red-500 bg-red-50' : ''}`} value={editingProduct?.description || ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, description: e.target.value} : null)} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Cena (Kč) {validationErrors.price && <span className="text-red-500">*</span>}</label>
                                <input type="number" className={`w-full border rounded p-2 ${validationErrors.price ? 'border-red-500 bg-red-50' : ''} ${noSpinnerClass}`} value={editingProduct?.price || ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, price: Number(e.target.value)} : null)} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Kategorie</label>
                                <select className="w-full border rounded p-2" value={editingProduct?.category} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, category: e.target.value, subcategory: undefined} : null)}>
                                    {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            
                            {/* Subcategory Selector */}
                            {sortedCategories.find(c => c.id === editingProduct?.category)?.subcategories && (sortedCategories.find(c => c.id === editingProduct?.category)?.subcategories?.length ?? 0) > 0 && (
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Podkategorie {validationErrors.subcategory && <span className="text-red-500">*</span>}</label>
                                    <select 
                                        className={`w-full border rounded p-2 ${validationErrors.subcategory ? 'border-red-500 bg-red-50' : ''}`} 
                                        value={editingProduct?.subcategory || ''} 
                                        onChange={e => setEditingProduct(editingProduct ? {...editingProduct, subcategory: e.target.value} : null)}
                                    >
                                        <option value="">-- Vyberte podkategorii --</option>
                                        {sortedCategories.find(c => c.id === editingProduct?.category)?.subcategories?.map((s: any) => {
                                            // Handle both object and string (legacy)
                                            const subId = typeof s === 'string' ? s : s.id;
                                            const subName = typeof s === 'string' ? s : s.name;
                                            return <option key={subId} value={subId}>{subName}</option>;
                                        })}
                                    </select>
                                </div>
                            )}
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
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
                            <h4 className="font-bold text-sm text-gray-500 uppercase">Ekonomika a Kapacity</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 block mb-1">Pracnost (body) {validationErrors.workload && <span className="text-red-500">*</span>}</label>
                                    <input type="number" min="0" className={`w-full border rounded p-2 text-sm ${validationErrors.workload ? 'border-red-500 bg-red-50' : ''} ${noSpinnerClass}`} value={editingProduct?.workload ?? ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, workload: Number(e.target.value)} : null)} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 block mb-1">Režie přípravy {validationErrors.workloadOverhead && <span className="text-red-500">*</span>}</label>
                                    <input type="number" min="0" className={`w-full border rounded p-2 text-sm ${validationErrors.workloadOverhead ? 'border-red-500 bg-red-50' : ''} ${noSpinnerClass}`} value={editingProduct?.workloadOverhead ?? ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, workloadOverhead: Number(e.target.value)} : null)} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 block mb-1">DPH Prodejna (%) {validationErrors.vatRateInner && <span className="text-red-500">*</span>}</label>
                                    <input type="number" className={`w-full border rounded p-2 text-sm ${validationErrors.vatRateInner ? 'border-red-500 bg-red-50' : ''} ${noSpinnerClass}`} value={editingProduct?.vatRateInner ?? ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, vatRateInner: Number(e.target.value)} : null)} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 block mb-1">DPH S sebou (%) {validationErrors.vatRateTakeaway && <span className="text-red-500">*</span>}</label>
                                    <input type="number" className={`w-full border rounded p-2 text-sm ${validationErrors.vatRateTakeaway ? 'border-red-500 bg-red-50' : ''} ${noSpinnerClass}`} value={editingProduct?.vatRateTakeaway ?? ''} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, vatRateTakeaway: Number(e.target.value)} : null)} />
                                </div>
                            </div>
                            
                            {/* Capacity Category Selector */}
                            <div className="pt-2 border-t border-gray-200 mt-2">
                                <label className="text-[10px] font-bold text-gray-400 block mb-1">Kapacitní skupina (volitelné)</label>
                                <select 
                                    className="w-full border rounded p-2 text-sm bg-white"
                                    value={editingProduct?.capacityCategoryId || ''}
                                    onChange={e => setEditingProduct(editingProduct ? {...editingProduct, capacityCategoryId: e.target.value || undefined} : null)}
                                >
                                    <option value="">-- Žádná (Samostatný produkt) --</option>
                                    {capCategories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <p className="text-[9px] text-gray-400 mt-1">Přiřazení do skupiny způsobí, že "Režie přípravy" se počítá pouze jednou pro celou skupinu v rámci dne.</p>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-2">Viditelnost</label>
                            <div className="flex gap-4">
                                <label className="flex items-center space-x-2 text-sm">
                                    <input type="checkbox" checked={editingProduct?.visibility?.online ?? true} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, visibility: { ...editingProduct?.visibility || { online: true, store: true, stand: true }, online: e.target.checked }} : null)} />
                                    <span>E-shop (Online)</span>
                                </label>
                                <label className="flex items-center space-x-2 text-sm">
                                    <input type="checkbox" checked={editingProduct?.visibility?.store ?? true} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, visibility: { ...editingProduct?.visibility || { online: true, store: true, stand: true }, store: e.target.checked }} : null)} />
                                    <span>Prodejna (Kasa)</span>
                                </label>
                                <label className="flex items-center space-x-2 text-sm">
                                    <input type="checkbox" checked={editingProduct?.visibility?.stand ?? true} onChange={e => setEditingProduct(editingProduct ? {...editingProduct, visibility: { ...editingProduct?.visibility || { online: true, store: true, stand: true }, stand: e.target.checked }} : null)} />
                                    <span>Stánek</span>
                                </label>
                            </div>
                        </div>
                        
                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                            <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={editingProduct?.isEventProduct ?? false} 
                                    onChange={e => setEditingProduct(editingProduct ? {...editingProduct, isEventProduct: e.target.checked} : null)}
                                    className="text-purple-600 focus:ring-purple-500 rounded"
                                />
                                <span className="font-bold text-purple-900">Event produkt (Akční nabídka)</span>
                            </label>
                            <p className="text-xs text-purple-700 mt-1 ml-6">
                                Produkt bude dostupný pouze ve dnech definovaných v záložce "Akce".
                            </p>
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

                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-2">Obrázky</label>
                            <div className="flex flex-wrap gap-2">
                                {editingProduct?.images?.map((img, idx) => (
                                    <div key={idx} className="relative w-20 h-20 group rounded-lg overflow-hidden border">
                                        <img src={getImageUrl(img)} className="w-full h-full object-cover" />
                                        <button type="button" onClick={() => setEditingProduct(editingProduct ? {...editingProduct, images: editingProduct.images?.filter((_, i) => i !== idx)} : null)} className="absolute top-0 right-0 bg-red-500 text-white p-1 opacity-0 group-hover:opacity-100 transition"><X size={12}/></button>
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
                        <button type="submit" disabled={isUploading || isTranslating} className="flex-1 py-2 bg-primary text-white rounded flex justify-center items-center gap-2">
                            {isUploading ? 'Nahrávám...' : isTranslating ? 'Překládám...' : t('common.save')}
                        </button>
                    </div>
                </form>
                </div>
            )}
        </div>
    );
};
