import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { DiscountCode, DiscountType } from '../../types';
import { Plus, Edit, Trash2 } from 'lucide-react';

export const DiscountsTab: React.FC = () => {
    const { discountCodes, addDiscountCode, updateDiscountCode, deleteDiscountCode, settings, t } = useStore();
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
    const [editingDiscount, setEditingDiscount] = useState<Partial<DiscountCode> | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);

    const saveDiscount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDiscount) return;
        
        const discount = { ...editingDiscount } as DiscountCode;
        if (!discount.id) discount.id = Date.now().toString();
        
        // Defaults
        if (!discount.code) return alert(t('admin.fill_code'));
        if (discount.isStackable === undefined) discount.isStackable = false;
        if (discount.enabled === undefined) discount.enabled = true;
        if (discount.maxUsage === undefined) discount.maxUsage = 0;
        if (discount.minOrderValue === undefined) discount.minOrderValue = 0;
        if (discount.usageCount === undefined) discount.usageCount = 0;
        if (discount.totalSaved === undefined) discount.totalSaved = 0;

        if (discountCodes.some(d => d.id === discount.id)) {
            await updateDiscountCode(discount);
        } else {
            if (discountCodes.some(d => d.code === discount.code)) {
                return alert(t('admin.code_exists'));
            }
            await addDiscountCode(discount);
        }
        setIsDiscountModalOpen(false);
    };

    const confirmDelete = async () => {
        if (deleteTarget) {
            await deleteDiscountCode(deleteTarget);
            setDeleteTarget(null);
        }
    };

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-primary">{t('admin.discounts')}</h2>
                <button 
                    onClick={() => { 
                        setEditingDiscount({ 
                            id: '', 
                            type: DiscountType.PERCENTAGE, 
                            value: 0, 
                            enabled: true, 
                            minOrderValue: 0, 
                            maxUsage: 0, 
                            isStackable: false,
                            applicableCategories: [] 
                        }); 
                        setIsDiscountModalOpen(true); 
                    }} 
                    className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"
                >
                    <Plus size={16} className="mr-2"/> {t('admin.add_discount')}
                </button>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="min-w-full divide-y">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                        <tr>
                            <th className="px-6 py-4 text-left">{t('discount.code')}</th>
                            <th className="px-6 py-4 text-left">{t('admin.value')}</th>
                            <th className="px-6 py-4 text-left">{t('admin.validity')}</th>
                            <th className="px-6 py-4 text-center">{t('common.status')}</th>
                            <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                        {discountCodes.map(d => (
                            <tr key={d.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-mono font-bold">{d.code}</td>
                                <td className="px-6 py-4">{d.value} {d.type === DiscountType.PERCENTAGE ? '%' : 'Kč'}</td>
                                <td className="px-6 py-4">{d.validFrom || '∞'} - {d.validTo || '∞'}</td>
                                <td className="px-6 py-4 text-center">
                                    {d.enabled ? <span className="text-green-500 font-bold">{t('common.active')}</span> : <span className="text-red-500">{t('common.inactive')}</span>}
                                </td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                    <button onClick={() => { setEditingDiscount(d); setIsDiscountModalOpen(true); }} className="p-1 hover:text-primary"><Edit size={16}/></button>
                                    <button onClick={() => setDeleteTarget(d.id)} className="p-1 hover:text-red-500 text-gray-400"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                        {discountCodes.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-gray-400">Žádné slevové kódy.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {deleteTarget && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-lg font-bold mb-2">{t('confirm.delete_title')}</h3>
                        <p className="text-sm text-gray-500 mb-6">{t('confirm.delete_message')}</p>
                        <div className="flex gap-2">
                            <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 bg-gray-100 rounded">{t('common.cancel')}</button>
                            <button onClick={confirmDelete} className="flex-1 py-2 bg-red-600 text-white rounded">{t('common.delete')}</button>
                        </div>
                    </div>
                </div>
            )}

            {isDiscountModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={saveDiscount} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h3 className="font-bold text-lg">{editingDiscount?.id ? t('admin.edit_discount') : t('admin.add_discount')}</h3>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">{t('discount.code')}</label>
                            <input required className="w-full border rounded p-2 uppercase" value={editingDiscount?.code || ''} onChange={e => setEditingDiscount({...editingDiscount, code: e.target.value.toUpperCase()})} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.type')}</label>
                                <select className="w-full border rounded p-2" value={editingDiscount?.type} onChange={e => setEditingDiscount({...editingDiscount, type: e.target.value as DiscountType})}>
                                    <option value={DiscountType.PERCENTAGE}>%</option>
                                    <option value={DiscountType.FIXED}>Kč</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.value')}</label>
                                <input type="number" required className="w-full border rounded p-2" value={editingDiscount?.value || ''} onChange={e => setEditingDiscount({...editingDiscount, value: Number(e.target.value)})} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.min_order_val')} (Kč)</label>
                                <input type="number" className="w-full border rounded p-2" value={editingDiscount?.minOrderValue || ''} onChange={e => setEditingDiscount({...editingDiscount, minOrderValue: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.limit_usage')} (ks)</label>
                                <input type="number" className="w-full border rounded p-2" value={editingDiscount?.maxUsage || ''} onChange={e => setEditingDiscount({...editingDiscount, maxUsage: Number(e.target.value)})} placeholder="0 = ∞" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.valid_from')}</label>
                                <input type="date" className="w-full border rounded p-2" value={editingDiscount?.validFrom || ''} onChange={e => setEditingDiscount({...editingDiscount, validFrom: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.valid_to')}</label>
                                <input type="date" className="w-full border rounded p-2" value={editingDiscount?.validTo || ''} onChange={e => setEditingDiscount({...editingDiscount, validTo: e.target.value})} />
                            </div>
                        </div>
                        
                        <div className="border p-3 rounded-lg">
                            <label className="text-xs font-bold text-gray-400 block mb-2">{t('admin.applicable_cats')}</label>
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
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={editingDiscount?.enabled ?? true} 
                                    onChange={e => setEditingDiscount({...editingDiscount, enabled: e.target.checked})} 
                                    className="rounded text-accent"
                                /> 
                                {t('common.active')}
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={editingDiscount?.isStackable ?? false} 
                                    onChange={e => setEditingDiscount({...editingDiscount, isStackable: e.target.checked})} 
                                    className="rounded text-accent"
                                /> 
                                {t('admin.stackable')}
                            </label>
                            <label className="flex items-center gap-2 text-sm font-bold text-purple-700 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={editingDiscount?.isEventOnly ?? false} 
                                    onChange={e => setEditingDiscount({...editingDiscount, isEventOnly: e.target.checked})} 
                                    className="rounded text-purple-600 focus:ring-purple-600"
                                /> 
                                Jen na akční zboží (Event)
                            </label>
                        </div>
                        <div className="flex gap-2 pt-4">
                            <button type="button" onClick={() => setIsDiscountModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded hover:bg-gray-200 transition">{t('common.cancel')}</button>
                            <button type="submit" className="flex-1 py-2 bg-primary text-white rounded hover:bg-gray-800 transition">{t('common.save')}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};