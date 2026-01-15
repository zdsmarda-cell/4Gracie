
import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Smartphone, Send, RotateCcw, Filter, Users, Loader2, CheckSquare, Square } from 'lucide-react';
import { Pagination } from '../../components/Pagination';
import { User } from '../../types';

export const MobileNotificationsTab: React.FC = () => {
    const { getFullApiUrl, dataSource, searchUsers, t } = useStore();
    
    // --- HISTORY STATE ---
    const [history, setHistory] = useState<any[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

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
            const res = await fetch(getFullApiUrl(`/api/notifications/history?page=${page}&limit=10`), {
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
            // Fetch all users without filter first to do client-side filtering comfortably
            const users = await searchUsers({ search: '' }); 
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

    const handleResend = async (notification: any) => {
        if (!confirm('Opravdu znovu odeslat? (Budete moci upravit cílení)')) return;
        setSubject(notification.subject);
        setBody(notification.body);
        window.scrollTo(0,0);
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
                                    <tr><td colSpan={4} className="p-8 text-center text-gray-400">Žádní uživatelé neodpovídají filtru.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* HISTORY */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-8">
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-700 flex items-center">
                        <Smartphone className="mr-2" size={18}/> Historie odeslaných
                    </h3>
                    <button onClick={loadHistory} className="p-2 hover:bg-gray-200 rounded-full"><RotateCcw size={16}/></button>
                </div>
                <table className="min-w-full divide-y">
                    <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                        <tr>
                            <th className="px-6 py-3 text-left">Datum</th>
                            <th className="px-6 py-3 text-left">Předmět</th>
                            <th className="px-6 py-3 text-left">Text</th>
                            <th className="px-6 py-3 text-center">Příjemců</th>
                            <th className="px-6 py-3 text-right">Akce</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                        {history.map(h => (
                            <tr key={h.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-mono text-gray-500 whitespace-nowrap">
                                    {new Date(h.created_at).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 font-bold text-primary">{h.subject}</td>
                                <td className="px-6 py-4 text-gray-600 max-w-md truncate">{h.body}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className="bg-gray-100 px-2 py-1 rounded font-bold">{h.recipient_count}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => handleResend(h)} 
                                        className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded font-bold transition"
                                    >
                                        Použít znovu
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination 
                    currentPage={page} 
                    totalPages={totalPages} 
                    onPageChange={setPage} 
                    limit={10} 
                    onLimitChange={()=>{}} 
                    totalItems={totalPages*10} 
                />
            </div>
        </div>
    );
};
