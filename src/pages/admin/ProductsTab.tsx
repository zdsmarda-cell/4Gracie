
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';
import { ALLERGENS } from '../../constants';
import { generateTranslations } from '../../utils/aiTranslator';
import { Plus, Edit, Trash2, ImageIcon, Check, X, Languages } from 'lucide-react';

export const ProductsTab: React.FC = () => {
    const { products, t, addProduct, updateProduct, deleteProduct, settings } = useStore();
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{type: string, id: string, name?: string} | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);
    const getCategoryName = (id: string) => sortedCategories.find(c => c.id === id)?.name || id;

    const saveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct) return;
        setIsTranslating(true);
        const prod = { ...editingProduct } as Product;
        if (!prod.id) prod.id = Date.now().toString();
        
        if (!prod.images) prod.images = [];
        if (!prod.visibility) prod.visibility = { online: true, store: true, stand: true };
        if (!prod.allergens) prod.allergens = [];
        
        prod.vatRateInner = Number(prod.vatRateInner ?? 0);
        prod.vatRateTakeaway = Number(prod.vatRateTakeaway ?? 0);
        prod.workload = Number(prod.workload ?? 0);
        prod.workloadOverhead = Number(prod.workloadOverhead ?? 0);
        
        // Generate Translations
        const translations = await generateTranslations({ 
            name: prod.name, 
            description: prod.description 
        });
        prod.translations = translations;

        if (products.some(p => p.id === prod.id)) await updateProduct(prod);
        else await addProduct(prod);
        setIsTranslating(false);
        setIsProductModalOpen(false);
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
                        <td className="px-6 py-4 font-bold">
                            {p.name}
                            {p.translations && (
                                <div className="flex gap-1 mt-1">
                                    <span className="text-[8px] px-1 bg-blue-100 rounded text-blue-700">EN</span>
                                    <span className="text-[8px] px-1 bg-yellow-100 rounded text-yellow-700">DE</span>
                                </div>
                            )}
                        </td>
                        <td className="px-6 py-4">{getCategoryName(p.category)}</td>
                        <td className="px-6 py-4">{p.price} Kč / {p.unit}</td>
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
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Objednat předem (dny)</label><input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.leadTimeDays || ''} onChange={e => setEditingProduct({...editingProduct, leadTimeDays: Number(e.target.value)})} /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Trvanlivost (dny)</label><input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.shelfLifeDays || ''} onChange={e => setEditingProduct({...editingProduct, shelfLifeDays: Number(e.target.value)})} /></div>
                                <div><label className="text-[10px] font-bold text-gray-400 block mb-1">Min. odběr (ks)</label><input type="number" className="w-full border rounded p-2 text-sm" value={editingProduct?.minOrderQuantity || ''} onChange={e => setEditingProduct({...editingProduct, minOrderQuantity: Number(e.target.value)})} /></div>
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
                                        <img src={img} className="w-full h-full object-cover" />
                                        <button type="button" onClick={() => setEditingProduct({...editingProduct, images: editingProduct.images?.filter((_, i) => i !== idx)})} className="absolute top-0 right-0 bg-red-500 text-white p-1 opacity-0 group-hover:opacity-100 transition"><X size={12}/></button>
                                    </div>
                                ))}
                                <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition">
                                    <Plus size={24} />
                                    <input type="file" className="hidden" onChange={handleImageFileChange} />
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-4 border-t">
                    <button type="button" onClick={() => setIsProductModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">{t('admin.cancel')}</button>
                    <button type="submit" disabled={isTranslating} className="flex-1 py-2 bg-primary text-white rounded flex justify-center items-center">
                        {isTranslating ? <><Languages size={14} className="mr-2 animate-pulse"/> Překládám...</> : t('common.save')}
                    </button>
                    </div>
                </form>
                </div>
            )}
        </div>
    );
};
