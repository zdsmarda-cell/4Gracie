
import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Smartphone, Send, RotateCcw, Filter, Users, Loader2, CheckSquare, Square, CheckCircle, AlertCircle, Clock, Redo, X } from 'lucide-react';
import { Pagination } from '../../components/Pagination';
import { User } from '../../types';

// New Retry Modal Component
const RetryConfirmModal: React.FC<{
    isOpen: boolean;
    log: any;
    onConfirm: () => void;
    onClose: () => void;
    isLoading: boolean;
}> = ({ isOpen, log, onConfirm, onClose, isLoading }) => {
    if (!isOpen || !log) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <Redo size={20} className="mr-2 text-blue-600"/> Opakovat odeslání
                    </h3>
                    <button onClick={onClose} disabled={isLoading} className="p-1 hover:bg-gray-100 rounded-full"><X size={18}/></button>
                </div>
                
                <div className="bg-gray-50 p-3 rounded-lg text-sm mb-4 border border-gray-100">
                    <p className="font-bold text-gray-700 mb-1">{log.title}</p>
                    <p className="text-gray-500 mb-2">{log.body}</p>
                    <div className="text-xs text-gray-400 border-t pt-2 mt-2">
                        Příjemce: <strong>{log.user_name || 'Neznámý'}</strong> ({log.user_email})
                    </div>
                </div>

                <p className="text-xs text-gray-500 mb-6">
                    Notifikace bude odeslána znovu na všechna aktivní zařízení tohoto uživatele. Stav záznamu v historii bude aktualizován.
                </p>

                <div className="flex gap-3">
                    <button onClick={onClose} disabled={isLoading} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200 transition">Zrušit</button>
                    <button onClick={onConfirm} disabled={isLoading} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition flex justify-center items-center">
                        {isLoading ? <Loader2 size={16} className="animate-spin"/> : 'Odeslat znovu'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const MobileNotificationsTab: React.FC = () => {
    const { getFullApiUrl, dataSource, searchUsers, t } = useStore();
    
    // --- HISTORY STATE ---
    const [history, setHistory] = useState<any[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    
    // --- RETRY STATE ---
    const [retryLog, setRetryLog] = useState<any>(null);
    const [isRetrying, setIsRetrying] = useState(false);

    // --- FORM STATE ---
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [isSending, setIsSending] = useState(false);

    // --- TARGETING STATE ---
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isUsersLoading, setIsUsersLoading] = useState(false);
    const [filters, setFilters] = useState({
        search: '',
        zip: '',
        marketing: 'all' as 'all' | 'yes' | 'no'
    });
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadHistory();
        loadAllUsers();
    }, [page]);

    const loadHistory = async () => {
        if (dataSource !== 'api') return;
        setIsHistoryLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(getFullApiUrl(`/api/notifications/history?page=${page}&limit=20`), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setHistory(data.notifications);
                setTotalPages(data.pages);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const loadAllUsers = async () => {
        setIsUsersLoading(true);
        try {
            // Fetch users WITH PUSH SUBSCRIPTION
            const users = await searchUsers({ search: '', hasPush: 'true' }); 
            setAllUsers(users);
        } catch(e) {
            console.error(e);
        } finally {
            setIsUsersLoading(false);
        }
    };

    // Filter Users Logic
    const filteredUsers = useMemo(() => {
        return allUsers.filter(u => {
            // Text Search (Name/Email)
            if (filters.search) {
                const term = filters.search.toLowerCase();
                if (!u.name.toLowerCase().includes(term) && !u.email.toLowerCase().includes(term)) return false;
            }
            // Marketing
            if (filters.marketing === 'yes' && !u.marketingConsent) return false;
            if (filters.marketing === 'no' && u.marketingConsent) return false;
            
            // ZIP Check (Delivery OR Billing)
            if (filters.zip) {
                const zips = filters.zip.split(',').map(z => z.trim().replace(/\s/g, ''));
                const userZips = [
                    ...u.deliveryAddresses.map(a => a.zip.replace(/\s/g, '')), 
                    ...u.billingAddresses.map(a => a.zip.replace(/\s/g, ''))
                ];
                // Check if any user ZIP matches any filter ZIP (partial match for flexibility)
                const hasMatch = zips.some(filterZip => userZips.some(uz => uz.includes(filterZip)));
                if (!hasMatch) return false;
            }

            return true;
        });
    }, [allUsers, filters]);

    // Selection Handlers
    const toggleUser = (id: string) => {
        const newSet = new Set(selectedUserIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedUserIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0) {
            setSelectedUserIds(new Set());
        } else {
            const newSet = new Set(selectedUserIds);
            filteredUsers.forEach(u => newSet.add(u.id));
            setSelectedUserIds(newSet);
        }
    };

    const getUserZipsString = (u: User) => {
        const allZips = new Set([
            ...u.deliveryAddresses.map(a => a.zip),
            ...u.billingAddresses.map(a => a.zip)
        ]);
        return Array.from(allZips).join(', ');
    };

    const handleSend = async () => {
        if (!subject || !body) return alert('Vyplňte předmět a text.');
        if (selectedUserIds.size === 0) return alert('Vyberte alespoň jednoho příjemce.');
        if (dataSource !== 'api') return alert('Dostupné pouze v API režimu.');

        setIsSending(true);
        const targetIds = Array.from(selectedUserIds);

        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(getFullApiUrl('/api/notifications/send'), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ 
                    subject, 
                    body,
                    targetUserIds: targetIds // Send explicit list
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Odesláno na ${data.count} zařízení.`);
                setSubject('');
                setBody('');
                setSelectedUserIds(new Set());
                loadHistory();
            } else {
                alert('Chyba: ' + (data.error || 'Neznámá chyba'));
            }
        } catch (e) {
            console.error(e);
            alert('Chyba při odesílání.');
        } finally {
            setIsSending(false);
        }
    };

    const handleRetry = async () => {
        if (!retryLog) return;
        setIsRetrying(true);
        
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(getFullApiUrl('/api/notifications/retry'), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ logId: retryLog.id })
            });
            const data = await res.json();
            
            if (data.success) {
                setRetryLog(null);
                loadHistory(); // Refresh table to show new status
            } else {
                alert('Chyba: ' + (data.error || 'Nepodařilo se odeslat.'));
                // Refresh anyway to show error status if updated in DB
                loadHistory();
            }
        } catch (e: any) {
            console.error(e);
            alert('Chyba při komunikaci se serverem.');
        } finally {
            setIsRetrying(false);
        }
    };

    if (dataSource !== 'api') return <div className="p-8 text-center text-gray-400">Dostupné pouze s databází.</div>;

    return (
        <div className="animate-fade-in space-y-8">
            
            {/* COMPOSER & TARGETING */}
            <div className="grid lg:grid-cols-2 gap-8">
                {/* 1. MESSAGE COMPOSER */}
                <div className="bg-white p-6 rounded-2xl border shadow-sm h-fit">
                    <h3 className="text-lg font-bold text-primary mb-4 flex items-center">
                        <Send className="mr-2 text-accent" size={20}/> Obsah zprávy
                    </h3>
                    <div className="space-y-4">
                        <input 
                            className="w-full border rounded-xl p-3 text-sm focus:ring-accent outline-none font-bold" 
                            placeholder="Předmět / Nadpis (např. Akce na víkend)" 
                            value={subject} 
                            onChange={e => setSubject(e.target.value)} 
                        />
                        <textarea 
                            className="w-full border rounded-xl p-3 text-sm h-32 focus:ring-accent outline-none resize-none" 
                            placeholder="Text zprávy..." 
                            value={body} 
                            onChange={e => setBody(e.target.value)} 
                        />
                        <div className="flex justify-between items-center pt-2">
                            <div className="text-xs text-gray-500">
                                Vybráno příjemců: <strong className="text-primary text-lg">{selectedUserIds.size}</strong>
                            </div>
                            <button 
                                onClick={handleSend} 
                                disabled={isSending || !subject || !body || selectedUserIds.size === 0}
                                className="bg-accent text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center"
                            >
                                {isSending ? <Loader2 className="animate-spin mr-2"/> : <Send size={18} className="mr-2"/>}
                                Odeslat
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. TARGETING TABLE */}
                <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col h-[600px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-primary flex items-center">
                            <Users className="mr-2 text-accent" size={20}/> Cílení ({filteredUsers.length})
                        </h3>
                        <button onClick={loadAllUsers} className="p-2 hover:bg-gray-100 rounded-full"><RotateCcw size={16}/></button>
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <input 
                            className="border rounded-lg p-2 text-xs" 
                            placeholder="Hledat jméno/email..." 
                            value={filters.search}
                            onChange={e => setFilters({...filters, search: e.target.value})}
                        />
                        <input 
                            className="border rounded-lg p-2 text-xs" 
                            placeholder="PSČ (např. 664)" 
                            value={filters.zip}
                            onChange={e => setFilters({...filters, zip: e.target.value})}
                        />
                        <select 
                            className="border rounded-lg p-2 text-xs bg-white"
                            value={filters.marketing}
                            onChange={e => setFilters({...filters, marketing: e.target.value as any})}
                        >
                            <option value="all">Všechny souhlasy</option>
                            <option value="yes">Jen s marketingem</option>
                            <option value="no">Bez marketingu</option>
                        </select>
                    </div>

                    {/* Table */}
                    <div className="flex-grow overflow-auto border rounded-xl relative">
                        {isUsersLoading && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                                <Loader2 className="animate-spin text-accent" size={32}/>
                            </div>
                        )}
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 text-center w-10">
                                        <button onClick={toggleSelectAll} className="text-gray-500 hover:text-accent">
                                            {selectedUserIds.size > 0 && selectedUserIds.size === filteredUsers.length ? <CheckSquare size={16}/> : <Square size={16}/>}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Uživatel</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">PSČ</th>
                                    <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase">Mkt</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-xs bg-white">
                                {filteredUsers.map(u => (
                                    <tr key={u.id} className={`hover:bg-gray-50 cursor-pointer ${selectedUserIds.has(u.id) ? 'bg-purple-50' : ''}`} onClick={() => toggleUser(u.id)}>
                                        <td className="px-4 py-3 text-center">
                                            {selectedUserIds.has(u.id) ? <CheckSquare size={16} className="text-accent inline"/> : <Square size={16} className="text-gray-300 inline"/>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-gray-900">{u.name}</div>
                                            <div className="text-gray-500">{u.email}</div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 max-w-[100px] truncate" title={getUserZipsString(u)}>
                                            {getUserZipsString(u)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {u.marketingConsent ? <span className="text-green-600 font-bold">ANO</span> : <span className="text-gray-400">NE</span>}
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr><td colSpan={4} className="p-8 text-center text-gray-400">Žádní uživatelé s aktivní notifikací.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* HISTORY (Granular Logs) */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-8">
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-700 flex items-center">
                        <Smartphone className="mr-2" size={18}/> Detailní historie odeslání
                    </h3>
                    <button onClick={loadHistory} className="p-2 hover:bg-gray-200 rounded-full"><RotateCcw size={16}/></button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y">
                        <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                            <tr>
                                <th className="px-6 py-3 text-left">Datum</th>
                                <th className="px-6 py-3 text-left">Uživatel</th>
                                <th className="px-6 py-3 text-left">Email</th>
                                <th className="px-6 py-3 text-left">Předmět</th>
                                <th className="px-6 py-3 text-left">Zpráva</th>
                                <th className="px-6 py-3 text-center">Stav</th>
                                <th className="px-6 py-3 text-right">Akce</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                            {history.map(h => (
                                <tr key={h.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-mono text-gray-500 whitespace-nowrap">
                                        {new Date(h.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-800">
                                        {h.user_name || 'Neznámý'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {h.user_email || '-'}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-primary">{h.title}</td>
                                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={h.body}>{h.body}</td>
                                    <td className="px-6 py-4 text-center">
                                        {h.status === 'sent' ? (
                                            <span className="flex items-center justify-center text-green-600 font-bold bg-green-50 px-2 py-1 rounded">
                                                <CheckCircle size={12} className="mr-1"/> Odesláno
                                            </span>
                                        ) : (
                                            <span className="flex items-center justify-center text-red-600 font-bold bg-red-50 px-2 py-1 rounded cursor-help" title={h.error_message}>
                                                <AlertCircle size={12} className="mr-1"/> Chyba
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => setRetryLog(h)} 
                                            className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded font-bold transition flex items-center ml-auto"
                                            title="Opakovat odeslání tomuto uživateli"
                                        >
                                            <Redo size={12} className="mr-1"/> Znovu
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {history.length === 0 && (
                                <tr><td colSpan={7} className="p-8 text-center text-gray-400">Žádná historie</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination 
                    currentPage={page} 
                    totalPages={totalPages} 
                    onPageChange={setPage} 
                    limit={20} 
                    onLimitChange={()=>{}} 
                    totalItems={totalPages*20} 
                />
            </div>

            <RetryConfirmModal 
                isOpen={!!retryLog} 
                log={retryLog} 
                onConfirm={handleRetry} 
                onClose={() => setRetryLog(null)} 
                isLoading={isRetrying}
            />
        </div>
    );
};
