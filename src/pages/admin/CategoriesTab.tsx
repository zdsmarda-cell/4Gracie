
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Category } from '../../types';
import { LayoutList, Plus, Edit, Trash2, Check } from 'lucide-react';

export const CategoriesTab: React.FC = () => {
    const { settings, updateSettings, t, products, removeDiacritics } = useStore();
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);

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

    const deleteCategory = (id: string) => {
        if (products.some(p => p.category === id && !p.visibility.online)) { alert('Kategorie obsahuje produkty. Nelze smazat.'); return; }
        if (confirm('Smazat kategorii?')) {
            updateSettings({ ...settings, categories: settings.categories.filter(c => c.id !== id) });
        }
    };

    return (
        <div className="animate-fade-in space-y-4">
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
                                <td className="px-6 py-4 font-bold text-sm">{cat.name}</td>
                                <td className="px-6 py-4 font-mono text-gray-400">{cat.id}</td>
                                <td className="px-6 py-4 text-center">
                                    {cat.enabled ? <span className="text-green-500 font-bold">{t('common.active')}</span> : <span className="text-gray-400">Skryto</span>}
                                </td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                    <button onClick={() => { setEditingCategory(cat); setIsCategoryModalOpen(true); }} className="p-1 hover:text-primary"><Edit size={16}/></button>
                                    <button onClick={() => deleteCategory(cat.id)} className="p-1 hover:text-red-500 text-gray-400"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {sortedCategories.length === 0 && (
                    <div className="p-8 text-center text-gray-400">Žádné kategorie</div>
                )}
            </div>
            {isCategoryModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={saveCategory} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                        <h3 className="font-bold text-lg">{editingCategory?.id ? 'Upravit kategorii' : 'Nová kategorie'}</h3>
                        <div><label className="text-xs font-bold text-gray-400 block mb-1">Název</label><input required className="w-full border rounded p-2" value={editingCategory?.name || ''} onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })} /></div>
                        <div><label className="text-xs font-bold text-gray-400 block mb-1">ID (Slug)</label><input required disabled={!!editingCategory?.id && sortedCategories.some(c => c.id === editingCategory.id)} className="w-full border rounded p-2 bg-gray-50" value={editingCategory?.id || ''} onChange={e => setEditingCategory({ ...editingCategory, id: e.target.value })} /></div>
                        <div><label className="text-xs font-bold text-gray-400 block mb-1">Pořadí</label><input type="number" required className="w-full border rounded p-2" value={editingCategory?.order || ''} onChange={e => setEditingCategory({ ...editingCategory, order: Number(e.target.value) })} /></div>
                        <label className="flex items-center gap-2"><input type="checkbox" checked={editingCategory?.enabled ?? true} onChange={e => setEditingCategory({ ...editingCategory, enabled: e.target.checked })} /><span className="text-sm">Aktivní</span></label>
                        <div className="flex gap-2 pt-4"><button type="button" onClick={() => setIsCategoryModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">{t('admin.cancel')}</button><button type="submit" className="flex-1 py-2 bg-primary text-white rounded">{t('common.save')}</button></div>
                    </form>
                </div>
            )}
        </div>
    );
};
