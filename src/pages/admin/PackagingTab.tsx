
import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { PackagingType } from '../../types';
import { generateTranslations } from '../../utils/aiTranslator';
import { Plus, Edit, Trash2, Languages, Globe, X } from 'lucide-react';

const TranslationViewModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    item: PackagingType | null;
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

export const PackagingTab: React.FC = () => {
    const { settings, updateSettings, t, tData } = useStore();
    const [isPackagingModalOpen, setIsPackagingModalOpen] = useState(false);
    const [editingPackaging, setEditingPackaging] = useState<Partial<PackagingType> | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{id: string, name: string} | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    
    // Local state for free limit to prevent immediate DB write
    const [localFreeLimit, setLocalFreeLimit] = useState(settings.packaging.freeFrom);

    useEffect(() => {
        setLocalFreeLimit(settings.packaging.freeFrom);
    }, [settings.packaging.freeFrom]);
    
    const [viewingTranslations, setViewingTranslations] = useState<PackagingType | null>(null);

    const savePackaging = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPackaging) return;
        
        if (settings.enableAiTranslation) {
            setIsTranslating(true);
        }
        
        let updatedTypes = [...settings.packaging.types];
        const pkg = { ...editingPackaging } as PackagingType;
        
        // Generate Translations if enabled
        if (settings.enableAiTranslation) {
            const translations = await generateTranslations({ 
                name: pkg.name
            });
            pkg.translations = translations;
        }

        if (updatedTypes.some(p => p.id === pkg.id)) {
            updatedTypes = updatedTypes.map(p => p.id === pkg.id ? pkg : p);
        } else {
            updatedTypes.push({ ...pkg, id: 'pkg-' + Date.now() });
        }
        await updateSettings({ ...settings, packaging: { ...settings.packaging, types: updatedTypes } });
        setIsTranslating(false);
        setIsPackagingModalOpen(false);
    };

    const confirmDelete = () => {
        if(deleteTarget) {
            const newPkg = settings.packaging.types.filter(p => p.id !== deleteTarget.id);
            updateSettings({...settings, packaging: {...settings.packaging, types: newPkg}});
            setDeleteTarget(null);
        }
    };

    const saveLimit = () => {
        updateSettings({
            ...settings, 
            packaging: {
                ...settings.packaging, 
                freeFrom: Number(localFreeLimit)
            }
        });
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h3 className="font-bold mb-4">{t('admin.settings')}</h3>
                <div className="flex items-center gap-4">
                <label className="text-sm text-gray-600">{t('admin.pkg_limit')} (Kč):</label>
                <input 
                    type="number" 
                    className="border rounded p-2 w-32" 
                    value={localFreeLimit} 
                    onChange={e => setLocalFreeLimit(Number(e.target.value))} 
                />
                <button onClick={saveLimit} className="text-xs bg-primary text-white px-3 py-2 rounded font-bold">Uložit limit</button>
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
                    <div>
                        <span className="font-bold text-sm block">
                            {tData(p, 'name')} 
                            <span className="text-xs text-gray-400 font-normal ml-2">({p.name})</span>
                        </span>
                        <div className="flex gap-2 items-center">
                            <span className="text-xs text-gray-500">{p.volume} ml</span>
                            {p.translations && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setViewingTranslations(p); }}
                                    className="flex gap-1 cursor-pointer hover:bg-gray-100 p-1 rounded transition items-center"
                                    title="Zobrazit překlady"
                                >
                                    <Languages size={10} className="text-gray-400" />
                                    <span className="text-[8px] px-1 bg-blue-100 rounded text-blue-700 font-bold">EN</span>
                                    <span className="text-[8px] px-1 bg-yellow-100 rounded text-yellow-700 font-bold">DE</span>
                                </button>
                            )}
                        </div>
                    </div>
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

            <TranslationViewModal isOpen={!!viewingTranslations} onClose={() => setViewingTranslations(null)} item={viewingTranslations} />

            {isPackagingModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={savePackaging} className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                        <h3 className="font-bold text-lg">{editingPackaging?.id ? 'Upravit obal' : 'Nový obal'}</h3>
                        <div><label className="text-xs font-bold text-gray-400 block mb-1">Název</label><input required className="w-full border rounded p-2" value={editingPackaging?.name || ''} onChange={e => setEditingPackaging({...editingPackaging, name: e.target.value})} /></div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-xs font-bold text-gray-400 block mb-1">Objem (ml)</label><input type="number" required className="w-full border rounded p-2" value={editingPackaging?.volume || ''} onChange={e => setEditingPackaging({...editingPackaging, volume: Number(e.target.value)})} /></div>
                            <div><label className="text-xs font-bold text-gray-400 block mb-1">Cena (Kč)</label><input type="number" required className="w-full border rounded p-2" value={editingPackaging?.price || ''} onChange={e => setEditingPackaging({...editingPackaging, price: Number(e.target.value)})} /></div>
                        </div>
                        <div className="flex gap-2 pt-4">
                            <button type="button" onClick={() => setIsPackagingModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">Zrušit</button>
                            <button type="submit" disabled={isTranslating} className="flex-1 py-2 bg-primary text-white rounded flex justify-center items-center">
                                {isTranslating ? <><Languages size={14} className="mr-2 animate-pulse"/> Překládám...</> : 'Uložit'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
