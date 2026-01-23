
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { DiscountCode, DiscountType } from '../../types';
import { Plus, Edit, Trash2, AlertCircle, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';

export const DiscountsTab: React.FC = () => {
    const { discountCodes, addDiscountCode, updateDiscountCode, deleteDiscountCode, settings, t } = useStore();
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
    const [editingDiscount, setEditingDiscount] = useState<Partial<DiscountCode> | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);

    const saveDiscount = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationErrors({});
        if (!editingDiscount) return;
        
        const discount = { ...editingDiscount } as DiscountCode;
        if (!discount.id) discount.id = Date.now().toString();
        
        // Defaults
        if (discount.isStackable === undefined) discount.isStackable = false;
        if (discount.enabled === undefined) discount.enabled = true;
        if (discount.maxUsage === undefined) discount.maxUsage = 0;
        if (discount.minOrderValue === undefined) discount.minOrderValue = 0;
        if (discount.usageCount === undefined) discount.usageCount = 0;
        if (discount.totalSaved === undefined) discount.totalSaved = 0;

        // Validation
        const errors: Record<string, string> = {};
        if (!discount.code) {
            errors.code = t('admin.fill_code');
        }
        if (discount.value === undefined || discount.value <= 0) {
            errors.value = t('validation.required');
        }

        // Check duplicates (only for new codes or if code changed)
        const isNew = !discountCodes.some(d => d.id === discount.id);
        if (isNew && discountCodes.some(d => d.code.toUpperCase() === discount.code.toUpperCase())) {
            errors.code = t('admin.code_exists');
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }

        if (!isNew) {
            await updateDiscountCode(discount);
        } else {
            await addDiscountCode(discount);
        }
        setIsDiscountModalOpen(false);
    };

    const confirmDelete = async () => {
        if (deleteTarget) {
            setIsDeleting(true);
            const success = await deleteDiscountCode(deleteTarget);
            setIsDeleting(false);
            
            if (success) {
                setDeleteTarget(null);
                setDeleteError(null);
            } else {
                // If API call fails (returns false), show inline error instead of closing
                setDeleteError("Tento slevový kód nelze smazat, protože již byl použit v jedné nebo více objednávkách.");
            }
        }
    };

    const openDeleteModal = (id: string) => {
        setDeleteTarget(id);
        setDeleteError(null);
    };

    const openModal = (discount?: Partial<DiscountCode>) => {
        setValidationErrors({});
        setEditingDiscount(discount || { 
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
    };

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-primary">{t('admin.discounts')}</h2>
                <button 
                    onClick={() => openModal()} 
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
                                    <button onClick={() => openModal(d)} className="p-1 hover:text-primary"><Edit size={16}/></button>
                                    <button onClick={() => openDeleteModal(d.id)} className="p-1 hover:text-red-500 text-gray-400"><Trash2 size={16}/></button>
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
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        {deleteError ? (
                            <div className="text-center">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto text-red-600">
                                    <AlertTriangle size={24} />
                                </div>
                                <h3 className="text-lg font-bold mb-2 text-gray-900">{t('error.delete_title')}</h3>
                                <div className="bg-red-50 p-4 rounded-xl mb-6 text-xs text-red-700 font-bold border border-red-100">
                                    {deleteError}
                                </div>
                                <button 
                                    onClick={() => setDeleteTarget(null)} 
                                    className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold flex items-center justify-center transition"
                                >
                                    <ArrowLeft size={16} className="mr-2"/> Zpět
                                </button>
                            </div>
                        ) : (
                            <>
                                <h3 className="text-lg font-bold mb-2">{t('confirm.delete_title')}</h3>
                                <p className="text-sm text-gray-500 mb-6">{t('confirm.delete_message')}</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="flex-1 py-2 bg-gray-100 rounded disabled:opacity-50">{t('common.cancel')}</button>
                                    <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 py-2 bg-red-600 text-white rounded disabled:opacity-50 flex justify-center items-center">
                                        {isDeleting ? <Loader2 className="animate-spin" size={16}/> : t('common.delete')}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {isDiscountModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <form onSubmit={saveDiscount} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h3 className="font-bold text-lg">{editingDiscount?.id ? t('admin.edit_discount') : t('admin.add_discount')}</h3>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">
                                {t('discount.code')} {validationErrors.code && <span className="text-red-500">*</span>}
                            </label>
                            <input 
                                className={`w-full border rounded p-2 uppercase ${validationErrors.code ? 'border-red-500 bg-red-50' : ''}`}
                                value={editingDiscount?.code || ''} 
                                onChange={e => {
                                    setEditingDiscount({...editingDiscount, code: e.target.value.toUpperCase()});
                                    setValidationErrors({...validationErrors, code: ''});
                                }} 
                            />
                            {validationErrors.code && (
                                <div className="flex items-center mt-1 text-red-500 text-xs font-bold">
                                    <AlertCircle size={12} className="mr-1"/> {validationErrors.code}
                                </div>
                            )}
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
                                <label className="text-xs font-bold text-gray-400 block mb-1">
                                    {t('admin.value')} {validationErrors.value && <span className="text-red-500">*</span>}
                                </label>
                                <input 
                                    type="number" 
                                    className={`w-full border rounded p-2 ${validationErrors.value ? 'border-red-500 bg-red-50' : ''}`}
                                    value={editingDiscount?.value || ''} 
                                    onChange={e => {
                                        setEditingDiscount({...editingDiscount, value: Number(e.target.value)});
                                        setValidationErrors({...validationErrors, value: ''});
                                    }} 
                                />
                                {validationErrors.value && (
                                    <div className="text-red-500 text-[10px] mt-1">{validationErrors.value}</div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.min_order_val')} (Kč)</label>
                                <input type="number" className="w-full border rounded p-2" value={editingDiscount?.minOrderValue || ''} onChange={e => setEditingDiscount({...editingDiscount, minOrderValue: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.limit_usage')} (ks)</label>
                                <input type="number" className="w-full border rounded p-2" value={editingDiscount?.maxUsage || ''} onChange={e => setEditingDiscount({...editingDiscount, maxUsage: Number(e.target.value)})} placeholder="0 = neomezeně" />
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
