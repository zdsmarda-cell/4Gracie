
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { DayConfig, CategoryCapacities } from '../../types';
import { Plus, Edit, Trash2, AlertCircle } from 'lucide-react';

export const CapacitiesTab: React.FC = () => {
    const { settings, updateSettings, dayConfigs, updateDayConfig, t, formatDate } = useStore();
    const [isDayConfigModalOpen, setIsDayConfigModalOpen] = useState(false);
    const [editingDayConfig, setEditingDayConfig] = useState<Partial<DayConfig> | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    
    // Local state for global limits to prevent immediate DB saves
    const [localCapacities, setLocalCapacities] = useState<CategoryCapacities>(settings.defaultCapacities);

    // Helper class to hide spinners
    const noSpinnerClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

    // Sync from settings on load
    useEffect(() => {
        setLocalCapacities(settings.defaultCapacities);
    }, [settings.defaultCapacities]);

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);

    const saveDayConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationErrors({});

        if (!editingDayConfig) return;

        const errors: Record<string, string> = {};

        // Validace data
        if (!editingDayConfig.date) {
            errors.date = 'Vyplňte datum.';
        }

        // Validate non-negative capacities
        if (editingDayConfig.isOpen && editingDayConfig.capacityOverrides) {
            Object.entries(editingDayConfig.capacityOverrides).forEach(([catId, val]) => {
                if ((val as number) < 0) {
                    errors[`cap_${catId}`] = 'Kapacita nesmí být záporná.';
                }
            });
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }

        await updateDayConfig(editingDayConfig as DayConfig);
        setIsDayConfigModalOpen(false);
    };

    const saveGlobalLimits = async () => {
        // Validate localCapacities (non-negative)
        for (const key in localCapacities) {
            if (localCapacities[key] < 0) {
                alert(`Kapacita pro kategorii nemůže být záporná.`);
                return;
            }
        }

        await updateSettings({
            ...settings,
            defaultCapacities: localCapacities
        });
    };

    const openModal = (config: Partial<DayConfig>) => {
        setEditingDayConfig(config);
        setValidationErrors({});
        setIsDayConfigModalOpen(true);
    };

    return (
        <div className="animate-fade-in space-y-8">
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h3 className="font-bold mb-4">{t('admin.global_limits')}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {sortedCategories.map(cat => (
                    <div key={cat.id}>
                    <label className="text-xs font-bold text-gray-400 block mb-1">{cat.name}</label>
                    <input 
                        type="number" 
                        min="0"
                        className={`w-full border rounded p-2 ${noSpinnerClass}`}
                        value={localCapacities[cat.id] ?? ''} 
                        onChange={e => {
                            const val = Number(e.target.value);
                            // Allow empty string for better UX typing, but check strictly on save or use local state logic
                            setLocalCapacities({...localCapacities, [cat.id]: val});
                        }} 
                    />
                    </div>
                ))}
                </div>
                <button onClick={saveGlobalLimits} className="mt-4 bg-primary text-white px-4 py-2 rounded text-xs font-bold">Uložit globální limity</button>
            </div>

            <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold">{t('admin.exceptions')}</h3>
                <button onClick={() => openModal({ date: '', isOpen: false })} className="bg-white border hover:bg-gray-50 px-3 py-1 rounded text-xs font-bold flex items-center"><Plus size={14} className="mr-1"/> {t('admin.exception_add')}</button>
                </div>
                <div className="space-y-2">
                {dayConfigs.map((c, idx) => (
                    <div key={idx} className={`flex justify-between items-center p-3 rounded-lg border ${c.isOpen ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                    <div>
                        <span className="font-mono font-bold block">{formatDate(c.date)}</span>
                        <span className={`text-xs font-bold ${c.isOpen ? 'text-blue-600' : 'text-red-600'}`}>{c.isOpen ? t('admin.exception_open') : t('admin.exception_closed')}</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => openModal(c)} className="p-1 hover:bg-white rounded"><Edit size={16}/></button>
                        <button onClick={() => { if(confirm('Smazat výjimku?')) { updateDayConfig({ ...c, date: 'DELETE' }).then(() => window.location.reload()); } }} className="p-1 hover:bg-white rounded text-red-500"><Trash2 size={16}/></button>
                    </div>
                    </div>
                ))}
                </div>
            </div>
            
            {isDayConfigModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={saveDayConfig} className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                        <h3 className="font-bold text-lg">Výjimka v kalendáři</h3>
                        
                        <div>
                            <label className={`text-xs font-bold block mb-1 ${validationErrors.date ? 'text-red-500' : 'text-gray-400'}`}>Datum</label>
                            <input 
                                type="date" 
                                className={`w-full border rounded p-2 ${validationErrors.date ? 'border-red-500 bg-red-50' : ''}`}
                                value={editingDayConfig?.date || ''} 
                                onChange={e => {
                                    setEditingDayConfig({...editingDayConfig, date: e.target.value});
                                    setValidationErrors({...validationErrors, date: ''});
                                }} 
                                disabled={!!editingDayConfig?.date && dayConfigs.some(d => d.date === editingDayConfig.date && d !== editingDayConfig)} 
                            />
                            {validationErrors.date && (
                                <div className="flex items-center mt-1 text-red-500 text-xs font-bold">
                                    <AlertCircle size={12} className="mr-1"/> {validationErrors.date}
                                </div>
                            )}
                        </div>

                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={editingDayConfig?.isOpen ?? false} onChange={e => setEditingDayConfig({...editingDayConfig, isOpen: e.target.checked})} />
                            <span className="text-sm font-bold">Otevřeno</span>
                        </label>
                        
                        {editingDayConfig?.isOpen && (
                            <div className="bg-gray-50 p-3 rounded">
                                <h4 className="text-xs font-bold mb-2">Override Kapacit (Volitelné)</h4>
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                    {sortedCategories.map(cat => (
                                        <div key={cat.id}>
                                            <div className="flex justify-between items-center text-xs">
                                                <span>{cat.name}</span>
                                                <input 
                                                    type="number"
                                                    min="0" 
                                                    className={`w-20 border rounded p-1 ${noSpinnerClass} ${validationErrors[`cap_${cat.id}`] ? 'border-red-500 bg-red-50' : ''}`} 
                                                    placeholder="Limit" 
                                                    value={editingDayConfig.capacityOverrides?.[cat.id] ?? ''} 
                                                    onChange={e => {
                                                        const val = Number(e.target.value);
                                                        setEditingDayConfig({
                                                            ...editingDayConfig,
                                                            capacityOverrides: { ...editingDayConfig.capacityOverrides, [cat.id]: val }
                                                        });
                                                        setValidationErrors({...validationErrors, [`cap_${cat.id}`]: ''});
                                                    }} 
                                                />
                                            </div>
                                            {validationErrors[`cap_${cat.id}`] && <p className="text-[10px] text-red-500 text-right">{validationErrors[`cap_${cat.id}`]}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex gap-2 pt-4">
                            <button type="button" onClick={() => setIsDayConfigModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">Zrušit</button>
                            <button type="submit" className="flex-1 py-2 bg-primary text-white rounded">Uložit</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
