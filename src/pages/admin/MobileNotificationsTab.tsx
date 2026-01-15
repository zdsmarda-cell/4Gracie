
import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Smartphone, Send, RotateCcw, Filter, Users, Loader2 } from 'lucide-react';
import { Pagination } from '../../components/Pagination';

export const MobileNotificationsTab: React.FC = () => {
    const { getFullApiUrl, dataSource, t } = useStore();
    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    
    // New Notification Form
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [filterMarketing, setFilterMarketing] = useState(false);
    const [filterZips, setFilterZips] = useState('');
    const [estimatedCount, setEstimatedCount] = useState<number | null>(null);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        loadHistory();
    }, [page]);

    const loadHistory = async () => {
        if (dataSource !== 'api') return;
        setIsLoading(true);
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
            setIsLoading(false);
        }
    };

    const handlePreview = async () => {
        if (dataSource !== 'api') return;
        
        const zipsArray = filterZips.split(',').map(z => z.trim()).filter(z => z.length === 5);
        
        const token = localStorage.getItem('auth_token');
        const res = await fetch(getFullApiUrl('/api/notifications/preview-count'), {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ 
                filters: { 
                    marketing: filterMarketing,
                    zips: zipsArray
                } 
            })
        });
        const data = await res.json();
        setEstimatedCount(data.count);
    };

    const handleSend = async () => {
        if (!subject || !body) return alert('Vyplňte předmět a text.');
        if (dataSource !== 'api') return alert('Dostupné pouze v API režimu.');

        setIsSending(true);
        const zipsArray = filterZips.split(',').map(z => z.trim()).filter(z => z.length === 5);

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
                    filters: { 
                        marketing: filterMarketing,
                        zips: zipsArray
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Odesláno na ${data.count} zařízení.`);
                setSubject('');
                setBody('');
                loadHistory();
            }
        } catch (e) {
            console.error(e);
            alert('Chyba při odesílání.');
        } finally {
            setIsSending(false);
        }
    };

    const handleResend = async (notification: any) => {
        if (!confirm('Opravdu znovu odeslat?')) return;
        setSubject(notification.subject);
        setBody(notification.body);
        // We prepopulate form, admin must click send manually to confirm filters
        const filters = typeof notification.filters === 'string' ? JSON.parse(notification.filters) : notification.filters;
        setFilterMarketing(filters?.marketing || false);
        setFilterZips(filters?.zips?.join(', ') || '');
        window.scrollTo(0,0);
    };

    if (dataSource !== 'api') return <div className="p-8 text-center text-gray-400">Dostupné pouze s databází.</div>;

    return (
        <div className="animate-fade-in space-y-8">
            <div className="bg-white p-6 rounded-2xl border shadow-sm grid md:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-lg font-bold text-primary mb-4 flex items-center">
                        <Send className="mr-2 text-accent" size={20}/> Nová notifikace
                    </h3>
                    <div className="space-y-4">
                        <input 
                            className="w-full border rounded-xl p-3 text-sm focus:ring-accent outline-none" 
                            placeholder="Předmět / Nadpis" 
                            value={subject} 
                            onChange={e => setSubject(e.target.value)} 
                        />
                        <textarea 
                            className="w-full border rounded-xl p-3 text-sm h-32 focus:ring-accent outline-none resize-none" 
                            placeholder="Text zprávy..." 
                            value={body} 
                            onChange={e => setBody(e.target.value)} 
                        />
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center">
                        <Filter className="mr-2" size={16}/> Cílení a Filtry
                    </h3>
                    
                    <div className="space-y-4">
                        <label className="flex items-center space-x-3 cursor-pointer p-2 bg-white rounded border hover:border-accent transition">
                            <input 
                                type="checkbox" 
                                checked={filterMarketing} 
                                onChange={e => setFilterMarketing(e.target.checked)}
                                className="rounded text-accent w-5 h-5"
                            />
                            <span className="text-sm font-bold text-gray-700">Jen s marketingovým souhlasem</span>
                        </label>

                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">PSČ (oddělené čárkou)</label>
                            <input 
                                className="w-full border rounded-lg p-2 text-sm font-mono" 
                                placeholder="66417, 60200..." 
                                value={filterZips} 
                                onChange={e => setFilterZips(e.target.value)} 
                            />
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <button onClick={handlePreview} className="text-xs font-bold text-blue-600 hover:underline flex items-center">
                                <Users size={14} className="mr-1"/> Zkontrolovat počet příjemců
                            </button>
                            {estimatedCount !== null && (
                                <span className="text-sm font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                                    {estimatedCount} zařízení
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button 
                    onClick={handleSend} 
                    disabled={isSending || !subject || !body}
                    className="bg-accent text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center"
                >
                    {isSending ? <Loader2 className="animate-spin mr-2"/> : <Send size={18} className="mr-2"/>}
                    Odeslat notifikaci
                </button>
            </div>

            {/* HISTORY */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
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
                    totalItems={totalPages*10} // approx
                />
            </div>
        </div>
    );
};
