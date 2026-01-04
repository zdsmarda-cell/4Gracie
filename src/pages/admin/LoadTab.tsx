
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { OrderStatus } from '../../types';
import { FileSpreadsheet, X, Eye, ListFilter } from 'lucide-react';
import * as XLSX from 'xlsx';

interface LoadTabProps {
    onNavigateToDate: (date: string) => void;
}

interface ServerLoadSummary {
    category: string;
    total_workload: number;
    total_overhead: number;
    order_count: number;
}

interface ServerLoadDetail {
    category: string;
    name: string;
    unit: string;
    total_quantity: number;
    product_workload: number;
    unit_overhead: number;
}

export const LoadTab: React.FC<LoadTabProps> = ({ onNavigateToDate }) => {
    const { dayConfigs, settings, t, formatDate, dataSource, getFullApiUrl, orders, getDailyLoad } = useStore();
    const [showLoadHistory, setShowLoadHistory] = useState(false);
    
    // Detail Modal State
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    
    // New state for server data
    const [serverDetails, setServerDetails] = useState<{ summary: ServerLoadSummary[], details: ServerLoadDetail[] } | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);

    // Filter dates to only show those with Activity (Orders) or Exceptions (Config)
    const loadDates = useMemo(() => {
        const dates = new Set<string>();
        
        // 1. Add dates from configured exceptions (Manual blocks/opens)
        dayConfigs.forEach(c => dates.add(c.date));
        
        // 2. Add dates from active orders
        orders.forEach(o => {
            if (o.status !== OrderStatus.CANCELLED) {
                dates.add(o.deliveryDate);
            }
        });
        
        const sorted = Array.from(dates).sort();
        const now = new Date().toISOString().split('T')[0];
        
        if (!showLoadHistory) {
             return sorted.filter(d => d >= now);
        }
        return sorted.reverse(); // History reversed
    }, [dayConfigs, orders, showLoadHistory]);

    const getDayCapacityLimit = (date: string, catId: string) => {
        const config = dayConfigs.find(d => d.date === date);
        return config?.capacityOverrides?.[catId] ?? settings.defaultCapacities[catId] ?? 0;
    };

    const getActiveOrdersCount = (date: string) => {
        return orders.filter(o => o.deliveryDate === date && o.status !== OrderStatus.CANCELLED).length;
    };

    // Fetch details when modal opens (API or LOCAL calc)
    useEffect(() => {
        if (!selectedDate) {
            setServerDetails(null);
            return;
        }

        setIsLoadingDetails(true);

        if (dataSource === 'api') {
            // API MODE
            const url = getFullApiUrl(`/api/admin/stats/load?date=${selectedDate}`);
            console.log("Fetching stats from:", url);
            
            fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error('API Request failed');
                    return res.json();
                })
                .then(data => {
                    if (data.success) {
                        setServerDetails({ summary: data.summary, details: data.details });
                    } else {
                        console.error("API returned error:", data);
                        setServerDetails({ summary: [], details: [] });
                    }
                })
                .catch(err => {
                    console.error("Fetch error:", err);
                    setServerDetails({ summary: [], details: [] });
                })
                .finally(() => setIsLoadingDetails(false));
        } else {
            // LOCAL MODE (Preview) - Calculate manually from orders context
            const relevantOrders = orders.filter(o => o.deliveryDate === selectedDate && o.status !== OrderStatus.CANCELLED);
            
            const summaryMap = new Map<string, ServerLoadSummary>();
            const detailsMap = new Map<string, ServerLoadDetail>();

            // Initialize summary for all categories
            settings.categories.forEach(c => {
                summaryMap.set(c.id, { category: c.id, total_workload: 0, total_overhead: 0, order_count: 0 });
            });

            relevantOrders.forEach(order => {
                const categoriesInOrder = new Set<string>();
                
                order.items.forEach(item => {
                    const cat = item.category;
                    const workload = (item.workload || 0) * item.quantity;
                    const overhead = (item.workloadOverhead || 0);

                    // Update Summary
                    if (!summaryMap.has(cat)) {
                        summaryMap.set(cat, { category: cat, total_workload: 0, total_overhead: 0, order_count: 0 });
                    }
                    const sum = summaryMap.get(cat)!;
                    sum.total_workload += workload;
                    sum.total_overhead += overhead; // Simplified overhead addition per item for local calc
                    categoriesInOrder.add(cat);

                    // Update Details
                    // We use item.id + cat as key to group same products
                    const detailKey = `${item.id}_${cat}`; 
                    if (!detailsMap.has(detailKey)) {
                        detailsMap.set(detailKey, {
                            category: cat,
                            name: item.name,
                            unit: item.unit,
                            total_quantity: 0,
                            product_workload: 0,
                            unit_overhead: item.workloadOverhead || 0
                        });
                    }
                    const det = detailsMap.get(detailKey)!;
                    det.total_quantity += item.quantity;
                    det.product_workload += workload;
                });

                // Update Order Count per category
                categoriesInOrder.forEach(cat => {
                    const sum = summaryMap.get(cat);
                    if (sum) sum.order_count += 1;
                });
            });

            setServerDetails({
                summary: Array.from(summaryMap.values()),
                details: Array.from(detailsMap.values())
            });
            setIsLoadingDetails(false);
        }
    }, [selectedDate, dataSource, orders, settings.categories, getFullApiUrl]);

    const handleOpenDetail = (date: string) => {
        setSelectedDate(date);
    };

    const handleExportXLS = () => {
        if (!serverDetails || !selectedDate) return;

        const wb = XLSX.utils.book_new();
        const exportRows: any[] = [];
        
        const grouped = serverDetails.details.reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
        }, {} as Record<string, ServerLoadDetail[]>);

        // Safe iteration over keys to avoid unknown type issues with Object.entries
        Object.keys(grouped).forEach(catId => {
            const items = grouped[catId];
            const catName = settings.categories.find(c => c.id === catId)?.name || catId;
            const catSummary = serverDetails.summary.find(s => s.category === catId);
            const totalLoad = (Number(catSummary?.total_workload) || 0) + (Number(catSummary?.total_overhead) || 0);

            exportRows.push({ Název: `KATEGORIE: ${catName} (Celkem pracnost: ${totalLoad})`, Ks: '', Jednotka: '', 'Pracnost (Suma)': '' });
            
            items.forEach(p => {
                exportRows.push({
                    Název: p.name,
                    Ks: p.total_quantity,
                    Jednotka: p.unit,
                    'Pracnost (Suma)': p.product_workload
                });
            });
            exportRows.push({}); 
        });

        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wscols = [{wch: 40}, {wch: 10}, {wch: 10}, {wch: 15}];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Výroba");
        XLSX.writeFile(wb, `vyroba_${selectedDate}.xlsx`);
    };

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-primary">{t('admin.load')}</h2>
                <button onClick={() => setShowLoadHistory(!showLoadHistory)} className="text-xs bg-white border px-3 py-1 rounded hover:bg-gray-50">
                {showLoadHistory ? t('admin.view_current') : t('admin.view_history')}
                </button>
            </div>
            
            <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
                <table className="min-w-full divide-y">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                    <tr>
                    <th className="px-6 py-4 text-left min-w-[120px]">Datum</th>
                    <th className="px-6 py-4 text-center w-16">Detail</th>
                    <th className="px-6 py-4 text-center">Objednávky</th>
                    <th className="px-6 py-4 text-left w-24">Stav</th>
                    {sortedCategories.map(cat => (
                        <th key={cat.id} className="px-6 py-4 text-left min-w-[150px]">{cat.name}</th>
                    ))}
                    </tr>
                </thead>
                <tbody className="divide-y text-xs">
                    {loadDates.map(date => {
                        const load = getDailyLoad(date);
                        const dayConfig = dayConfigs.find(d => d.date === date);
                        const isClosed = dayConfig && !dayConfig.isOpen;
                        const ordersCount = getActiveOrdersCount(date);
                        
                        return (
                            <tr key={date} className={`hover:bg-gray-50 ${isClosed ? 'bg-red-50' : ''}`}>
                                <td className="px-6 py-4 font-mono font-bold text-sm cursor-pointer hover:text-blue-600 hover:underline" onClick={() => onNavigateToDate(date)}>
                                    {formatDate(date)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button onClick={() => handleOpenDetail(date)} className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold hover:bg-blue-200 transition flex items-center justify-center mx-auto"><Eye size={16}/></button>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {ordersCount > 0 ? (
                                        <button 
                                            onClick={() => onNavigateToDate(date)} 
                                            className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-bold text-[10px] hover:bg-purple-200 transition flex items-center justify-center gap-1 mx-auto"
                                            title="Přejít na objednávky"
                                        >
                                            <ListFilter size={12}/> {ordersCount}
                                        </button>
                                    ) : (
                                        <span className="text-gray-300">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {isClosed ? <span className="text-red-600 font-bold uppercase text-[10px]">{t('admin.exception_closed')}</span> : <span className="text-green-600 font-bold uppercase text-[10px]">Otevřeno</span>}
                                </td>
                                {sortedCategories.map(cat => {
                                    const limit = getDayCapacityLimit(date, cat.id);
                                    const current = load[cat.id] || 0;
                                    const percent = limit > 0 ? Math.min(100, (current / limit) * 100) : 0;
                                    let color = 'bg-green-500';
                                    if (percent > 80) color = 'bg-orange-500';
                                    if (percent >= 100) color = 'bg-red-500';
                                    
                                    return (
                                    <td key={cat.id} className="px-6 py-4 align-middle">
                                        <div className="w-full">
                                        <div className="flex justify-between mb-1">
                                            <span className="font-mono text-[10px]">{Math.round(current)} / {limit}</span>
                                            <span className="font-bold text-[10px]">{Math.round(percent)}%</span>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-full border border-gray-100">
                                            <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${percent}%` }}></div>
                                        </div>
                                        </div>
                                    </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
                </table>
                {loadDates.length === 0 && (
                    <div className="p-8 text-center text-gray-400 font-bold">Žádná data pro zobrazení</div>
                )}
            </div>

            {/* DETAIL MODAL */}
            {selectedDate && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[250] p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedDate(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <div>
                                <h2 className="text-xl font-serif font-bold text-primary">Detail výroby: {formatDate(selectedDate)}</h2>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleExportXLS} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center hover:bg-green-700 transition">
                                    <FileSpreadsheet size={16} className="mr-2"/> Export XLS
                                </button>
                                <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={20}/></button>
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-grow space-y-8">
                            {isLoadingDetails ? (
                                <p className="text-center text-gray-400">Načítám data...</p>
                            ) : !serverDetails || serverDetails.details.length === 0 ? (
                                <p className="text-center text-gray-400">Žádná výroba pro tento den (nebo chyba načítání).</p>
                            ) : (
                                settings.categories.map(cat => {
                                    const items = serverDetails.details.filter(d => d.category === cat.id);
                                    if (items.length === 0) return null;
                                    const summary = serverDetails.summary.find(s => s.category === cat.id);
                                    const total = (Number(summary?.total_workload)||0) + (Number(summary?.total_overhead)||0);

                                    return (
                                        <div key={cat.id} className="border rounded-xl overflow-hidden shadow-sm">
                                            <div className="bg-gray-100 p-3 flex justify-between items-center border-b">
                                                <h3 className="font-bold text-sm uppercase text-gray-700">{cat.name}</h3>
                                                <span className="text-xs font-bold bg-white px-2 py-1 rounded border">Celkem pracnost: {total}</span>
                                            </div>
                                            <table className="min-w-full divide-y">
                                                <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left">Název</th>
                                                        <th className="px-4 py-2 text-center">Ks</th>
                                                        <th className="px-4 py-2 text-right">Pracnost</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y text-xs">
                                                    {items.map((p, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50">
                                                            <td className="px-4 py-2 font-bold">{p.name}</td>
                                                            <td className="px-4 py-2 text-center">
                                                                {p.total_quantity} <span className="text-gray-400 text-[10px]">{p.unit}</span>
                                                            </td>
                                                            <td className="px-4 py-2 text-right font-mono">{p.product_workload}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div className="p-4 border-t bg-gray-50 text-right">
                            <button onClick={() => setSelectedDate(null)} className="px-6 py-2 bg-white border rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100 transition">Zavřít</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
