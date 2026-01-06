
import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import { EmailLog } from '../../types';
import { Mail, RefreshCw, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';

export const EmailsTab: React.FC = () => {
    const { getFullApiUrl, dataSource } = useStore();
    const [emails, setEmails] = useState<EmailLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const loadEmails = useCallback(async () => {
        if (dataSource !== 'api') return;
        setIsLoading(true);
        try {
            const url = getFullApiUrl(`/api/admin/emails?limit=100${statusFilter ? `&status=${statusFilter}` : ''}`);
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setEmails(data.emails);
            }
        } catch (e) {
            console.error("Failed to load emails", e);
        } finally {
            setIsLoading(false);
        }
    }, [dataSource, getFullApiUrl, statusFilter]);

    useEffect(() => {
        loadEmails();
        // Auto-refresh every 10 seconds to see worker progress
        const interval = setInterval(loadEmails, 10000);
        return () => clearInterval(interval);
    }, [loadEmails]);

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
                    <select 
                        className="border rounded-lg p-2 text-xs"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="">Všechny stavy</option>
                        <option value="pending">Čekající</option>
                        <option value="sent">Odeslané</option>
                        <option value="error">Chybné</option>
                    </select>
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

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="min-w-full divide-y">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                        <tr>
                            <th className="px-6 py-4 text-center w-10">
                                <input 
                                    type="checkbox" 
                                    onChange={e => setSelectedIds(e.target.checked ? emails.map(e => e.id) : [])}
                                    checked={selectedIds.length > 0 && selectedIds.length === emails.length}
                                />
                            </th>
                            <th className="px-6 py-4 text-left">Datum vytvoření</th>
                            <th className="px-6 py-4 text-left">Příjemce</th>
                            <th className="px-6 py-4 text-left">Předmět</th>
                            <th className="px-6 py-4 text-left">Stav</th>
                            <th className="px-6 py-4 text-left">Info / Chyba</th>
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
                                <td className="px-6 py-4 text-gray-500 font-mono">
                                    {new Date(email.created_at).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 font-bold">{email.recipient_email}</td>
                                <td className="px-6 py-4">{email.subject}</td>
                                <td className="px-6 py-4">{getStatusBadge(email.status)}</td>
                                <td className="px-6 py-4 text-gray-500 max-w-xs truncate" title={email.error_message || ''}>
                                    {email.error_message ? <span className="text-red-500">{email.error_message}</span> : (email.processed_at ? `Zpracováno: ${new Date(email.processed_at).toLocaleTimeString()}` : '-')}
                                </td>
                            </tr>
                        ))}
                        {emails.length === 0 && (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-400">Žádné záznamy ve frontě.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
