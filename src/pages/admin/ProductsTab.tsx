
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';
import { ALLERGENS } from '../../constants';
import { generateTranslations } from '../../utils/aiTranslator';
import { Plus, Edit, Trash2, ImageIcon, Check, X, Languages, Globe, Upload } from 'lucide-react';

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
                    {/* English Section */}
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

                    {/* German Section */}
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
                                <span className="text-[10px] font-bold text-yellow-500 uppercase block mb-1">Beschreibung</span>
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
    
    // Translation View State
    const [viewingTranslations, setViewingTranslations] = useState<Product | null>(null);

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);
    const getCategoryName = (id: string) => sortedCategories.find(c => c.id === id)?.name || id;

    const handleAddClick = () => {
        // Initialize with sensible defaults to avoid NULL values
        setEditingProduct({
            category: sortedCategories[0]?.id || '', // Default to first category
            unit: 'ks', // Default unit
            visibility: { online: true, store: true, stand: true },
            allergens: [],
            images: [],
            price: 0,
            vatRateInner: 12,
            vatRateTakeaway: 12,
            workload: 0,
            workloadOverhead: 0
        });
        setIsProductModalOpen(true);
    };

    const saveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct) return;
        
        setIsUploading(true); // Start loading state
        
        try {
            const prod = { ...editingProduct } as Product;
            if (!prod.id) prod.id = Date.now().toString();
            
            // 1. Process Images (Upload ONLY new Base64 images)
            if (prod.images && prod.images.length > 0) {
                const processedImages = await Promise.all(prod.images.map(async (img, index) => {
                    // Check if it is a new Base64 image
                    if (img.startsWith('data:')) {
                        try {
                            const fileName = `prod-${prod.id}-${Date.now()}-${index}.jpg`;
                            // Upload to server and get URL
                            return await uploadImage(img, fileName);
                        } catch (err) {
                            console.error("Failed to upload image:", err);
                            return img; // Fallback (though DB might reject large string if column size limited)
                        }
                    }
                    // It's already a URL (existing image), keep as is
                    return img;
                }));
                prod.images = processedImages;
            } else {
                prod.images = [];
            }

            // Safety checks for required fields
            if (!prod.category && sortedCategories.length > 0) prod.category = sortedCategories[0].id;
            if (!prod.unit) prod.unit = 'ks';
            if (!prod.visibility) prod.visibility = { online: true, store: true, stand: true };
            if (!prod.allergens) prod.allergens = [];
            
            prod.vatRateInner = Number(prod.vatRateInner ?? 0);
            prod.vatRateTakeaway = Number(prod.vatRateTakeaway ?? 0);
            prod.workload = Number(prod.workload ?? 0);
            prod.workloadOverhead = Number(prod.workloadOverhead ?? 0);
            prod.volume = Number(prod.volume ?? 0); 
            
            // Generate Translations if enabled
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
            alert("Chyba při ukládání produktu.");
        } finally {
            setIsUploading(false);
            setIsTranslating(false);
        }
    };

    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && editingProduct) {
            // Just read as Base64 for Preview. Upload happens on Save.
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setEditingProduct(prev => ({ ...prev, images: [...(prev?.images || []), base64] }));
            };
            reader.readAsDataURL(file);
        }
    };

    React.useEffect(() => {
        if (confirmDelete && confirmDelete.type === 'product') {
            if (confirm(`Opravdu smazat ${confirmDelete.name}?`)) {
                deleteProduct(confirmDelete.id);
            }
            setConfirmDelete(null);
        }
    }, [confirmDelete]);

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-primary">{t('admin.products')}</h2>
                <button onClick={handleAddClick} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"><Plus size={16} className="mr-2"/> {t('admin.add_product')}</button>
            </div>
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="min-w-full divide-y">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                    <tr>
                    <th className="px-6 py-4 text-left">Foto</th>
                    <th className="px-6 py-4 text-left">Název</th>
                    <th className="px-6 py-4 text-left">Kategorie</th>
                    <th className="px-6 py-4 text-left">Cena</th>
                    <th className="px-6 py-4 text-left">Objem</th>
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
                        <td className="px-6 py-4 font-bold">
                            {p.name}
                            {p.translations && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setViewingTranslations(p); }}
                                    className="flex gap-1 mt-1 cursor-pointer hover:bg-gray-100 p-1 rounded -ml-1 transition items-center w-fit"
                                    title="Zobrazit překlady"
                                >
                                    <Languages size={10} className="text-gray-400" />
                                    <span className="text-[8px] px-1 bg-blue-100 rounded text-blue-700 font-bold">EN</span>
                                    <span className="text-[8px] px-1 bg-yellow-100 rounded text-yellow-700 font-bold">DE</span>
                                </button>
                            )}
                        </td>
                        <td className="px-6 py-4">{getCategoryName(p.category)}</td>
                        <td className="px-6 py-4">{p.price} Kč / {p.unit}</td>
                        <td className="px-6 py-4 font-mono text-gray-500">{p.volume > 0 ? `${p.volume} ml` : '-'}</td>
                        <td className="px-6 py-4 text-center">{p.visibility?.online ? <Check size={16} className="inline text-green-500"/> : <X size={16} className="inline text-gray-300"/>}</td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }} className="p-1 hover:text-primary"><Edit size={16}/></button>
                        <button onClick={() => setConfirmDelete({type: 'product', id: p.id, name: p.name})} className="p-1 hover:text-red-500 text-gray-400"><Trash2 size={16}/></button>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>

            <TranslationViewModal 
                isOpen={!!viewingTranslations} 
                onClose={() => setViewingTranslations(null)} 
                item={viewingTranslations} 
            />

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
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Cena (Kč)</label>
                                    <input type="number" required className="w-full border rounded p-2" value={editingProduct?.price || ''} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">Jednotka</label>
                                    <select 
                                        className="w-full border rounded p-2 bg-white" 
                                        value={editingProduct?.unit || 'ks'} 
                                        onChange={e => setEditingProduct({...editingProduct, unit: e.target.value as 'ks'|'kg'})}
                                    >
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
                                    onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                                >
                                    {sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
                            <h4 className="font-bold text-sm text-gray-500 uppercase">Logistika a Časování</h4>
                            <div className="grid grid-cols-4 gap-4">
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Objednat předem (dny)</label><input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.leadTimeDays || ''} onChange={e => setEditingProduct({...editingProduct, leadTimeDays: Number(e.target.value)})} /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Trvanlivost (dny)</label><input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.shelfLifeDays || ''} onChange={e => setEditingProduct({...editingProduct, shelfLifeDays: Number(e.target.value)})} /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Min. odběr (ks)</label><input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.minOrderQuantity || ''} onChange={e => setEditingProduct({...editingProduct, minOrderQuantity: Number(e.target.value)})} /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Objem (ml)</label><input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.volume || ''} onChange={e => setEditingProduct({...editingProduct, volume: Number(e.target.value)})} placeholder="Nutné pro balné"/></div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
                            <h4 className="font-bold text-sm text-gray-500 uppercase">Ekonomika a Kapacity</h4>
                            <div className="grid grid-cols-4 gap-4">
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Pracnost (body)</label><input type="number" min="0" className="w-full border rounded p-2 text-sm" value={editingProduct?.workload ?? ''} onChange={e => setEditingProduct({...editingProduct, workload: Number(e.target.value)})} /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Kap. přípravy</label><input type="number" min="0" className="w-full border rounded p-2 text-sm" value={editingProduct?.workloadOverhead ?? ''} onChange={e => setEditingProduct({...editingProduct, workloadOverhead: Number(e.target.value)})} /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">DPH Prodejna (%)</label><input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.vatRateInner ?? ''} onChange={e => setEditingProduct({...editingProduct, vatRateInner: Number(e.target.value)})} /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">DPH S sebou (%)</label><input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.vatRateTakeaway ?? ''} onChange={e => setEditingProduct({...editingProduct, vatRateTakeaway: Number(e.target.value)})} /></div>
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
                                        <input type="checkbox" className="sr-only" checked={editingProduct?.allergens?.includes(a.id) ?? false} onChange={e => { const current = editingProduct?.allergens || []; const updated = e.target.checked ? [...current, a.id] : current.filter(id => id !== a.id); setEditingProduct({...editingProduct, allergens: updated}); }} />
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
                                    <span className="text-[10px] mt-1">Nahrát</span>
                                    <input type="file" className="hidden" onChange={handleImageFileChange} disabled={isUploading} />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-4 border-t">
                    <button type="button" onClick={() => setIsProductModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">{t('admin.cancel')}</button>
                    <button type="submit" disabled={isTranslating || isUploading} className="flex-1 py-2 bg-primary text-white rounded flex justify-center items-center">
                        {isUploading ? (
                            <><Upload size={14} className="mr-2 animate-bounce"/> Nahrávám obrázky...</>
                        ) : isTranslating ? (
                            <><Languages size={14} className="mr-2 animate-pulse"/> Překládám...</>
                        ) : (
                            t('common.save')
                        )}
                    </button>
                    </div>
                </form>
                </div>
            )}
        </div>
    );
};
