
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { OrderStatus } from '../../types';
import { FileSpreadsheet, X, Eye, ListFilter, Zap, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

interface LoadTabProps {
    onNavigateToDate: (date: string) => void;
}

interface ServerLoadSummary {
    category: string | null;
    total_workload: number | string;
    total_overhead: number | string;
    order_count: number;
}

interface ServerLoadDetail {
    category: string | null;
    product_id?: string;
    name: string;
    unit: string;
    total_quantity: number | string;
    product_workload: number | string;
    unit_overhead: number | string;
}

export const LoadTab: React.FC<LoadTabProps> = ({ onNavigateToDate }) => {
    const { dayConfigs, settings, t, formatDate, dataSource, getFullApiUrl, orders, getDailyLoad, products, refreshData } = useStore();
    const [showLoadHistory, setShowLoadHistory] = useState(false);
    const [historyMonth, setHistoryMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    
    // Detail Modal State
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    
    // New state for server data
    const [serverDetails, setServerDetails] = useState<{ summary: ServerLoadSummary[], details: ServerLoadDetail[] } | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // Refresh data on mount (tab click) to ensure load calculation is accurate
    useEffect(() => {
        refreshData();
    }, []);

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);

    // Filter dates to only show those with Activity (Orders) or Exceptions (Config) or Events
    const loadDates = useMemo(() => {
        const dates = new Set<string>();
        dayConfigs.forEach(c => dates.add(c.date));
        if (settings.eventSlots) settings.eventSlots.forEach(s => dates.add(s.date)); // Add Event Slots
        
        orders.forEach(o => {
            // Only include dates with ACTIVE orders
            if (o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.NOT_PICKED_UP) {
                dates.add(o.deliveryDate);
            }
        });
        
        const sorted = Array.from(dates).sort();
        const now = new Date().toISOString().split('T')[0];
        
        if (!showLoadHistory) {
             return sorted.filter(d => d >= now);
        }
        
        // In history mode, filter by selected month
        return sorted.filter(d => d.startsWith(historyMonth)).reverse(); 
    }, [dayConfigs, orders, showLoadHistory, settings, historyMonth]);

    const getDayCapacityLimit = (date: string, catId: string) => {
        const config = dayConfigs.find(d => d.date === date);
        return config?.capacityOverrides?.[catId] ?? settings.defaultCapacities[catId] ?? 0;
    };

    const getEventCapacityLimit = (date: string, catId: string) => {
        const slot = settings.eventSlots?.find(s => s.date === date);
        return slot?.capacityOverrides?.[catId] ?? 0;
    };

    // Fetch details when modal opens
    useEffect(() => {
        if (!selectedDate) {
            setServerDetails(null);
            return;
        }

        setIsLoadingDetails(true);

        if (dataSource === 'api') {
            const url = getFullApiUrl(`/api/admin/stats/load?date=${selectedDate}`);
            
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
            // LOCAL MODE (Preview) - Logic matches StoreContext.getDailyLoad (Global Scope)
            // EXCLUDE Finished orders from calculation
            const relevantOrders = orders.filter(o => 
                o.deliveryDate === selectedDate && 
                o.status !== OrderStatus.CANCELLED &&
                o.status !== OrderStatus.DELIVERED &&
                o.status !== OrderStatus.NOT_PICKED_UP
            );
            
            const summaryMap = new Map<string, ServerLoadSummary>();
            const detailsMap = new Map<string, ServerLoadDetail>();
            
            // Global Trackers per day
            const ccGroups = new Map<string, { maxOverhead: number, maxOverheadCategory: string, hasEvent: boolean }>();
            const usedProductIds = new Set<string>();

            // Initialize Summaries
            settings.categories.forEach(c => {
                summaryMap.set(c.id, { category: c.id, total_workload: 0, total_overhead: 0, order_count: 0 });
            });

            // 1. Pass: Aggregate Data
            relevantOrders.forEach(order => {
                const categoriesInOrder = new Set<string>();
                
                order.items.forEach(item => {
                    const productDef = products.find(p => p.id === item.id);
                    const cat = item.category;
                    const workload = (Number(productDef?.workload) || Number(item.workload) || 0) * item.quantity;
                    const overhead = (Number(productDef?.workloadOverhead) || Number(item.workloadOverhead) || 0);
                    const capCatId = productDef?.capacityCategoryId; 
                    const isEvent = !!productDef?.isEventProduct;

                    if (!summaryMap.has(cat)) {
                        summaryMap.set(cat, { category: cat, total_workload: 0, total_overhead: 0, order_count: 0 });
                    }
                    const sum = summaryMap.get(cat)!;
                    
                    // Add Variable Workload
                    sum.total_workload = Number(sum.total_workload) + workload;

                    // Collect Overheads (Global Scope)
                    if (capCatId) {
                        const group = ccGroups.get(capCatId) || { maxOverhead: 0, maxOverheadCategory: cat, hasEvent: false };
                        if (overhead > group.maxOverhead) {
                            group.maxOverhead = overhead;
                            group.maxOverheadCategory = cat;
                        }
                        if (isEvent) group.hasEvent = true;
                        ccGroups.set(capCatId, group);
                    } else {
                        // Independent Item
                        if (!usedProductIds.has(item.id)) {
                            sum.total_overhead = Number(sum.total_overhead) + overhead;
                            usedProductIds.add(item.id);
                        }
                    }

                    categoriesInOrder.add(cat);

                    // Build Detail Row
                    const detailKey = `${item.id}_${cat}`; 
                    if (!detailsMap.has(detailKey)) {
                        detailsMap.set(detailKey, {
                            category: cat,
                            product_id: item.id,
                            name: item.name,
                            unit: item.unit,
                            total_quantity: 0,
                            product_workload: 0,
                            unit_overhead: overhead
                        });
                    }
                    const det = detailsMap.get(detailKey)!;
                    det.total_quantity = Number(det.total_quantity) + item.quantity;
                    det.product_workload = Number(det.product_workload) + workload;
                });

                categoriesInOrder.forEach(cat => {
                    const sum = summaryMap.get(cat);
                    if (sum) sum.order_count += 1;
                });
            });

            // 2. Pass: Distribute Capacity Group Overheads
            ccGroups.forEach(group => {
                const sum = summaryMap.get(group.maxOverheadCategory);
                if (sum) {
                    sum.total_overhead = Number(sum.total_overhead) + group.maxOverhead;
                }
            });

            setServerDetails({
                summary: Array.from(summaryMap.values()),
                details: Array.from(detailsMap.values())
            });
            setIsLoadingDetails(false);
        }
    }, [selectedDate, dataSource, orders, settings.categories, getFullApiUrl, products]);

    const handleOpenDetail = (date: string) => {
        setSelectedDate(date);
    };

    const handleExportXLS = () => {
        if (!serverDetails || !selectedDate) return;

        const wb = XLSX.utils.book_new();
        const exportRows: any[] = [];
        
        const grouped = serverDetails.details.reduce((acc, item) => {
            const catKey = item.category || 'unknown';
            if (!acc[catKey]) acc[catKey] = [];
            acc[catKey].push(item);
            return acc;
        }, {} as Record<string, ServerLoadDetail[]>);

        Object.keys(grouped).forEach(cat => {
            const sum = serverDetails.summary.find(s => s.category === cat);
            const catName = sortedCategories.find(c => c.id === cat)?.name || cat;
            
            // Header Row
            exportRows.push({ Název: `--- ${catName} ---`, Ks: '', Jednotka: '', 'Pracnost (Suma)': '' });
            
            grouped[cat].forEach(d => {
                exportRows.push({
                    Název: d.name,
                    Ks: d.total_quantity,
                    Jednotka: d.unit,
                    'Pracnost (Suma)': d.product_workload
                });
            });
            
            // Summary Footer
            exportRows.push({ 
                Název: 'CELKEM ZA KATEGORII', 
                Ks: '', 
                Jednotka: '', 
                'Pracnost (Suma)': Number(sum?.total_workload || 0) + Number(sum?.total_overhead || 0) 
            });
            exportRows.push({}); // Spacer
        });

        const ws = XLSX.utils.json_to_sheet(exportRows);
        XLSX.utils.book_append_sheet(wb, ws, "Výroba");
        XLSX.writeFile(wb, `vyroba_${selectedDate}.xlsx`);
    };

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h2 className="text-xl font-bold text-primary">{t('admin.load')}</h2>
                
                <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-xl border">
                    {showLoadHistory && (
                        <div className="flex items-center gap-2 px-2 animate-in slide-in-from-right-2">
                            <Calendar size={14} className="text-gray-400"/>
                            <input 
                                type="month" 
                                className="border rounded p-1 text-xs bg-white focus:ring-accent outline-none"
                                value={historyMonth}
                                onChange={e => setHistoryMonth(e.target.value)}
                            />
                        </div>
                    )}
                    <button 
                        onClick={() => setShowLoadHistory(!showLoadHistory)} 
                        className={`text-xs px-3 py-1.5 rounded-lg font-bold transition ${showLoadHistory ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                    >
                        {showLoadHistory ? t('admin.view_current') : t('admin.view_history')}
                    </button>
                </div>
            </div>
            
            <div className="bg-white rounded-2xl border shadow-sm overflow-x-auto">
                <table className="min-w-full divide-y">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                    <tr>
                        <th className="px-6 py-4 text-left min-w-[120px]">Datum</th>
                        <th className="px-6 py-4 text-left w-32">Stav</th>
                        {sortedCategories.map(cat => (
                            <th key={cat.id} className="px-6 py-4 text-left min-w-[180px]">{cat.name}</th>
                        ))}
                        <th className="px-6 py-4 text-right w-20">Detail</th>
                    </tr>
                </thead>
                <tbody className="divide-y text-xs">
                    {loadDates.map(date => {
                        const { load, eventLoad } = getDailyLoad(date);
                        const dayConfig = dayConfigs.find(d => d.date === date);
                        const isClosed = dayConfig && !dayConfig.isOpen;
                        const eventSlot = settings.eventSlots?.find(s => s.date === date);

                        return (
                            <tr key={date} className={`hover:bg-gray-50 ${isClosed ? 'bg-red-50' : eventSlot ? 'bg-purple-50' : ''}`}>
                                <td className="px-6 py-4 font-mono font-bold text-sm">
                                    {formatDate(date)}
                                </td>
                                <td className="px-6 py-4">
                                    {isClosed ? 
                                        <span className="text-red-600 font-bold uppercase text-[10px]">{t('admin.exception_closed')}</span> 
                                        : eventSlot ? 
                                            <span className="text-purple-600 font-bold uppercase text-[10px] flex items-center"><Zap size={10} className="mr-1"/> AKCE</span> 
                                            : <span className="text-green-600 font-bold uppercase text-[10px]">Otevřeno</span>
                                    }
                                </td>
                                {sortedCategories.map(cat => {
                                    // 1. Standard Capacity
                                    const stdLimit = getDayCapacityLimit(date, cat.id);
                                    const stdCurrent = load[cat.id] || 0;
                                    const stdPercent = stdLimit > 0 ? Math.min(100, (stdCurrent / stdLimit) * 100) : 0;
                                    
                                    // 2. Event Capacity (if slot exists)
                                    const evtLimit = getEventCapacityLimit(date, cat.id);
                                    const evtCurrent = eventLoad[cat.id] || 0;
                                    const evtPercent = evtLimit > 0 ? Math.min(100, (evtCurrent / evtLimit) * 100) : 0;

                                    const getColor = (pct: number) => {
                                        if (pct >= 100) return 'bg-red-500';
                                        if (pct > 80) return 'bg-orange-500';
                                        return 'bg-green-500';
                                    };

                                    return (
                                        <td key={cat.id} className="px-6 py-4 align-middle">
                                            <div className="space-y-2">
                                                {/* Standard Bar */}
                                                <div className="w-full">
                                                    <div className="flex justify-between mb-1">
                                                        <span className="font-mono text-[10px] text-gray-500">Std: {Math.round(stdCurrent)} / {stdLimit}</span>
                                                    </div>
                                                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden w-full">
                                                        <div className={`h-full ${getColor(stdPercent)} transition-all duration-500`} style={{ width: `${stdPercent}%` }}></div>
                                                    </div>
                                                </div>

                                                {/* Event Bar (Only if slot exists for this category) */}
                                                {(eventSlot && evtLimit > 0) && (
                                                     <div className="w-full">
                                                        <div className="flex justify-between mb-1">
                                                            <span className="font-mono text-[10px] text-purple-600 font-bold">Akce: {Math.round(evtCurrent)} / {evtLimit}</span>
                                                        </div>
                                                        <div className="h-1.5 bg-purple-200 rounded-full overflow-hidden w-full">
                                                            <div className={`h-full bg-purple-600 transition-all duration-500`} style={{ width: `${evtPercent}%` }}></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                                <td className="px-6 py-4 text-right">
                                    <div className="flex gap-2 justify-end">
                                        <button 
                                            onClick={() => onNavigateToDate(date)} 
                                            className="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-blue-600 transition" 
                                            title="Zobrazit objednávky"
                                        >
                                            <ListFilter size={16}/>
                                        </button>
                                        <button 
                                            onClick={() => handleOpenDetail(date)} 
                                            className="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-purple-600 transition" 
                                            title="Detail výroby"
                                        >
                                            <Eye size={16}/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                </table>
                {loadDates.length === 0 && (
                    <div className="p-8 text-center text-gray-400">Žádná data pro zobrazení</div>
                )}
            </div>

            {/* DETAIL MODAL */}
            {selectedDate && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedDate(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <div>
                                <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                                    Detail výroby: <span className="font-mono">{formatDate(selectedDate)}</span>
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    Detailní rozpad pracnosti a surovin pro vybraný den (pouze aktivní objednávky).
                                </p>
                            </div>
                            <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500"><X size={20}/></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-grow bg-white">
                            {isLoadingDetails ? (
                                <div className="text-center py-12 text-gray-400">Načítám data...</div>
                            ) : serverDetails ? (
                                <div className="space-y-8">
                                    {sortedCategories.map(cat => {
                                        const summary = serverDetails.summary.find(s => s.category === cat.id);
                                        const catDetails = serverDetails.details.filter(d => d.category === cat.id);
                                        
                                        if (!summary && catDetails.length === 0) return null;

                                        return (
                                            <div key={cat.id} className="border rounded-xl overflow-hidden">
                                                <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
                                                    <h4 className="font-bold text-sm text-gray-800">{cat.name}</h4>
                                                    <div className="text-xs font-mono text-gray-500">
                                                        Celkem pracnost: <strong className="text-primary">{Number(summary?.total_workload || 0) + Number(summary?.total_overhead || 0)}</strong>
                                                    </div>
                                                </div>
                                                <table className="min-w-full divide-y divide-gray-100">
                                                    <thead className="bg-white text-[10px] font-bold text-gray-400 uppercase">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left">Produkt</th>
                                                            <th className="px-4 py-2 text-center">Množství</th>
                                                            <th className="px-4 py-2 text-right">Pracnost (Suma)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50 text-xs">
                                                        {catDetails.map((item, idx) => (
                                                            <tr key={idx} className="hover:bg-gray-50">
                                                                <td className="px-4 py-2 font-medium">{item.name}</td>
                                                                <td className="px-4 py-2 text-center">
                                                                    <span className="font-bold">{item.total_quantity}</span> <span className="text-gray-400">{item.unit}</span>
                                                                </td>
                                                                <td className="px-4 py-2 text-right font-mono">
                                                                    {item.product_workload}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {Number(summary?.total_overhead) > 0 && (
                                                            <tr className="bg-yellow-50/50">
                                                                <td className="px-4 py-2 font-bold text-yellow-700">Režie přípravy (Overhead)</td>
                                                                <td className="px-4 py-2 text-center">-</td>
                                                                <td className="px-4 py-2 text-right font-mono text-yellow-700 font-bold">{summary?.total_overhead}</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    })}
                                    
                                    {(!serverDetails.details || serverDetails.details.length === 0) && (
                                        <div className="text-center text-gray-400 py-8">Žádná výroba pro tento den.</div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-red-400">Chyba při načítání dat.</div>
                            )}
                        </div>

                        <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex justify-between items-center">
                            <span className="text-xs text-gray-400">Data jsou agregována z aktivních objednávek.</span>
                            <button 
                                onClick={handleExportXLS} 
                                disabled={!serverDetails || serverDetails.details.length === 0}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700 transition flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FileSpreadsheet size={16} className="mr-2"/> Export XLS
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
