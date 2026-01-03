
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';

interface LoadTabProps {
    onNavigateToDate: (date: string) => void;
}

export const LoadTab: React.FC<LoadTabProps> = ({ onNavigateToDate }) => {
    const { orders, dayConfigs, settings, getDailyLoad, t, formatDate } = useStore();
    const [showLoadHistory, setShowLoadHistory] = useState(false);

    const sortedCategories = useMemo(() => [...settings.categories].sort((a, b) => a.order - b.order), [settings.categories]);

    const loadDates = useMemo(() => {
        const dates = new Set<string>();
        orders.forEach(o => dates.add(o.deliveryDate));
        dayConfigs.forEach(c => dates.add(c.date));
        const today = new Date().toISOString().split('T')[0];
        if (!showLoadHistory) {
             return Array.from(dates).filter(d => d >= today).sort();
        }
        return Array.from(dates).sort().reverse();
    }, [orders, dayConfigs, showLoadHistory]);

    const getDayCapacityLimit = (date: string, catId: string) => {
        const config = dayConfigs.find(d => d.date === date);
        return config?.capacityOverrides?.[catId] ?? settings.defaultCapacities[catId] ?? 0;
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
                    <th className="px-6 py-4 text-left w-32">Stav</th>
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
                    
                    return (
                        <tr key={date} className={`hover:bg-gray-50 ${isClosed ? 'bg-red-50' : ''}`}>
                        <td className="px-6 py-4 font-mono font-bold text-sm cursor-pointer hover:text-blue-600 hover:underline" onClick={() => onNavigateToDate(date)}>
                            {formatDate(date)}
                        </td>
                        <td className="px-6 py-4">
                            {isClosed ? 
                            <span className="text-red-600 font-bold uppercase text-[10px]">{t('admin.exception_closed')}</span> 
                            : <span className="text-green-600 font-bold uppercase text-[10px]">Otevřeno</span>
                            }
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
                    <div className="p-8 text-center text-gray-400">Žádná data pro zobrazení</div>
                )}
            </div>
        </div>
    );
};
