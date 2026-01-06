
import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import { EmailLog } from '../../types';
import { Mail, RefreshCw, AlertCircle, CheckCircle, Clock, Loader2, Filter, X, Eye, Braces } from 'lucide-react';
import { Pagination } from '../../components/Pagination';

interface EmailsTabProps {
    initialRecipient?: string | null;
}

export const EmailsTab: React.FC<EmailsTabProps> = ({ initialRecipient }) => {
    const { getFullApiUrl, dataSource, t } = useStore();
    const [emails, setEmails] = useState<EmailLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [viewingPayload, setViewingPayload] = useState<EmailLog | null>(null);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [totalItems, setTotalItems] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Filters State
    const [filters, setFilters] = useState({
        status: '',
        recipient: '',
        subject: '',
        dateFrom: '',
        dateTo: ''
    });

    // Apply initial prop
    useEffect(() => {
        if (initialRecipient) {
            setFilters(prev => ({ ...prev, recipient: initialRecipient }));
        }
    }, [initialRecipient]);

    const loadEmails = useCallback(async () => {
        if (dataSource !== 'api') return;
        setIsLoading(true);
        try {
            const queryParams = new URLSearchParams({
                page: currentPage.toString(),
                limit: itemsPerPage.toString(),
                ...filters
            });

            const url = getFullApiUrl(`/api/admin/emails?${queryParams.toString()}`);
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.success) {
                setEmails(data.emails);
                setTotalItems(data.total);
                setTotalPages(data.pages);
            }
        } catch (e) {
            console.error("Failed to load emails", e);
        } finally {
            setIsLoading(false);
        }
    }, [dataSource, getFullApiUrl, currentPage, itemsPerPage, filters]);

    // Refresh on filter/page change
    useEffect(() => {
        loadEmails();
    }, [loadEmails]);

    // Auto-refresh interval (only if on first page and no complex text filters for UX)
    useEffect(() => {
        const interval = setInterval(() => {
            if (currentPage === 1 && !filters.recipient && !filters.subject) {
                loadEmails();
            }
        }, 15000);
        return () => clearInterval(interval);
    }, [loadEmails, currentPage, filters]);

    const handleRetry = async () => {
        if (selectedIds.length === 0) return;
        try {
            const res = await fetch(getFullApiUrl('/api/admin/emails/retry'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds })
            });
            const data = await res.json();
            if (data.success) {
                setSelectedIds([]);
                loadEmails();
            }
        } catch (e) {
            console.error("Retry failed", e);
        }
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1); // Reset to page 1 on filter change
    };

    const clearFilters = () => {
        setFilters({ status: '', recipient: '', subject: '', dateFrom: '', dateTo: '' });
        setCurrentPage(1);
    };

    const getFormattedPayload = (payload: any) => {
        try {
            const obj = typeof payload === 'string' ? JSON.parse(payload) : payload;
            return JSON.stringify(obj, null, 2);
        } catch (e) {
            return String(payload);
        }
    };

    if (dataSource !== 'api') {
        return <div className="p-8 text-center text-gray-400">Emailová fronta je dostupná pouze v API režimu.</div>;
    }

    const getStatusBadge = (status: string) => {
        switch(status) {
            case 'sent': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-[10px] font-bold flex items-center w-fit"><CheckCircle size={10} className="mr-1"/> Odesláno</span>;
            case 'error': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-[10px] font-bold flex items-center w-fit"><AlertCircle size={10} className="mr-1"/> Chyba</span>;
            case 'processing': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-[10px] font-bold flex items-center w-fit"><Loader2 size={10} className="mr-1 animate-spin"/> Zpracování</span>;
            default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-[10px] font-bold flex items-center w-fit"><Clock size={10} className="mr-1"/> Čeká</span>;
        }
    };

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-primary flex items-center">
                    <Mail className="mr-2 text-accent" /> Fronta emailů
                </h2>
                <div className="flex gap-2">
                    <button 
                        onClick={loadEmails} 
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition" 
                        title="Obnovit"
                    >
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    {selectedIds.length > 0 && (
                        <button 
                            onClick={handleRetry} 
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition"
                        >
                            Znovu odeslat ({selectedIds.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border shadow-sm grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                <div className="col-span-2 md:col-span-1">
                    <label className="text-xs font-bold text-gray-400 block mb-1">Stav</label>
                    <select 
                        className="w-full border rounded p-2 text-xs bg-white"
                        value={filters.status}
                        onChange={e => handleFilterChange('status', e.target.value)}
                    >
                        <option value="">Vše</option>
                        <option value="pending">Čekající</option>
                        <option value="processing">Zpracování</option>
                        <option value="sent">Odeslané</option>
                        <option value="error">Chybné</option>
                    </select>
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
                    <label className="text-xs font-bold text-gray-400 block mb-1">Příjemce</label>
                    <input type="text" className="w-full border rounded p-2 text-xs" placeholder="Email..." value={filters.recipient} onChange={e => handleFilterChange('recipient', e.target.value)} />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Předmět</label>
                    <input type="text" className="w-full border rounded p-2 text-xs" placeholder="Obsahuje..." value={filters.subject} onChange={e => handleFilterChange('subject', e.target.value)} />
                </div>
                <div className="flex items-end">
                    {(filters.status || filters.recipient || filters.subject || filters.dateFrom || filters.dateTo) && (
                        <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center mb-2">
                            <X size={14} className="mr-1"/> Zrušit filtry
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y">
                        <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                            <tr>
                                <th className="px-6 py-4 text-center w-10">
                                    <input 
                                        type="checkbox" 
                                        onChange={e => setSelectedIds(e.target.checked ? emails.map(e => e.id) : [])}
                                        checked={selectedIds.length > 0 && selectedIds.length === emails.length && emails.length > 0}
                                    />
                                </th>
                                <th className="px-6 py-4 text-left">Datum</th>
                                <th className="px-6 py-4 text-left">Příjemce</th>
                                <th className="px-6 py-4 text-left">Předmět</th>
                                <th className="px-6 py-4 text-left">Stav</th>
                                <th className="px-6 py-4 text-left">Info / Chyba</th>
                                <th className="px-6 py-4 text-right">Data</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                            {emails.map(email => (
                                <tr key={email.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedIds.includes(email.id)}
                                            onChange={() => setSelectedIds(prev => prev.includes(email.id) ? prev.filter(id => id !== email.id) : [...prev, email.id])}
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 font-mono whitespace-nowrap">
                                        {new Date(email.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 font-bold">{email.recipient_email}</td>
                                    <td className="px-6 py-4">{email.subject}</td>
                                    <td className="px-6 py-4">{getStatusBadge(email.status)}</td>
                                    <td className="px-6 py-4 text-gray-500 max-w-xs truncate" title={email.error_message || ''}>
                                        {email.error_message ? <span className="text-red-500">{email.error_message}</span> : (email.processed_at ? `Zpracováno: ${new Date(email.processed_at).toLocaleTimeString()}` : '-')}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => setViewingPayload(email)} 
                                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-full transition"
                                            title="Zobrazit Payload"
                                        >
                                            <Eye size={16}/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {emails.length === 0 && (
                                <tr><td colSpan={7} className="p-8 text-center text-gray-400">Žádné záznamy k zobrazení.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                <Pagination 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    limit={itemsPerPage}
                    onLimitChange={(l) => { setItemsPerPage(l); setCurrentPage(1); }}
                    totalItems={totalItems}
                />
            </div>

            {/* Payload Modal */}
            {viewingPayload && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setViewingPayload(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Braces className="text-accent"/> 
                                Data emailu #{viewingPayload.id}
                            </h3>
                            <button onClick={() => setViewingPayload(null)} className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500"><X size={20}/></button>
                        </div>
                        <div className="p-0 overflow-auto bg-slate-900 text-slate-100 flex-grow font-mono text-xs">
                            <pre className="p-6">
                                <code>{getFormattedPayload(viewingPayload.payload)}</code>
                            </pre>
                        </div>
                        <div className="p-4 border-t bg-gray-50 rounded-b-2xl text-right">
                            <button onClick={() => setViewingPayload(null)} className="bg-white border text-gray-700 px-6 py-2 rounded-lg font-bold text-sm hover:bg-gray-100 transition shadow-sm">Zavřít</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
