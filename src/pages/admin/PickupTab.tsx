
import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { PickupLocation, RegionException, OrderStatus } from '../../types';
import { Plus, Edit, Trash2, X, Store } from 'lucide-react';

// Reusing a similar component structure for Delete Modal inside this file to keep it self-contained
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

export const PickupTab: React.FC = () => {
    const { settings, updateSettings, orders, t } = useStore();
    const [isPickupModalOpen, setIsPickupModalOpen] = useState(false);
    const [editingPickup, setEditingPickup] = useState<Partial<PickupLocation> | null>(null);
    const [newPickupException, setNewPickupException] = useState<Partial<RegionException>>({ date: '', isOpen: false });
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    const savePickup = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!editingPickup) return;
        let newLocations = [...(settings.pickupLocations || [])];
        const loc = { ...editingPickup } as PickupLocation;
        if (!loc.id) { loc.id = 'loc-' + Date.now(); newLocations.push(loc); } 
        else { newLocations = newLocations.map(l => l.id === loc.id ? loc : l); }
        await updateSettings({ ...settings, pickupLocations: newLocations });
        setIsPickupModalOpen(false);
    };

    const confirmDelete = () => {
        if(deleteTargetId) {
            const newLocs = settings.pickupLocations.filter(l => l.id !== deleteTargetId);
            updateSettings({...settings, pickupLocations: newLocs});
            setDeleteTargetId(null);
        }
    };

    const addPickupException = () => {
        if (!newPickupException.date) return;
        if (!newPickupException.isOpen) {
            const conflictingOrders = orders.filter(o => {
                if (o.deliveryDate !== newPickupException.date) return false;
                if (o.status === OrderStatus.CANCELLED) return false;
                if (o.deliveryType !== 'pickup') return false; 
                return o.pickupLocationId === editingPickup?.id;
            });
            if (conflictingOrders.length > 0) { alert('Nelze uzavřít tento den, existují objednávky.'); return; }
        }
        if (editingPickup?.exceptions?.some(e => e.date === newPickupException.date)) { alert('Výjimka existuje.'); return; }
        setEditingPickup(prev => ({ ...prev, exceptions: [...(prev?.exceptions || []), newPickupException as RegionException] }));
        setNewPickupException({ date: '', isOpen: false });
    };

    const removePickupException = (date: string) => {
         setEditingPickup(prev => ({ ...prev, exceptions: prev?.exceptions?.filter(e => e.date !== date) }));
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-primary flex items-center"><Store className="mr-2 text-accent"/> {t('admin.pickup')}</h2>
                <button 
                    onClick={() => { 
                        setEditingPickup({ 
                            enabled: true, 
                            exceptions: [], 
                            openingHours: { 
                                1: { isOpen: true, start: '08:00', end: '18:00' },
                                2: { isOpen: true, start: '08:00', end: '18:00' },
                                3: { isOpen: true, start: '08:00', end: '18:00' },
                                4: { isOpen: true, start: '08:00', end: '18:00' },
                                5: { isOpen: true, start: '08:00', end: '18:00' },
                                6: { isOpen: false, start: '09:00', end: '12:00' },
                                0: { isOpen: false, start: '09:00', end: '12:00' }
                            } 
                        }); 
                        setIsPickupModalOpen(true); 
                    }} 
                    className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"
                >
                    <Plus size={16} className="mr-2"/> {t('admin.pickup_new')}
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(settings.pickupLocations || []).map(loc => (
                    <div key={loc.id} className={`bg-white p-6 rounded-2xl border shadow-sm ${!loc.enabled ? 'opacity-75 bg-gray-50' : ''}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div><h3 className="font-bold text-lg">{loc.name}</h3><div className="text-xs text-gray-500 mt-1">{loc.street}, {loc.city}</div></div>
                            <div className="flex gap-2">
                                <button onClick={() => { setEditingPickup(loc); setIsPickupModalOpen(true); }} className="p-1 hover:bg-gray-100 rounded"><Edit size={16}/></button>
                                <button onClick={() => setDeleteTargetId(loc.id)} className="p-1 hover:bg-red-50 rounded text-red-500"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        <div className="space-y-1 text-[10px] text-gray-500 border-t pt-2">
                            <div className="flex justify-between"><span>Po:</span> <strong>{loc.openingHours[1]?.isOpen ? `${loc.openingHours[1].start}-${loc.openingHours[1].end}` : 'Zavřeno'}</strong></div>
                            <div className="flex justify-between"><span>Pá:</span> <strong>{loc.openingHours[5]?.isOpen ? `${loc.openingHours[5].start}-${loc.openingHours[5].end}` : 'Zavřeno'}</strong></div>
                            <div className="flex justify-between"><span>Ne:</span> <strong>{loc.openingHours[0]?.isOpen ? `${loc.openingHours[0].start}-${loc.openingHours[0].end}` : 'Zavřeno'}</strong></div>
                        </div>

                        {/* Display Exceptions in List View */}
                        {loc.exceptions && loc.exceptions.length > 0 && (
                            <div className="mt-3 pt-2 border-t">
                                <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Výjimky</div>
                                <div className="space-y-1">
                                    {loc.exceptions.map((ex, idx) => (
                                        <div key={idx} className="flex justify-between text-[10px] bg-gray-50 p-1 rounded">
                                            <span className="font-mono">{ex.date}</span>
                                            <span className={ex.isOpen ? "text-blue-600 font-bold" : "text-red-600 font-bold"}>
                                                {ex.isOpen ? 'JINÝ ČAS' : 'ZAVŘENO'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <DeleteConfirmModal 
                isOpen={!!deleteTargetId} 
                title="Smazat odběrné místo?" 
                onClose={() => setDeleteTargetId(null)} 
                onConfirm={confirmDelete} 
            />

            {isPickupModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={savePickup} className="bg-white rounded-2xl w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
                        <h3 className="font-bold text-lg">{editingPickup?.id ? 'Upravit odběrné místo' : 'Nové odběrné místo'}</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-gray-400 block mb-1">Název místa</label><input required className="w-full border rounded p-2" value={editingPickup?.name || ''} onChange={e => setEditingPickup({ ...editingPickup, name: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-gray-400 block mb-1">Ulice a č.p.</label><input required className="w-full border rounded p-2" value={editingPickup?.street || ''} onChange={e => setEditingPickup({ ...editingPickup, street: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-gray-400 block mb-1">Město</label><input required className="w-full border rounded p-2" value={editingPickup?.city || ''} onChange={e => setEditingPickup({ ...editingPickup, city: e.target.value })} /></div>
                            <div><label className="text-xs font-bold text-gray-400 block mb-1">PSČ</label><input required className="w-full border rounded p-2" value={editingPickup?.zip || ''} onChange={e => setEditingPickup({ ...editingPickup, zip: e.target.value })} /></div>
                        </div>

                        <div className="border rounded-xl p-4 bg-gray-50">
                            <h4 className="font-bold text-sm mb-3">Otevírací doba</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                {[1, 2, 3, 4, 5, 6, 0].map(day => (
                                    <div key={day} className="flex items-center gap-2">
                                        <span className="w-8 font-bold text-xs">{day === 0 ? 'Ne' : day === 1 ? 'Po' : day === 2 ? 'Út' : day === 3 ? 'St' : day === 4 ? 'Čt' : day === 5 ? 'Pá' : 'So'}</span>
                                        <label className="flex items-center text-xs gap-1">
                                            <input 
                                                type="checkbox" 
                                                checked={editingPickup?.openingHours?.[day]?.isOpen ?? false}
                                                onChange={e => setEditingPickup({
                                                    ...editingPickup,
                                                    openingHours: {
                                                        ...editingPickup?.openingHours,
                                                        [day]: { ...editingPickup?.openingHours?.[day], isOpen: e.target.checked }
                                                    }
                                                })}
                                            />
                                            Otevřeno
                                        </label>
                                        {editingPickup?.openingHours?.[day]?.isOpen && (
                                            <>
                                                <input type="time" className="w-20 p-1 border rounded text-xs" value={editingPickup.openingHours[day].start} onChange={e => setEditingPickup({ ...editingPickup, openingHours: { ...editingPickup.openingHours, [day]: { ...editingPickup.openingHours![day], start: e.target.value } } })} />
                                                <span className="text-xs">-</span>
                                                <input type="time" className="w-20 p-1 border rounded text-xs" value={editingPickup.openingHours[day].end} onChange={e => setEditingPickup({ ...editingPickup, openingHours: { ...editingPickup.openingHours, [day]: { ...editingPickup.openingHours![day], end: e.target.value } } })} />
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white border rounded-xl p-4">
                            <label className="text-xs font-bold text-gray-400 block mb-2">Výjimky otevírací doby</label>
                            <div className="flex gap-2 mb-2 items-end">
                                <div className="flex-1">
                                    <span className="text-[10px] block text-gray-400">Datum</span>
                                    <input type="date" className="w-full border rounded p-1 text-xs" value={newPickupException.date} onChange={e => setNewPickupException({ ...newPickupException, date: e.target.value })} />
                                </div>
                                <div className="flex items-center gap-1 pb-2">
                                    <input type="checkbox" checked={newPickupException.isOpen} onChange={e => setNewPickupException({ ...newPickupException, isOpen: e.target.checked })} />
                                    <span className="text-xs">Otevřeno?</span>
                                </div>
                                {newPickupException.isOpen && (
                                    <>
                                        <div className="w-20"><input type="time" className="w-full border rounded p-1 text-xs" value={newPickupException.deliveryTimeStart || ''} onChange={e => setNewPickupException({ ...newPickupException, deliveryTimeStart: e.target.value })} /></div>
                                        <div className="w-20"><input type="time" className="w-full border rounded p-1 text-xs" value={newPickupException.deliveryTimeEnd || ''} onChange={e => setNewPickupException({ ...newPickupException, deliveryTimeEnd: e.target.value })} /></div>
                                    </>
                                )}
                                <button type="button" onClick={addPickupException} className="bg-accent text-white px-3 py-1.5 rounded text-xs font-bold self-end">+</button>
                            </div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {editingPickup?.exceptions?.map((ex, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs bg-gray-50 p-2 border rounded">
                                        <span>{ex.date}: <strong>{ex.isOpen ? 'Otevřeno' : 'ZAVŘENO'}</strong> {ex.isOpen && `(${ex.deliveryTimeStart} - ${ex.deliveryTimeEnd})`}</span>
                                        <button type="button" onClick={() => removePickupException(ex.date)} className="text-red-500"><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <label className="flex items-center gap-2 mt-2">
                            <input type="checkbox" checked={editingPickup?.enabled ?? true} onChange={e => setEditingPickup({ ...editingPickup, enabled: e.target.checked })} />
                            <span className="text-sm">Aktivní</span>
                        </label>
                        <div className="flex gap-2 pt-4">
                            <button type="button" onClick={() => setIsPickupModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">{t('admin.cancel')}</button>
                            <button type="submit" className="flex-1 py-2 bg-primary text-white rounded">{t('admin.save_changes')}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
