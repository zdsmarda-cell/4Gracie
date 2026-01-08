
import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus } from '../../types';
import { Pagination } from '../../components/Pagination';
import { MultiSelect } from '../../components/MultiSelect';
import { FileText, Check, X, Filter } from 'lucide-react';

interface OrdersTabProps {
    initialDate?: string | null;
    initialEventOnly?: boolean;
    onClearFilters?: () => void;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({ initialDate, initialEventOnly, onClearFilters }) => {
    const { searchOrders, t, updateOrderStatus, formatDate } = useStore();
    
    const [displayOrders, setDisplayOrders] = useState<Order[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [totalPages, setTotalPages] = useState(1);

    // Filters
    const [filters, setFilters] = useState({
        id: '',
        dateFrom: initialDate || '',
        dateTo: initialDate || '',
        status: '', // Comma separated string
        customer: '',
        isEvent: initialEventOnly ? 'yes' : 'all', // 'all', 'yes', 'no'
        isPaid: 'all' // 'all', 'yes', 'no'
    });

    const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
    const [notifyCustomer, setNotifyCustomer] = useState(false);

    // Sync props to state if they change (e.g. navigation from other tabs)
    useEffect(() => {
        if (initialDate || initialEventOnly) {
            setFilters(prev => ({
                ...prev,
                dateFrom: initialDate || prev.dateFrom,
                dateTo: initialDate || prev.dateTo,
                isEvent: initialEventOnly ? 'yes' : prev.isEvent
            }));
            setCurrentPage(1);
        }
    }, [initialDate, initialEventOnly]);

    const loadData = useCallback(async () => {
        setIsLoadingOrders(true);
        try {
            const res = await searchOrders({
                page: currentPage,
                limit: limit,
                ...filters
            });
            setDisplayOrders(res.orders);
            setTotalRecords(res.total);
            setTotalPages(res.pages);
        } catch (error) {
            console.error("LoadData Error:", error);
        } finally {
            setIsLoadingOrders(false);
        }
    }, [currentPage, limit, filters, searchOrders]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1);
    };

    const handleBulkStatusChange = async (status: OrderStatus) => {
        if (!status || selectedOrders.length === 0) return;
        if (confirm(`Opravdu změnit stav ${selectedOrders.length} objednávek na ${status}?`)) {
            await updateOrderStatus(selectedOrders, status, notifyCustomer);
            setSelectedOrders([]);
            loadData();
        }
    };

    const exportToAccounting = () => {
        // Implement export logic or reuse global one
        alert("Export feature placeholder");
    };

    // Prepare status options for MultiSelect
    const statusOptions = Object.values(OrderStatus).map(s => ({
        value: s,
        label: t(`status.${s}`)
    }));

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between mb-4">
                <button onClick={exportToAccounting} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-xs font-bold flex items-center shadow-sm">
                    <FileText size={16} className="mr-2 text-green-600" /> {t('admin.export')}
                </button>
                
                {selectedOrders.length > 0 && (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-accent/10 px-3 py-1 rounded-lg border border-accent/20">
                            <span className="text-[10px] font-bold text-primary mr-3">{t('admin.orders')}: {selectedOrders.length}</span>
                            <select className="text-[10px] border rounded bg-white p-1 mr-2" onChange={e => handleBulkStatusChange(e.target.value as OrderStatus)}>
                                <option value="">{t('admin.status_update')}...</option>
                                {Object.values(OrderStatus).map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
                            </select>
                        </div>
                        <label className="flex items-center space-x-2 text-xs font-bold cursor-pointer select-none bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">
                            <input type="checkbox" checked={notifyCustomer} onChange={e => setNotifyCustomer(e.target.checked)} className="rounded text-accent" />
                            <span>{t('admin.notify_customer')}</span>
                        </label>
                    </div>
                )}
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border shadow-sm grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">ID</label>
                    <input type="text" className="w-full border rounded p-2 text-xs" placeholder="Filtr ID" value={filters.id} onChange={e => handleFilterChange('id', e.target.value)} />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Datum Od</label>
                    <input type="date" className="w-full border rounded p-2 text-xs" value={filters.dateFrom} onChange={e => handleFilterChange('dateFrom', e.target.value)} />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Datum Do</label>
                    <input type="date" className="w-full border rounded p-2 text-xs" value={filters.dateTo} onChange={e => handleFilterChange('dateTo', e.target.value)} />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Zákazník</label>
                    <input type="text" className="w-full border rounded p-2 text-xs" placeholder="Jméno" value={filters.customer} onChange={e => handleFilterChange('customer', e.target.value)} />
                </div>
                <div>
                    <MultiSelect 
                        label="Stav"
                        options={statusOptions}
                        selectedValues={filters.status ? filters.status.split(',') : []}
                        onChange={(values) => handleFilterChange('status', values.join(','))}
                    />
                </div>
                <div className="flex items-end gap-2">
                    <button onClick={() => {
                        setFilters({ id: '', dateFrom: '', dateTo: '', status: '', customer: '', isEvent: 'all', isPaid: 'all' });
                        setCurrentPage(1);
                        if(onClearFilters) onClearFilters();
                    }} className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center mb-2">
                        <X size={14} className="mr-1"/> Zrušit
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <tr>
                            <th className="px-6 py-4 text-center">
                                <input 
                                    type="checkbox" 
                                    onChange={e => setSelectedOrders(e.target.checked ? displayOrders.map(o => o.id) : [])} 
                                    checked={selectedOrders.length === displayOrders.length && displayOrders.length > 0} 
                                />
                            </th>
                            <th className="px-6 py-4 text-left">{t('filter.id')}</th>
                            <th className="px-6 py-4 text-left">{t('common.date')}</th>
                            <th className="px-6 py-4 text-left">{t('filter.customer')}</th>
                            <th className="px-6 py-4 text-left">{t('common.price')} (Kč)</th>
                            <th className="px-6 py-4 text-left">{t('filter.payment')}</th>
                            <th className="px-6 py-4 text-left">{t('filter.status')}</th>
                            <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-[11px]">
                        {isLoadingOrders ? (
                            <tr><td colSpan={8} className="p-8 text-center text-gray-400">Načítám data...</td></tr>
                        ) : (
                            displayOrders.map(order => (
                                <tr key={order.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedOrders.includes(order.id)} 
                                            onChange={() => setSelectedOrders(prev => prev.includes(order.id) ? prev.filter(x => x !== order.id) : [...prev, order.id])} 
                                        />
                                    </td>
                                    <td className="px-6 py-4 font-bold">{order.id}</td>
                                    <td className="px-6 py-4 font-mono">{formatDate(order.deliveryDate)}</td>
                                    <td className="px-6 py-4">{order.userName}</td>
                                    <td className="px-6 py-4 font-bold">{order.totalPrice + order.packagingFee + (order.deliveryFee || 0)} Kč</td>
                                    <td className="px-6 py-4">
                                        {order.isPaid ? <span className="text-green-600 font-bold">{t('common.paid')}</span> : <span className="text-red-600 font-bold">{t('common.unpaid')}</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${order.status === OrderStatus.CANCELLED ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>
                                            {t(`status.${order.status}`)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {/* Edit Action Placeholder - Pass logic from parent or context if needed */}
                                        <button className="text-blue-600 font-bold hover:underline">{t('common.detail_edit')}</button>
                                    </td>
                                </tr>
                            ))
                        )}
                        {!isLoadingOrders && displayOrders.length === 0 && (
                            <tr><td colSpan={8} className="p-8 text-center text-gray-400">Žádné objednávky</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                limit={limit}
                onLimitChange={(l) => { setLimit(l); setCurrentPage(1); }}
                totalItems={totalRecords}
            />
        </div>
    );
};
