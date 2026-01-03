
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { DiscountCode, DiscountType } from '../../types';
import { Plus, Edit, Trash2 } from 'lucide-react';

export const DiscountsTab: React.FC = () => {
    const { discountCodes, t, addDiscountCode, updateDiscountCode, deleteDiscountCode, settings } = useStore();
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
    const [editingDiscount, setEditingDiscount] = useState<Partial<DiscountCode> | null>(null);
    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);

    const saveDiscount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDiscount) return;

        const codeToSave = (editingDiscount.code || '').trim().toUpperCase();
        if (!codeToSave) {
            alert('Vyplňte kód slevy.');
            return;
        }

        const duplicate = discountCodes.find(d => 
            d.code.toUpperCase() === codeToSave && 
            d.id !== editingDiscount.id
        );

        if (duplicate) {
            alert(`Slevový kód "${codeToSave}" již existuje. Zvolte prosím jiný kód.`);
            return;
        }

        const disc = { ...editingDiscount, code: codeToSave } as DiscountCode;
        if (discountCodes.some(d => d.id === disc.id)) await updateDiscountCode(disc);
        else await addDiscountCode(disc);
        setIsDiscountModalOpen(false);
    };

    const handleDelete = (id: string, code: string) => {
        if(confirm(`Smazat slevu ${code}?`)) deleteDiscountCode(id);
    };

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-primary">{t('admin.discounts')}</h2>
                <button onClick={() => { setEditingDiscount({ id: Date.now().toString(), enabled: true, type: DiscountType.PERCENTAGE }); setIsDiscountModalOpen(true); }} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"><Plus size={16} className="mr-2"/> {t('admin.add_discount')}</button>
            </div>
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="min-w-full divide-y">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                    <tr>
                    <th className="px-6 py-4 text-left">Kód</th>
                    <th className="px-6 py-4 text-left">Hodnota</th>
                    <th className="px-6 py-4 text-left">Platnost</th>
                    <th className="px-6 py-4 text-center">Stav</th>
                    <th className="px-6 py-4 text-right">Akce</th>
                    </tr>
                </thead>
                <tbody className="divide-y text-xs">
                    {discountCodes.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-mono font-bold">{d.code}</td>
                        <td className="px-6 py-4">{d.value} {d.type === DiscountType.PERCENTAGE ? '%' : 'Kč'}</td>
                        <td className="px-6 py-4">{d.validFrom || '∞'} - {d.validTo || '∞'}</td>
                        <td className="px-6 py-4 text-center">{d.enabled ? <span className="text-green-500 font-bold">Aktivní</span> : <span className="text-red-500">Neaktivní</span>}</td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button onClick={() => { setEditingDiscount(d); setIsDiscountModalOpen(true); }} className="p-1 hover:text-primary"><Edit size={16}/></button>
                        <button onClick={() => handleDelete(d.id, d.code)} className="p-1 hover:text-red-500 text-gray-400"><Trash2 size={16}/></button>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>

            {isDiscountModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={saveDiscount} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h3 className="font-bold text-lg">{editingDiscount?.id ? 'Upravit slevu' : 'Nová sleva'}</h3>
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">Kód</label>
                            <input required className="w-full border rounded p-2 uppercase" value={editingDiscount?.code || ''} onChange={e => setEditingDiscount({...editingDiscount, code: e.target.value.toUpperCase()})} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Typ</label>
                                <select className="w-full border rounded p-2" value={editingDiscount?.type} onChange={e => setEditingDiscount({...editingDiscount, type: e.target.value as DiscountType})}>
                                    <option value={DiscountType.PERCENTAGE}>Procenta (%)</option>
                                    <option value={DiscountType.FIXED}>Částka (Kč)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Hodnota</label>
                                <input type="number" required className="w-full border rounded p-2" value={editingDiscount?.value || ''} onChange={e => setEditingDiscount({...editingDiscount, value: Number(e.target.value)})} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Min. hodnota obj. (Kč)</label>
                                <input type="number" className="w-full border rounded p-2" value={editingDiscount?.minOrderValue || ''} onChange={e => setEditingDiscount({...editingDiscount, minOrderValue: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Limit použití (ks)</label>
                                <input type="number" className="w-full border rounded p-2" value={editingDiscount?.maxUsage || ''} onChange={e => setEditingDiscount({...editingDiscount, maxUsage: Number(e.target.value)})} placeholder="0 = neomezeně" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Platnost Od</label>
                                <input type="date" className="w-full border rounded p-2" value={editingDiscount?.validFrom || ''} onChange={e => setEditingDiscount({...editingDiscount, validFrom: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">Platnost Do</label>
                                <input type="date" className="w-full border rounded p-2" value={editingDiscount?.validTo || ''} onChange={e => setEditingDiscount({...editingDiscount, validTo: e.target.value})} />
                            </div>
                        </div>
                        
                        <div className="border p-3 rounded-lg">
                            <label className="text-xs font-bold text-gray-400 block mb-2">Platí pro kategorie (nevybráno = vše)</label>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {sortedCategories.map(cat => (
                                    <label key={cat.id} className="flex items-center space-x-2 text-xs cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={editingDiscount?.applicableCategories?.includes(cat.id) ?? false}
                                            onChange={e => {
                                                const current = editingDiscount?.applicableCategories || [];
                                                const updated = e.target.checked 
                                                    ? [...current, cat.id] 
                                                    : current.filter(id => id !== cat.id);
                                                setEditingDiscount({...editingDiscount, applicableCategories: updated});
                                            }}
                                            className="rounded text-accent"
                                        />
                                        <span>{cat.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gray-50 p-3 rounded space-y-2">
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={editingDiscount?.enabled ?? true} onChange={e => setEditingDiscount({...editingDiscount, enabled: e.target.checked})} /> Aktivní
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={editingDiscount?.isStackable ?? false} onChange={e => setEditingDiscount({...editingDiscount, isStackable: e.target.checked})} /> Kombinovatelné
                            </label>
                        </div>
                        <div className="flex gap-2 pt-4">
                            <button type="button" onClick={() => setIsDiscountModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">Zrušit</button>
                            <button type="submit" className="flex-1 py-2 bg-primary text-white rounded">Uložit</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
