
import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { DeliveryRegion, RegionException, OpeningHoursDay } from '../../types';
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
    
    // Validation State
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [exceptionErrors, setExceptionErrors] = useState<Record<string, string>>({});

    useEffect(() => { 
        if (isOpen) {
            // Deep copy to prevent mutation of props and ensure openingHours exists
            const initData = JSON.parse(JSON.stringify(region));
            if (!initData.openingHours) {
                // Default structure if missing
                 initData.openingHours = { 
                    1: { isOpen: true, start: '10:00', end: '14:00' },
                    2: { isOpen: true, start: '10:00', end: '14:00' },
                    3: { isOpen: true, start: '10:00', end: '14:00' },
                    4: { isOpen: true, start: '10:00', end: '14:00' },
                    5: { isOpen: true, start: '10:00', end: '14:00' },
                    6: { isOpen: false, start: '10:00', end: '14:00' },
                    0: { isOpen: false, start: '10:00', end: '14:00' }
                };
            }
            setFormData(initData);
            setValidationErrors({});
            setExceptionErrors({});
        }
    }, [isOpen, region]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setValidationErrors({});
        
        const errors: Record<string, string> = {};
        if (!formData.name) errors.name = 'Vyplňte název.';
        if (formData.price === undefined || formData.price < 0) errors.price = 'Vyplňte cenu (min. 0).';
        if (formData.freeFrom === undefined || formData.freeFrom < 0) errors.freeFrom = 'Vyplňte limit (min. 0).';

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }

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
        setExceptionErrors({});
        const errors: Record<string, string> = {};

        if (!newException.date) errors.date = 'Vyberte datum.';
        if (newException.isOpen) {
            if (!newException.deliveryTimeStart) errors.start = 'Vyplňte čas od.';
            if (!newException.deliveryTimeEnd) errors.end = 'Vyplňte čas do.';
        }

        if (Object.keys(errors).length > 0) {
            setExceptionErrors(errors);
            return;
        }

        setFormData({ ...formData, exceptions: [...(formData.exceptions || []), newException as RegionException] });
        setNewException({ date: '', isOpen: false });
    };

    const removeException = (date: string) => {
        setFormData({ ...formData, exceptions: formData.exceptions?.filter(e => e.date !== date) });
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
             <form onSubmit={handleSubmit} className="bg-white rounded-2xl w-full max-w-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
                 <h3 className="font-bold text-lg">{formData.id ? 'Upravit region' : 'Nový region'}</h3>
                 
                 <div className="space-y-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">Název regionu</label>
                            <input className={`w-full border rounded p-2 ${validationErrors.name ? 'border-red-500 bg-red-50' : ''}`} placeholder="Název" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                            {validationErrors.name && <span className="text-[10px] text-red-500">{validationErrors.name}</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Cena dopravy</label>
                                <input type="number" className={`w-full border rounded p-2 ${validationErrors.price ? 'border-red-500 bg-red-50' : ''}`} placeholder="Cena" value={formData.price ?? ''} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Zdarma od</label>
                                <input type="number" className={`w-full border rounded p-2 ${validationErrors.freeFrom ? 'border-red-500 bg-red-50' : ''}`} placeholder="Limit" value={formData.freeFrom ?? ''} onChange={e => setFormData({...formData, freeFrom: Number(e.target.value)})} />
                            </div>
                        </div>
                    </div>

                    {/* Opening Hours Grid */}
                    <div className="border rounded-xl p-4 bg-gray-50">
                        <h4 className="font-bold text-sm mb-3">Dny a časy rozvozu</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                            {[1, 2, 3, 4, 5, 6, 0].map(day => (
                                <div key={day} className="flex items-center gap-2">
                                    <span className="w-8 font-bold text-xs">{day === 0 ? 'Ne' : day === 1 ? 'Po' : day === 2 ? 'Út' : day === 3 ? 'St' : day === 4 ? 'Čt' : day === 5 ? 'Pá' : 'So'}</span>
                                    <label className="flex items-center text-xs gap-1 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.openingHours?.[day]?.isOpen ?? false}
                                            onChange={e => setFormData({
                                                ...formData,
                                                openingHours: {
                                                    ...formData.openingHours,
                                                    [day]: { ...formData.openingHours?.[day], isOpen: e.target.checked } as OpeningHoursDay
                                                }
                                            })}
                                        />
                                        Rozváží se
                                    </label>
                                    {formData.openingHours?.[day]?.isOpen && (
                                        <>
                                            <input type="time" className="w-20 p-1 border rounded text-xs" value={formData.openingHours[day].start || '10:00'} onChange={e => setFormData({ ...formData, openingHours: { ...formData.openingHours, [day]: { ...formData.openingHours![day], start: e.target.value } as OpeningHoursDay } })} />
                                            <span className="text-xs">-</span>
                                            <input type="time" className="w-20 p-1 border rounded text-xs" value={formData.openingHours[day].end || '14:00'} onChange={e => setFormData({ ...formData, openingHours: { ...formData.openingHours, [day]: { ...formData.openingHours![day], end: e.target.value } as OpeningHoursDay } })} />
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* ZIP Codes */}
                    <div className="bg-white border rounded-xl p-3">
                        <label className="text-xs font-bold block mb-1 text-gray-400">Doručovací PSČ</label>
                        <div className="flex gap-2 mb-2">
                            <input className="border rounded p-1 flex-1 text-sm" value={newZip} onChange={e => setNewZip(e.target.value)} placeholder="Např. 66401" />
                            <button type="button" onClick={addZip} className="bg-gray-100 px-3 rounded font-bold hover:bg-gray-200">+</button>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                            {formData.zips?.map(z => (
                                <span key={z} className="bg-gray-100 border px-2 py-1 rounded text-xs flex items-center gap-1">
                                    {z} 
                                    <button type="button" onClick={() => removeZip(z)} className="text-gray-500 hover:text-red-500"><X size={10}/></button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Exceptions */}
                     <div className="bg-white border rounded-xl p-3">
                        <label className="text-xs font-bold block mb-1 text-gray-400">Výjimky v kalendáři</label>
                        <div className="flex gap-2 mb-2 items-end">
                             <div className="flex-1">
                                 <span className={`text-[10px] block ${exceptionErrors.date ? 'text-red-500' : 'text-gray-400'}`}>Datum</span>
                                 <input type="date" className={`w-full border rounded p-1 text-sm ${exceptionErrors.date ? 'border-red-500 bg-red-50' : ''}`} value={newException.date} onChange={e => setNewException({...newException, date: e.target.value})} />
                             </div>
                             <label className="text-xs flex items-center pb-2 cursor-pointer"><input type="checkbox" className="mr-1" checked={newException.isOpen} onChange={e => setNewException({...newException, isOpen: e.target.checked})} /> Rozvoz?</label>
                             
                             {newException.isOpen && (
                                 <>
                                     <div className="w-20">
                                         <span className="text-[10px] text-gray-400 block">Od</span>
                                         <input type="time" className={`w-full border rounded p-1 text-sm ${exceptionErrors.start ? 'border-red-500 bg-red-50' : ''}`} value={newException.deliveryTimeStart || ''} onChange={e => setNewException({...newException, deliveryTimeStart: e.target.value})} />
                                     </div>
                                     <div className="w-20">
                                         <span className="text-[10px] text-gray-400 block">Do</span>
                                         <input type="time" className={`w-full border rounded p-1 text-sm ${exceptionErrors.end ? 'border-red-500 bg-red-50' : ''}`} value={newException.deliveryTimeEnd || ''} onChange={e => setNewException({...newException, deliveryTimeEnd: e.target.value})} />
                                     </div>
                                 </>
                            )}
                             <button type="button" onClick={addException} className="bg-gray-100 px-3 rounded pb-1 pt-1 font-bold hover:bg-gray-200 self-end h-[29px]">+</button>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                            {formData.exceptions?.map(ex => (
                                <div key={ex.date} className="flex justify-between items-center text-xs border-b py-1">
                                    <span>{ex.date}: <strong>{ex.isOpen ? 'JINÝ ČAS' : 'NEROZVÁŽÍ SE'}</strong> {ex.isOpen && `(${ex.deliveryTimeStart} - ${ex.deliveryTimeEnd})`}</span>
                                    <button type="button" onClick={() => removeException(ex.date)} className="text-red-500"><X size={12}/></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <label className="flex items-center gap-2 pt-2 border-t">
                        <input type="checkbox" checked={formData.enabled ?? true} onChange={e => setFormData({...formData, enabled: e.target.checked})} />
                        <span className="text-sm font-bold text-gray-700">Region aktivní</span>
                    </label>
                 </div>
                 <div className="flex gap-2 pt-4">
                      <button type="button" onClick={onClose} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-600 text-sm">Zrušit</button>
                      <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg">Uložit</button>
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

    const dayLabels: Record<number, string> = { 1: 'Po', 2: 'Út', 3: 'St', 4: 'Čt', 5: 'Pá', 6: 'So', 0: 'Ne' };

    const getDaysLabel = (openingHours?: { [key: number]: OpeningHoursDay }) => {
        if (!openingHours) return 'Žádné dny';
        const days = Object.keys(openingHours).map(Number).filter(d => openingHours[d].isOpen);
        
        if (days.length === 0) return 'Žádné dny';
        if (days.length === 7) return 'Po-Ne (Denně)';
        if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Po-Pá';
        
        return days.sort((a,b) => (a===0?7:a) - (b===0?7:b)).map(d => dayLabels[d]).join(', ');
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-primary flex items-center"><Truck className="mr-2 text-accent"/> {t('admin.delivery')}</h2>
                <button 
                    onClick={() => { 
                        setEditingRegion({ enabled: true, zips: [], exceptions: [], openingHours: undefined }); // let modal init defaults
                        setIsRegionModalOpen(true); 
                    }} 
                    className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"
                >
                    <Plus size={16} className="mr-2"/> {t('admin.zone_new')}
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {settings.deliveryRegions.map(r => (
                <div key={r.id} className={`bg-white p-6 rounded-2xl border shadow-sm ${!r.enabled ? 'opacity-75 bg-gray-50' : ''}`}>
                    <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg">{r.name}</h3>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${r.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {r.enabled ? 'Aktivní' : 'Neaktivní'}
                            </span>
                        </div>
                        <div className="text-[10px] text-blue-600 font-bold mt-1">{getDaysLabel(r.openingHours)}</div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { setEditingRegion(r); setIsRegionModalOpen(true); }} className="p-1 hover:bg-gray-100 rounded"><Edit size={16}/></button>
                        <button onClick={() => setDeleteTargetId(r.id)} className="p-1 hover:bg-red-50 rounded text-red-500"><Trash2 size={16}/></button>
                    </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[10px] text-gray-500 border-t pt-2 border-b pb-2 mb-2">
                        <div className="space-y-1 border-r pr-2">
                             {[1, 2, 3, 4].map(d => {
                                const conf = r.openingHours?.[d];
                                return (
                                    <div key={d} className="flex justify-between">
                                        <span>{dayLabels[d]}:</span> 
                                        <strong className={conf?.isOpen ? "text-gray-700" : "text-gray-300"}>{conf?.isOpen ? `${conf.start}-${conf.end}` : '---'}</strong>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="space-y-1">
                             {[5, 6, 0].map(d => {
                                const conf = r.openingHours?.[d];
                                return (
                                    <div key={d} className="flex justify-between">
                                        <span>{dayLabels[d]}:</span> 
                                        <strong className={conf?.isOpen ? "text-gray-700" : "text-gray-300"}>{conf?.isOpen ? `${conf.start}-${conf.end}` : '---'}</strong>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex justify-between text-sm mb-4 bg-gray-50 p-3 rounded-lg">
                        <div>Cena: <strong>{r.price} Kč</strong></div>
                        <div>Zdarma od: <strong>{r.freeFrom} Kč</strong></div>
                    </div>
                    <div className="text-xs text-gray-500 font-mono break-all line-clamp-2" title={r.zips.join(', ')}>{r.zips.join(', ')}</div>
                    
                    {r.exceptions && r.exceptions.length > 0 && (
                        <div className="mt-4 border-t pt-3">
                            <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Výjimky:</div>
                            <div className="space-y-1">
                                {r.exceptions.map((ex, idx) => (
                                    <div key={idx} className="flex justify-between text-xs bg-gray-50 p-1.5 rounded">
                                        <span className="font-mono">{ex.date}</span>
                                        <span>
                                            {ex.isOpen ? (
                                                <span className="text-blue-600 font-bold">ZMĚNA ({ex.deliveryTimeStart}-{ex.deliveryTimeEnd})</span>
                                            ) : (
                                                <span className="text-red-600 font-bold">NEROZVÁŽÍ SE</span>
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
