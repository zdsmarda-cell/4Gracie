
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { EventSlot, OrderStatus } from '../../types';
import { Plus, Edit, Trash2, Calendar, AlertTriangle } from 'lucide-react';

const WarningModal: React.FC<{
    isOpen: boolean;
    message: string;
    onClose: () => void;
}> = ({ isOpen, message, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4 text-orange-600">
                        <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Nelze smazat</h3>
                    <p className="text-sm text-gray-500 mb-6">{message}</p>
                    <button onClick={onClose} className="w-full py-2 bg-gray-900 text-white rounded-lg font-bold text-sm hover:bg-black transition">Rozumím</button>
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
    const { t } = useStore();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <Trash2 size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-sm text-gray-500 mb-6">Tato akce je nevratná.</p>
                    <div className="flex gap-3 w-full">
                        <button onClick={onClose} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200 transition">{t('common.cancel')}</button>
                        <button onClick={onConfirm} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition">{t('common.delete')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const EventsTab: React.FC = () => {
    const { settings, updateEventSlot, removeEventSlot, t, formatDate, orders } = useStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSlot, setEditingSlot] = useState<Partial<EventSlot> | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [warningMessage, setWarningMessage] = useState<string | null>(null);

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);
    const eventSlots = useMemo(() => [...(settings.eventSlots || [])].sort((a, b) => a.date.localeCompare(b.date)), [settings.eventSlots]);

    const saveEventSlot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSlot || !editingSlot.date) return;
        
        // Ensure capacityOverrides exists
        if (!editingSlot.capacityOverrides) editingSlot.capacityOverrides = {};
        
        await updateEventSlot(editingSlot as EventSlot);
        setIsModalOpen(false);
    };

    const handleDeleteRequest = (date: string) => {
        // Check for active orders
        const hasActiveOrders = orders.some(o => 
            o.deliveryDate === date && 
            o.status !== OrderStatus.CANCELLED
        );

        if (hasActiveOrders) {
            setWarningMessage(`Pro datum ${formatDate(date)} existují aktivní objednávky. Akci nelze zrušit, dokud objednávky nestornujete.`);
            return;
        }

        setDeleteTarget(date);
    };

    const performDelete = async () => {
        if (deleteTarget) {
            await removeEventSlot(deleteTarget);
            setDeleteTarget(null);
        }
    };

    return (
        <div className="animate-fade-in space-y-8">
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold flex items-center gap-2"><Calendar className="text-accent" /> {t('admin.events')}</h3>
                    <button 
                        onClick={() => { setEditingSlot({ date: '', capacityOverrides: {} }); setIsModalOpen(true); }} 
                        className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"
                    >
                        <Plus size={14} className="mr-1"/> {t('admin.event_add')}
                    </button>
                </div>
                
                <div className="space-y-3">
                    {eventSlots.length === 0 && <p className="text-gray-400 text-center text-sm p-4">Žádné naplánované akce.</p>}
                    
                    {eventSlots.map((slot) => (
                        <div key={slot.date} className="flex flex-col md:flex-row justify-between items-center p-4 rounded-xl border bg-purple-50 border-purple-100 hover:shadow-sm transition">
                            <div className="mb-2 md:mb-0">
                                <span className="font-mono font-bold text-lg text-primary block">{formatDate(slot.date)}</span>
                                <span className="text-xs text-purple-700 font-bold uppercase">Aktivní akce</span>
                            </div>
                            
                            <div className="flex-grow md:mx-8 w-full md:w-auto mb-2 md:mb-0">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    {sortedCategories.map(cat => {
                                        const limit = slot.capacityOverrides?.[cat.id];
                                        return (
                                            <div key={cat.id} className="bg-white px-2 py-1 rounded border border-purple-100 text-center">
                                                <span className="block text-gray-400 text-[10px] uppercase truncate">{cat.name}</span>
                                                <span className="font-bold text-gray-800">{limit !== undefined ? limit : '-'}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button onClick={() => { setEditingSlot(JSON.parse(JSON.stringify(slot))); setIsModalOpen(true); }} className="p-2 bg-white rounded-lg hover:bg-purple-100 text-purple-700 border border-purple-100 transition"><Edit size={16}/></button>
                                <button onClick={() => handleDeleteRequest(slot.date)} className="p-2 bg-white rounded-lg hover:bg-red-50 text-red-500 border border-red-100 transition"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            <WarningModal isOpen={!!warningMessage} message={warningMessage || ''} onClose={() => setWarningMessage(null)} />
            <DeleteConfirmModal isOpen={!!deleteTarget} title={`Opravdu smazat akci ${formatDate(deleteTarget || '')}?`} onConfirm={performDelete} onClose={() => setDeleteTarget(null)} />

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={saveEventSlot} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="font-bold text-lg">{t('admin.event_add')}</h3>
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">Datum akce</label>
                            <input 
                                type="date" 
                                required 
                                className="w-full border rounded p-2" 
                                value={editingSlot?.date || ''} 
                                onChange={e => setEditingSlot({...editingSlot, date: e.target.value})} 
                                disabled={!!editingSlot?.date && eventSlots.some(s => s.date === editingSlot.date && s !== editingSlot)} 
                            />
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-xl border">
                            <h4 className="text-xs font-bold mb-3 uppercase text-gray-500">{t('admin.event_capacities')}</h4>
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                {sortedCategories.map(cat => (
                                    <div key={cat.id} className="flex justify-between items-center text-sm">
                                        <span className="font-bold text-gray-700">{cat.name}</span>
                                        <input 
                                            type="number" 
                                            className="w-24 border rounded p-1 text-right font-mono focus:ring-accent outline-none" 
                                            placeholder="Limit" 
                                            value={editingSlot?.capacityOverrides?.[cat.id] ?? ''} 
                                            onChange={e => setEditingSlot({
                                                ...editingSlot,
                                                capacityOverrides: { ...editingSlot?.capacityOverrides, [cat.id]: Number(e.target.value) }
                                            })} 
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 italic">Nevyplněné hodnoty se řídí výchozí kapacitou 0 (nedostupné).</p>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded font-bold text-sm text-gray-600 hover:bg-gray-200 transition">{t('admin.cancel')}</button>
                            <button type="submit" className="flex-1 py-2 bg-primary text-white rounded font-bold text-sm hover:bg-black transition">{t('common.save')}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
