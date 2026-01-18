
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { DiscountCode, DiscountType, OrderStatus } from '../../types';
import { Plus, Edit, Trash2, AlertTriangle, AlertCircle } from 'lucide-react';

const DeleteConfirmModal: React.FC<{
    isOpen: boolean;
    title: string;
    onConfirm: () => void;
    onClose: () => void;
}> = ({ isOpen, title, onConfirm, onClose }) => {
    const { t } = useStore();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <Trash2 size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-sm text-gray-500 mb-6">{t('confirm.delete_message')}</p>
                    <div className="flex gap-3 w-full">
                        <button onClick={onClose} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200 transition">{t('common.cancel')}</button>
                        <button onClick={onConfirm} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition">{t('common.delete')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const DiscountsTab: React.FC = () => {
    const { discountCodes, t, addDiscountCode, updateDiscountCode, deleteDiscountCode, settings, orders } = useStore();
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
    const [editingDiscount, setEditingDiscount] = useState<Partial<DiscountCode> | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ id: string, code: string } | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    
    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);

    // Helper to calculate statistics from orders
    const getCodeStats = (code: string) => {
        const relevantOrders = orders.filter(o => 
            o.status !== OrderStatus.CANCELLED && 
            o.appliedDiscounts?.some(ad => ad.code === code)
        );
        
        const count = relevantOrders.length;
        const totalSaved = relevantOrders.reduce((sum, o) => {
            const discount = o.appliedDiscounts?.find(ad => ad.code === code);
            return sum + (discount ? discount.amount : 0);
        }, 0);

        return { count, totalSaved };
    };

    const saveDiscount = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationErrors({});
        if (!editingDiscount) return;

        const errors: Record<string, string> = {};
        const codeToSave = (editingDiscount.code || '').trim().toUpperCase();
        
        if (!codeToSave) {
            errors.code = t('admin.fill_code');
        }

        // --- VALIDATION START ---
        const val = Number(editingDiscount.value);
        if (isNaN(val)) {
             errors.value = 'Zadejte platnou číselnou hodnotu.';
        } else if (editingDiscount.type === DiscountType.PERCENTAGE) {
            if (val < 1 || val > 100) {
                errors.value = 'Hodnota musí být mezi 1 a 100.';
            }
        } else {
            // Fixed amount check (must be at least 1)
            if (val < 1) {
                errors.value = 'Hodnota slevy musí být alespoň 1 Kč.';
            }
        }
        
        if (Number(editingDiscount.minOrderValue) < 0) {
            errors.minOrderValue = 'Hodnota nesmí být záporná.';
        }
        if (Number(editingDiscount.maxUsage) < 0) {
            errors.maxUsage = 'Hodnota nesmí být záporná.';
        }

        // Check Duplicates
        if (codeToSave) {
            const duplicate = discountCodes.find(d => 
                d.code.toUpperCase() === codeToSave && 
                d.id !== editingDiscount.id
            );
            if (duplicate) {
                errors.code = t('admin.code_exists');
            }
        }
        // --- VALIDATION END ---

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }

        const disc = { ...editingDiscount, code: codeToSave } as DiscountCode;
        if (discountCodes.some(d => d.id === disc.id)) await updateDiscountCode(disc);
        else await addDiscountCode(disc);
        setIsDiscountModalOpen(false);
    };

    const handleDeleteRequest = (id: string, code: string) => {
        const isUsed = orders.some(o => o.appliedDiscounts?.some(ad => ad.code === code));
        
        if (isUsed) {
            alert('Tento slevový kód nelze smazat, protože již byl použit v jedné nebo více objednávkách. Můžete jej pouze deaktivovat.');
            return;
        }

        setConfirmDelete({ id, code });
    };

    const performDelete = async () => {
        if (confirmDelete) {
            await deleteDiscountCode(confirmDelete.id);
            setConfirmDelete(null);
        }
    };

    const openModal = (discount?: Partial<DiscountCode>) => {
        setValidationErrors({});
        setEditingDiscount(discount || { id: Date.now().toString(), enabled: true, type: DiscountType.PERCENTAGE, value: 0 });
        setIsDiscountModalOpen(true);
    };

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-primary">{t('admin.discounts')}</h2>
                <button onClick={() => openModal()} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"><Plus size={16} className="mr-2"/> {t('admin.add_discount')}</button>
            </div>
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="min-w-full divide-y">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                    <tr>
                    <th className="px-6 py-4 text-left">{t('discount.code')}</th>
                    <th className="px-6 py-4 text-left">{t('admin.value')}</th>
                    <th className="px-6 py-4 text-left">{t('admin.validity')}</th>
                    <th className="px-6 py-4 text-center">{t('admin.usage')}</th>
                    <th className="px-6 py-4 text-right">{t('admin.total_saved')}</th>
                    <th className="px-6 py-4 text-center">{t('common.status')}</th>
                    <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y text-xs">
                    {discountCodes.map(d => {
                        const stats = getCodeStats(d.code);
                        return (
                            <tr key={d.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-mono font-bold">{d.code}</td>
                                <td className="px-6 py-4">{d.value} {d.type === DiscountType.PERCENTAGE ? '%' : 'Kč'}</td>
                                <td className="px-6 py-4">{d.validFrom || '∞'} - {d.validTo || '∞'}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className="font-bold">{stats.count}</span>
                                    <span className="text-gray-400"> / {d.maxUsage > 0 ? d.maxUsage : '∞'}</span>
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-green-600">
                                    {stats.totalSaved > 0 ? `-${stats.totalSaved} Kč` : '-'}
                                </td>
                                <td className="px-6 py-4 text-center">{d.enabled ? <span className="text-green-500 font-bold">{t('common.active')}</span> : <span className="text-red-500">{t('common.inactive')}</span>}</td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                <button onClick={() => openModal(d)} className="p-1 hover:text-primary"><Edit size={16}/></button>
                                <button onClick={() => handleDeleteRequest(d.id, d.code)} className="p-1 hover:text-red-500 text-gray-400"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                </table>
            </div>

            <DeleteConfirmModal 
                isOpen={!!confirmDelete} 
                title={`${t('common.delete')} ${confirmDelete?.code}?`} 
                onConfirm={performDelete} 
                onClose={() => setConfirmDelete(null)} 
            />

            {isDiscountModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={saveDiscount} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h3 className="font-bold text-lg">{editingDiscount?.id ? t('admin.edit_discount') : t('admin.add_discount')}</h3>
                        
                        <div>
                            <label className={`text-xs font-bold block mb-1 ${validationErrors.code ? 'text-red-500' : 'text-gray-400'}`}>{t('discount.code')}</label>
                            <input 
                                className={`w-full border rounded p-2 uppercase focus:ring-accent outline-none ${validationErrors.code ? 'border-red-500 bg-red-50' : ''}`} 
                                value={editingDiscount?.code || ''} 
                                onChange={e => {
                                    setEditingDiscount({...editingDiscount, code: e.target.value.toUpperCase()});
                                    setValidationErrors({...validationErrors, code: ''});
                                }}
                                placeholder="např. SLEVA20" 
                            />
                            {validationErrors.code && <p className="text-[10px] text-red-500 mt-1">{validationErrors.code}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.type')}</label>
                                <select className="w-full border rounded p-2" value={editingDiscount?.type} onChange={e => setEditingDiscount({...editingDiscount, type: e.target.value as DiscountType})}>
                                    <option value={DiscountType.PERCENTAGE}>Procenta (%)</option>
                                    <option value={DiscountType.FIXED}>Částka (Kč)</option>
                                </select>
                            </div>
                            <div>
                                <label className={`text-xs font-bold block mb-1 ${validationErrors.value ? 'text-red-500' : 'text-gray-400'}`}>{t('admin.value')}</label>
                                <input 
                                    type="number" 
                                    className={`w-full border rounded p-2 ${validationErrors.value ? 'border-red-500 bg-red-50' : ''}`} 
                                    value={editingDiscount?.value || ''} 
                                    onChange={e => {
                                        setEditingDiscount({...editingDiscount, value: Number(e.target.value)});
                                        setValidationErrors({...validationErrors, value: ''});
                                    }}
                                    max={editingDiscount?.type === DiscountType.PERCENTAGE ? 100 : undefined} 
                                    min="1"
                                    placeholder={editingDiscount?.type === DiscountType.PERCENTAGE ? '1-100' : 'min. 1'}
                                />
                                {validationErrors.value && <p className="text-[10px] text-red-500 mt-1">{validationErrors.value}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className={`text-xs font-bold block mb-1 ${validationErrors.minOrderValue ? 'text-red-500' : 'text-gray-400'}`}>{t('admin.min_order_val')} (Kč)</label>
                                <input type="number" className={`w-full border rounded p-2 ${validationErrors.minOrderValue ? 'border-red-500 bg-red-50' : ''}`} value={editingDiscount?.minOrderValue || ''} onChange={e => {
                                    setEditingDiscount({...editingDiscount, minOrderValue: Number(e.target.value)});
                                    setValidationErrors({...validationErrors, minOrderValue: ''});
                                }} />
                                {validationErrors.minOrderValue && <p className="text-[10px] text-red-500 mt-1">{validationErrors.minOrderValue}</p>}
                            </div>
                            <div>
                                <label className={`text-xs font-bold block mb-1 ${validationErrors.maxUsage ? 'text-red-500' : 'text-gray-400'}`}>{t('admin.limit_usage')} (ks)</label>
                                <input type="number" className={`w-full border rounded p-2 ${validationErrors.maxUsage ? 'border-red-500 bg-red-50' : ''}`} value={editingDiscount?.maxUsage || ''} onChange={e => {
                                    setEditingDiscount({...editingDiscount, maxUsage: Number(e.target.value)});
                                    setValidationErrors({...validationErrors, maxUsage: ''});
                                }} placeholder="0 = neomezeně" />
                                {validationErrors.maxUsage && <p className="text-[10px] text-red-500 mt-1">{validationErrors.maxUsage}</p>}
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
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={editingDiscount?.enabled ?? true} onChange={e => setEditingDiscount({...editingDiscount, enabled: e.target.checked})} /> {t('common.active')}
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={editingDiscount?.isStackable ?? false} onChange={e => setEditingDiscount({...editingDiscount, isStackable: e.target.checked})} /> {t('admin.stackable')}
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
