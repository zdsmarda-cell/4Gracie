
import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { PackagingType } from '../../types';
import { Plus, Edit, Trash2 } from 'lucide-react';

export const PackagingTab: React.FC = () => {
    const { settings, updateSettings, t } = useStore();
    const [isPackagingModalOpen, setIsPackagingModalOpen] = useState(false);
    const [editingPackaging, setEditingPackaging] = useState<Partial<PackagingType> | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{id: string, name: string} | null>(null);

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

    const confirmDelete = () => {
        if(deleteTarget) {
            const newPkg = settings.packaging.types.filter(p => p.id !== deleteTarget.id);
            updateSettings({...settings, packaging: {...settings.packaging, types: newPkg}});
            setDeleteTarget(null);
        }
    };

    return (
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
                    <div><span className="font-bold text-sm block">{p.name}</span><span className="text-xs text-gray-500">{p.volume} ml</span></div>
                    <div className="flex items-center gap-4"><span className="font-bold text-sm">{p.price} Kč</span><button onClick={() => { setEditingPackaging(p); setIsPackagingModalOpen(true); }} className="text-gray-400 hover:text-primary"><Edit size={16}/></button><button onClick={() => setDeleteTarget({id: p.id, name: p.name})} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button></div>
                    </div>
                ))}
                </div>
            </div>
            
            {deleteTarget && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-lg font-bold mb-2">Smazat obal?</h3>
                        <p className="text-sm text-gray-500 mb-4">Opravdu chcete smazat {deleteTarget.name}?</p>
                        <div className="flex gap-2">
                            <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 bg-gray-100 rounded">Zrušit</button>
                            <button onClick={confirmDelete} className="flex-1 py-2 bg-red-600 text-white rounded">Smazat</button>
                        </div>
                    </div>
                </div>
            )}

            {isPackagingModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={savePackaging} className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                        <h3 className="font-bold text-lg">{editingPackaging?.id ? 'Upravit obal' : 'Nový obal'}</h3>
                        <div><label className="text-xs font-bold text-gray-400 block mb-1">Název</label><input required className="w-full border rounded p-2" value={editingPackaging?.name || ''} onChange={e => setEditingPackaging({...editingPackaging, name: e.target.value})} /></div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-xs font-bold text-gray-400 block mb-1">Objem (ml)</label><input type="number" required className="w-full border rounded p-2" value={editingPackaging?.volume || ''} onChange={e => setEditingPackaging({...editingPackaging, volume: Number(e.target.value)})} /></div>
                            <div><label className="text-xs font-bold text-gray-400 block mb-1">Cena (Kč)</label><input type="number" required className="w-full border rounded p-2" value={editingPackaging?.price || ''} onChange={e => setEditingPackaging({...editingPackaging, price: Number(e.target.value)})} /></div>
                        </div>
                        <div className="flex gap-2 pt-4"><button type="button" onClick={() => setIsPackagingModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">Zrušit</button><button type="submit" className="flex-1 py-2 bg-primary text-white rounded">Uložit</button></div>
                    </form>
                </div>
            )}
        </div>
    );
};
