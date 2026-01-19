
import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Ingredient, Product } from '../../types';
import { Plus, Edit, Trash2, Check, X, ImageIcon, AlertTriangle, Wheat, Eye, Search } from 'lucide-react';

const UsageModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    ingredient: Ingredient;
    products: Product[];
    getImageUrl: (path?: string) => string;
}> = ({ isOpen, onClose, ingredient, products, getImageUrl }) => {
    if (!isOpen) return null;

    const usedIn = products
        .filter(p => p.composition?.some(c => c.ingredientId === ingredient.id))
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 border-b pb-4">
                    <h3 className="font-bold text-lg flex items-center">
                        <Wheat className="mr-2 text-accent"/> {ingredient.name}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
                </div>
                
                <div className="flex-grow overflow-y-auto space-y-2">
                    {usedIn.length > 0 ? (
                        usedIn.map(p => {
                            const comp = p.composition?.find(c => c.ingredientId === ingredient.id);
                            return (
                                <div key={p.id} className="flex items-center gap-4 p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-100">
                                    <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                                        {p.images && p.images[0] ? (
                                            <img src={getImageUrl(p.images[0])} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={16}/></div>
                                        )}
                                    </div>
                                    <div className="flex-grow">
                                        <div className="font-bold text-sm">{p.name}</div>
                                    </div>
                                    <div className="font-mono font-bold text-sm text-primary">
                                        {comp?.quantity} {ingredient.unit}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-center text-gray-400 py-8">Tato surovina není použita v žádném produktu.</p>
                    )}
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
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <Trash2 size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-sm text-gray-500 mb-6">Tato akce je nevratná.</p>
                    <div className="flex gap-3 w-full">
                        <button onClick={onClose} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200 transition">Zrušit</button>
                        <button onClick={onConfirm} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition">Smazat</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const IngredientsTab: React.FC = () => {
    const { ingredients, addIngredient, updateIngredient, deleteIngredient, t, uploadImage, getImageUrl, products } = useStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIngredient, setEditingIngredient] = useState<Partial<Ingredient> | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null);
    const [usageTarget, setUsageTarget] = useState<Ingredient | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const getUsageCount = (ingId: string) => {
        return products.filter(p => p.composition?.some(ci => ci.ingredientId === ingId)).length;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaveError(null);
        if (!editingIngredient) return;

        if (!editingIngredient.name || editingIngredient.name.trim().length === 0) {
            setSaveError('Vyplňte název.');
            return;
        }
        if (!editingIngredient.unit) {
            setSaveError('Vyplňte jednotku.');
            return;
        }

        setIsUploading(true);
        try {
            const ing = { ...editingIngredient } as Ingredient;
            if (!ing.id) ing.id = `ing-${Date.now()}`;
            
            // Image Upload & Conversion (handled by backend)
            if (ing.imageUrl && ing.imageUrl.startsWith('data:')) {
                const fileName = `ing-${ing.id}-${Date.now()}.jpg`; // Ext doesn't strictly matter, backend converts
                ing.imageUrl = await uploadImage(ing.imageUrl, fileName);
            }

            if (ingredients.some(i => i.id === ing.id)) {
                await updateIngredient(ing);
            } else {
                await addIngredient(ing);
            }
            setIsModalOpen(false);
        } catch (e) {
            setSaveError('Chyba při ukládání.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && editingIngredient) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditingIngredient({ ...editingIngredient, imageUrl: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const confirmDelete = async () => {
        if (deleteTarget) {
            await deleteIngredient(deleteTarget.id);
            setDeleteTarget(null);
        }
    };
    
    const requestDelete = (ing: Ingredient) => {
        const usage = getUsageCount(ing.id);
        if (usage > 0) {
            alert(`Tuto surovinu nelze smazat, protože je použita v ${usage} produktech.`);
            return;
        }
        setDeleteTarget(ing);
    };

    const filteredIngredients = ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-primary flex items-center">
                    <Wheat className="mr-2 text-accent" /> Katalog surovin
                </h2>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-2.5 text-gray-400"/>
                        <input 
                            className="pl-9 p-2 border rounded-lg text-sm w-48 focus:ring-accent outline-none" 
                            placeholder="Hledat..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <button onClick={() => { setEditingIngredient({ isHidden: false, unit: 'g' }); setIsModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center">
                        <Plus size={16} className="mr-2"/> Nová surovina
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="min-w-full divide-y">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                        <tr>
                            <th className="px-6 py-4 text-left w-20">Foto</th>
                            <th className="px-6 py-4 text-left">Název</th>
                            <th className="px-6 py-4 text-left">Jednotka</th>
                            <th className="px-6 py-4 text-center">Použito v produktech</th>
                            <th className="px-6 py-4 text-center">Status</th>
                            <th className="px-6 py-4 text-right">Akce</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                        {filteredIngredients.map(ing => {
                            const usage = getUsageCount(ing.id);
                            return (
                                <tr key={ing.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        {ing.imageUrl ? (
                                            <img src={getImageUrl(ing.imageUrl, 'small')} className="w-10 h-10 object-cover rounded" loading="lazy" />
                                        ) : (
                                            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-300">
                                                <ImageIcon size={16}/>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-bold">{ing.name}</td>
                                    <td className="px-6 py-4 font-mono text-gray-500">{ing.unit}</td>
                                    <td className="px-6 py-4 text-center">
                                        <button 
                                            onClick={() => setUsageTarget(ing)}
                                            className={`px-3 py-1 rounded font-bold transition ${usage > 0 ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-gray-100 text-gray-400 cursor-default'}`}
                                            disabled={usage === 0}
                                        >
                                            {usage}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {!ing.isHidden ? <span className="text-green-500 font-bold">Aktivní</span> : <span className="text-gray-400">Skryto</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button onClick={() => { setEditingIngredient(ing); setIsModalOpen(true); }} className="p-1 hover:text-primary"><Edit size={16}/></button>
                                        <button 
                                            onClick={() => requestDelete(ing)} 
                                            className={`p-1 ${usage > 0 ? 'text-gray-300 cursor-not-allowed' : 'hover:text-red-500 text-gray-400'}`}
                                            title={usage > 0 ? 'Nelze smazat (používáno)' : 'Smazat'}
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {ingredients.length === 0 && (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-400">Žádné suroviny v katalogu.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <DeleteConfirmModal isOpen={!!deleteTarget} title={`Smazat ${deleteTarget?.name}?`} onConfirm={confirmDelete} onClose={() => setDeleteTarget(null)} />
            
            {usageTarget && (
                <UsageModal 
                    isOpen={!!usageTarget} 
                    onClose={() => setUsageTarget(null)} 
                    ingredient={usageTarget} 
                    products={products}
                    getImageUrl={getImageUrl}
                />
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={handleSave} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                        <h3 className="font-bold text-lg">{editingIngredient?.id ? 'Upravit surovinu' : 'Nová surovina'}</h3>
                        
                        {saveError && (
                            <div className="bg-red-50 text-red-600 p-3 rounded text-xs font-bold flex items-center">
                                <AlertTriangle size={16} className="mr-2"/> {saveError}
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">Název</label>
                            <input className="w-full border rounded p-2 text-sm" value={editingIngredient?.name || ''} onChange={e => setEditingIngredient({ ...editingIngredient, name: e.target.value })} autoFocus />
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">Jednotka</label>
                            <select 
                                className="w-full border rounded p-2 text-sm bg-white" 
                                value={editingIngredient?.unit || 'g'} 
                                onChange={e => setEditingIngredient({ ...editingIngredient, unit: e.target.value })}
                            >
                                <option value="ks">ks (Kus)</option>
                                <option value="g">g (Gram)</option>
                                <option value="ml">ml (Mililitr)</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-2">Obrázek (volitelné)</label>
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 border rounded bg-gray-50 flex items-center justify-center overflow-hidden">
                                    {editingIngredient?.imageUrl ? (
                                        <img src={getImageUrl(editingIngredient.imageUrl)} className="w-full h-full object-cover" />
                                    ) : (
                                        <ImageIcon size={24} className="text-gray-300"/>
                                    )}
                                </div>
                                <label className="cursor-pointer bg-white border px-3 py-1.5 rounded text-xs font-bold hover:bg-gray-50">
                                    Nahrát
                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                </label>
                                {editingIngredient?.imageUrl && (
                                    <button type="button" onClick={() => setEditingIngredient({...editingIngredient, imageUrl: undefined})} className="text-red-500 text-xs font-bold hover:underline">Odstranit</button>
                                )}
                            </div>
                        </div>

                        <label className="flex items-center gap-2 pt-2">
                            <input type="checkbox" checked={!editingIngredient?.isHidden} onChange={e => setEditingIngredient({ ...editingIngredient, isHidden: !e.target.checked })} />
                            <span className="text-sm">Aktivní (Viditelné při výběru)</span>
                        </label>

                        <div className="flex gap-2 pt-4 border-t mt-2">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded font-bold text-sm text-gray-600">Zrušit</button>
                            <button type="submit" disabled={isUploading} className="flex-1 py-2 bg-primary text-white rounded font-bold text-sm">
                                {isUploading ? 'Ukládám...' : 'Uložit'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
