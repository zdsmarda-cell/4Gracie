
import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { DeliveryRegion, RegionException } from '../../types';
import { Plus, Edit, Trash2, X, Truck } from 'lucide-react';

const DeleteConfirmModal: React.FC<{
    isOpen: boolean;
    title: string;
    onConfirm: () => void;
    onClose: () => void;
}> = ({ isOpen, title, onConfirm, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
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

const RegionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    region: Partial<DeliveryRegion>;
    onSave: (r: DeliveryRegion) => void;
}> = ({ isOpen, onClose, region, onSave }) => {
    const [formData, setFormData] = useState<Partial<DeliveryRegion>>(region);
    const [newZip, setNewZip] = useState('');
    const [newException, setNewException] = useState<Partial<RegionException>>({ date: '', isOpen: false });

    React.useEffect(() => { setFormData(region); }, [region]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData as DeliveryRegion);
    };

    const addZip = () => {
        if (newZip && !formData.zips?.includes(newZip)) {
            setFormData({ ...formData, zips: [...(formData.zips || []), newZip] });
            setNewZip('');
        }
    };

    const removeZip = (z: string) => {
        setFormData({ ...formData, zips: formData.zips?.filter(zip => zip !== z) });
    };
    
    const addException = () => {
        if(newException.date) {
            setFormData({ ...formData, exceptions: [...(formData.exceptions || []), newException as RegionException] });
            setNewException({ date: '', isOpen: false });
        }
    };

    const removeException = (date: string) => {
        setFormData({ ...formData, exceptions: formData.exceptions?.filter(e => e.date !== date) });
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
             <form onSubmit={handleSubmit} className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
                 <h3 className="font-bold text-lg">{formData.id ? 'Upravit region' : 'Nový region'}</h3>
                 <div className="space-y-3">
                    <input className="w-full border rounded p-2" placeholder="Název" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required />
                    <div className="grid grid-cols-2 gap-2">
                        <input type="number" className="border rounded p-2" placeholder="Cena dopravy" value={formData.price || ''} onChange={e => setFormData({...formData, price: Number(e.target.value)})} required />
                        <input type="number" className="border rounded p-2" placeholder="Zdarma od" value={formData.freeFrom || ''} onChange={e => setFormData({...formData, freeFrom: Number(e.target.value)})} required />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                         <input type="time" className="border rounded p-2" value={formData.deliveryTimeStart || ''} onChange={e => setFormData({...formData, deliveryTimeStart: e.target.value})} />
                         <input type="time" className="border rounded p-2" value={formData.deliveryTimeEnd || ''} onChange={e => setFormData({...formData, deliveryTimeEnd: e.target.value})} />
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded">
                        <label className="text-xs font-bold block mb-1">PSČ</label>
                        <div className="flex gap-2 mb-2">
                            <input className="border rounded p-1 flex-1" value={newZip} onChange={e => setNewZip(e.target.value)} placeholder="PSČ" />
                            <button type="button" onClick={addZip} className="bg-gray-200 px-3 rounded">+</button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {formData.zips?.map(z => (
                                <span key={z} className="bg-white border px-2 py-1 rounded text-xs flex items-center gap-1">{z} <button type="button" onClick={() => removeZip(z)}><X size={10}/></button></span>
                            ))}
                        </div>
                    </div>

                     <div className="bg-gray-50 p-3 rounded">
                        <label className="text-xs font-bold block mb-1">Výjimky</label>
                        <div className="flex gap-2 mb-2 items-end">
                             <input type="date" className="border rounded p-1" value={newException.date} onChange={e => setNewException({...newException, date: e.target.value})} />
                             <label className="text-xs flex items-center"><input type="checkbox" checked={newException.isOpen} onChange={e => setNewException({...newException, isOpen: e.target.checked})} /> Otevřeno</label>
                             <button type="button" onClick={addException} className="bg-gray-200 px-3 rounded">+</button>
                        </div>
                        {newException.isOpen && (
                             <div className="flex gap-2 mb-2">
                                 <input type="time" className="border rounded p-1 w-20" value={newException.deliveryTimeStart || ''} onChange={e => setNewException({...newException, deliveryTimeStart: e.target.value})} />
                                 <input type="time" className="border rounded p-1 w-20" value={newException.deliveryTimeEnd || ''} onChange={e => setNewException({...newException, deliveryTimeEnd: e.target.value})} />
                             </div>
                        )}
                        <div className="space-y-1">
                            {formData.exceptions?.map(ex => (
                                <div key={ex.date} className="flex justify-between text-xs border-b">
                                    <span>{ex.date}: {ex.isOpen ? 'JINÝ ČAS' : 'ZAVŘENO'}</span>
                                    <button type="button" onClick={() => removeException(ex.date)}><X size={10}/></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={formData.enabled ?? true} onChange={e => setFormData({...formData, enabled: e.target.checked})} />
                        <span className="text-sm">Aktivní</span>
                    </label>
                 </div>
                 <div className="flex gap-2 pt-4">
                      <button type="button" onClick={onClose} className="flex-1 py-2 bg-gray-100 rounded">Zrušit</button>
                      <button type="submit" className="flex-1 py-2 bg-primary text-white rounded">Uložit</button>
                 </div>
             </form>
        </div>
    );
};

export const DeliveryTab: React.FC = () => {
    const { settings, updateSettings, t } = useStore();
    const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
    const [editingRegion, setEditingRegion] = useState<Partial<DeliveryRegion> | null>(null);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    const saveRegion = async (r: DeliveryRegion) => {
        let newRegions = [...settings.deliveryRegions];
        if(!r.id) {
            r.id = 'reg-' + Date.now();
            newRegions.push(r);
        } else {
            newRegions = newRegions.map(reg => reg.id === r.id ? r : reg);
        }
        await updateSettings({...settings, deliveryRegions: newRegions});
        setIsRegionModalOpen(false);
    };

    const confirmDelete = () => {
        if(deleteTargetId) {
            const newRegs = settings.deliveryRegions.filter(r => r.id !== deleteTargetId);
            updateSettings({...settings, deliveryRegions: newRegs});
            setDeleteTargetId(null);
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-primary flex items-center"><Truck className="mr-2 text-accent"/> {t('admin.delivery')}</h2>
                <button onClick={() => { setEditingRegion({ enabled: true, zips: [], exceptions: [] }); setIsRegionModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"><Plus size={16} className="mr-2"/> {t('admin.zone_new')}</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {settings.deliveryRegions.map(r => (
                <div key={r.id} className={`bg-white p-6 rounded-2xl border shadow-sm ${!r.enabled ? 'opacity-75 bg-gray-50' : ''}`}>
                    <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-lg">{r.name}</h3>
                        <div className="text-xs text-gray-500 mt-1">{r.deliveryTimeStart || '?'} - {r.deliveryTimeEnd || '?'}</div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { setEditingRegion(r); setIsRegionModalOpen(true); }} className="p-1 hover:bg-gray-100 rounded"><Edit size={16}/></button>
                        <button onClick={() => setDeleteTargetId(r.id)} className="p-1 hover:bg-red-50 rounded text-red-500"><Trash2 size={16}/></button>
                    </div>
                    </div>
                    <div className="flex justify-between text-sm mb-4 bg-gray-50 p-3 rounded-lg">
                    <div>Cena: <strong>{r.price} Kč</strong></div>
                    <div>Zdarma od: <strong>{r.freeFrom} Kč</strong></div>
                    </div>
                    <div className="text-xs text-gray-500 font-mono break-all">{r.zips.join(', ')}</div>
                    
                    {r.exceptions && r.exceptions.length > 0 && (
                        <div className="mt-4 border-t pt-3">
                            <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Výjimky v kalendáři:</div>
                            <div className="space-y-1">
                                {r.exceptions.map((ex, idx) => (
                                    <div key={idx} className="flex justify-between text-xs bg-gray-50 p-1.5 rounded">
                                        <span className="font-mono">{ex.date}</span>
                                        <span>
                                            {ex.isOpen ? (
                                                <span className="text-blue-600 font-bold">Změna času ({ex.deliveryTimeStart}-{ex.deliveryTimeEnd})</span>
                                            ) : (
                                                <span className="text-red-600 font-bold">ZAVŘENO</span>
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                ))}
            </div>
            <RegionModal isOpen={isRegionModalOpen} onClose={() => setIsRegionModalOpen(false)} region={editingRegion || {}} onSave={saveRegion} />
            <DeleteConfirmModal 
                isOpen={!!deleteTargetId} 
                title="Smazat region?" 
                onClose={() => setDeleteTargetId(null)} 
                onConfirm={confirmDelete} 
            />
        </div>
    );
};
