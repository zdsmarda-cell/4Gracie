
import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { User } from '../../types';
import { User as UserIcon, Plus, Download, Ban, Check, AlertCircle } from 'lucide-react';

export const UsersTab: React.FC = () => {
    const { allUsers, orders, t, addUser, updateUserAdmin } = useStore();
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [userFilters, setUserFilters] = useState({ search: '', spentMin: '', spentMax: '', ordersMin: '', ordersMax: '', marketing: '', status: '' });
    
    // Modal
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [userForm, setUserForm] = useState({ name: '', email: '', phone: '', role: 'customer' as 'customer' | 'admin' | 'driver' });
    const [validationError, setValidationError] = useState<string | null>(null);

    const filteredUsers = useMemo(() => {
        return allUsers.filter(u => {
            if (userFilters.search) {
                const term = userFilters.search.toLowerCase();
                if (!u.name.toLowerCase().includes(term) && !u.email.toLowerCase().includes(term)) return false;
            }
            if (userFilters.marketing === 'yes' && !u.marketingConsent) return false;
            if (userFilters.marketing === 'no' && u.marketingConsent) return false;
            if (userFilters.status === 'active' && u.isBlocked) return false;
            if (userFilters.status === 'blocked' && !u.isBlocked) return false;
            
            const userOrders = orders.filter(o => o.userId === u.id);
            const spent = userOrders.reduce((sum, o) => sum + o.totalPrice, 0);
            
            if (userFilters.spentMin && spent < Number(userFilters.spentMin)) return false;
            if (userFilters.spentMax && spent > Number(userFilters.spentMax)) return false;
            
            // Filtering by number of orders
            if (userFilters.ordersMin && userOrders.length < Number(userFilters.ordersMin)) return false;
            if (userFilters.ordersMax && userOrders.length > Number(userFilters.ordersMax)) return false;
            
            return true;
        });
    }, [allUsers, orders, userFilters]);

    const handleUserExport = () => {
        const csvContent = "data:text/csv;charset=utf-8," 
            + ["ID,Name,Email,Phone,Role,Marketing,Status,OrdersCount,TotalSpent"].join(",") + "\n"
            + filteredUsers.filter(u => selectedUserIds.includes(u.id)).map(u => {
                const userOrders = orders.filter(o => o.userId === u.id);
                const totalSpent = userOrders.reduce((sum, o) => sum + o.totalPrice, 0);
                return `${u.id},"${u.name}",${u.email},${u.phone},${u.role},${u.marketingConsent?'YES':'NO'},${u.isBlocked?'BLOCKED':'ACTIVE'},${userOrders.length},${totalSpent}`;
            }).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "users_export.csv");
        document.body.appendChild(link);
        link.click();
    };

    const openUserModal = (u?: User) => {
        setValidationError(null);
        setEditingUser(u || null);
        setUserForm(u ? { name: u.name, email: u.email, phone: u.phone, role: u.role } : { name: '', email: '', phone: '', role: 'customer' });
        setIsUserModalOpen(true);
    };

    const handleUserModalSave = async () => {
        setValidationError(null);
        
        // VALIDATION
        if (!userForm.name || userForm.name.length < 3) {
            setValidationError(t('validation.name_length'));
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email)) {
            setValidationError(t('validation.email_format'));
            return;
        }
        // Phone: Digits or +, min 9 chars (ignoring spaces)
        if (!/^[+]?[0-9]{9,}$/.test(userForm.phone.replace(/\s/g, ''))) {
            setValidationError(t('validation.phone_format'));
            return;
        }

        if (editingUser) {
            await updateUserAdmin({ ...editingUser, ...userForm });
        } else {
            await addUser(userForm.name, userForm.email, userForm.phone, userForm.role);
        }
        setIsUserModalOpen(false);
    };

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-primary flex items-center"><UserIcon className="mr-2 text-accent" /> {t('admin.user_management')}</h2>
                <div className="flex gap-2">
                    {selectedUserIds.length > 0 && (
                        <button onClick={handleUserExport} className="bg-white border border-green-500 text-green-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center hover:bg-green-50">
                            <Download size={16} className="mr-2"/> Exportovat vybrané ({selectedUserIds.length})
                        </button>
                    )}
                    <button onClick={() => openUserModal()} className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center"><Plus size={16} className="mr-2"/> {t('admin.new_user')}</button>
                </div>
            </div>
            
            <div className="bg-white p-4 rounded-2xl border shadow-sm mb-4">
                <div className="flex flex-wrap gap-4 text-xs items-end">
                    <div className="flex-1 min-w-[200px]">
                        <div className="mb-1 font-bold text-gray-400">Hledat (Jméno, Email)</div>
                        <input type="text" className="w-full border rounded p-2" placeholder="Text..." value={userFilters.search} onChange={e => setUserFilters({...userFilters, search: e.target.value})} />
                    </div>
                    <div>
                        <div className="mb-1 font-bold text-gray-400">{t('common.spent')} (Kč)</div>
                        <div className="flex gap-2">
                            <input type="number" className="w-20 border rounded p-2" placeholder="Od" value={userFilters.spentMin} onChange={e => setUserFilters({...userFilters, spentMin: e.target.value})} />
                            <input type="number" className="w-20 border rounded p-2" placeholder="Do" value={userFilters.spentMax} onChange={e => setUserFilters({...userFilters, spentMax: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <div className="mb-1 font-bold text-gray-400">{t('admin.orders')}</div>
                        <div className="flex gap-2">
                            <input type="number" className="w-20 border rounded p-2" placeholder="Od" value={userFilters.ordersMin} onChange={e => setUserFilters({...userFilters, ordersMin: e.target.value})} />
                            <input type="number" className="w-20 border rounded p-2" placeholder="Do" value={userFilters.ordersMax} onChange={e => setUserFilters({...userFilters, ordersMax: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <div className="mb-1 font-bold text-gray-400">Marketing</div>
                        <select className="border rounded p-2 bg-white w-24" value={userFilters.marketing} onChange={e => setUserFilters({...userFilters, marketing: e.target.value})}>
                            <option value="">{t('filter.all')}</option>
                            <option value="yes">{t('common.yes')}</option>
                            <option value="no">{t('common.no')}</option>
                        </select>
                    </div>
                    <div>
                        <div className="mb-1 font-bold text-gray-400">{t('common.status')}</div>
                        <select className="border rounded p-2 bg-white w-24" value={userFilters.status} onChange={e => setUserFilters({...userFilters, status: e.target.value})}>
                            <option value="">{t('filter.all')}</option>
                            <option value="active">{t('common.active')}</option>
                            <option value="blocked">{t('common.blocked')}</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="min-w-full divide-y">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                    <tr>
                    <th className="px-6 py-4 text-center w-10">
                        <input 
                            type="checkbox" 
                            onChange={e => setSelectedUserIds(e.target.checked ? filteredUsers.map(u => u.id) : [])} 
                            checked={selectedUserIds.length > 0 && selectedUserIds.length === filteredUsers.length} 
                        />
                    </th>
                    <th className="px-6 py-4 text-left">{t('common.name')}</th>
                    <th className="px-6 py-4 text-left">{t('common.email')}</th>
                    <th className="px-6 py-4 text-left">{t('common.role')}</th>
                    <th className="px-6 py-4 text-center">{t('admin.orders')}</th>
                    <th className="px-6 py-4 text-right">{t('common.spent')}</th>
                    <th className="px-6 py-4 text-center">Marketing</th>
                    <th className="px-6 py-4 text-center">{t('common.status')}</th>
                    <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y text-xs">
                    {filteredUsers.map(u => {
                    const userOrders = orders.filter(o => o.userId === u.id);
                    const totalSpent = userOrders.reduce((sum, o) => sum + o.totalPrice + o.packagingFee + (o.deliveryFee||0), 0);
                    return (
                        <tr key={u.id} className={`hover:bg-gray-50 ${u.isBlocked ? 'bg-red-50' : ''}`}>
                        <td className="px-6 py-4 text-center">
                            <input 
                                type="checkbox" 
                                checked={selectedUserIds.includes(u.id)} 
                                onChange={() => setSelectedUserIds(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])} 
                            />
                        </td>
                        <td className="px-6 py-4 font-bold">{u.name}</td>
                        <td className="px-6 py-4 text-gray-600">{u.email}<br/><span className="text-[10px]">{u.phone}</span></td>
                        <td className="px-6 py-4 uppercase font-bold text-[10px]">{u.role}</td>
                        <td className="px-6 py-4 text-center font-bold">{userOrders.length}</td>
                        <td className="px-6 py-4 text-right font-mono">{totalSpent} Kč</td>
                        <td className="px-6 py-4 text-center">
                            {u.marketingConsent ? <span className="text-green-600 font-bold">ANO</span> : <span className="text-gray-400">NE</span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                            {u.isBlocked ? <span className="text-red-600 font-bold flex items-center justify-center"><Ban size={14} className="mr-1"/> {t('common.blocked')}</span> : <span className="text-green-600 font-bold">{t('common.active')}</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                            <button onClick={() => openUserModal(u)} className="text-blue-600 font-bold hover:underline">{t('common.detail_edit')}</button>
                        </td>
                        </tr>
                    );
                    })}
                </tbody>
                </table>
            </div>

            {isUserModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl">
                        <h3 className="font-bold text-lg mb-4">{editingUser ? 'Upravit uživatele' : 'Nový uživatel'}</h3>
                        
                        {validationError && (
                            <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-xs font-bold flex items-center">
                                <AlertCircle size={16} className="mr-2 flex-shrink-0"/> {validationError}
                            </div>
                        )}

                        <div className="space-y-3">
                            <input className="w-full border p-2 rounded" placeholder={t('common.name')} value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} />
                            <input className="w-full border p-2 rounded" placeholder={t('common.email')} value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} />
                            <input className="w-full border p-2 rounded" placeholder={t('common.phone')} value={userForm.phone} onChange={e => setUserForm({...userForm, phone: e.target.value})} />
                            <select className="w-full border p-2 rounded" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as any})}>
                                <option value="customer">Zákazník</option>
                                <option value="driver">Řidič</option>
                                <option value="admin">Administrátor</option>
                            </select>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setIsUserModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded font-bold text-sm">Zrušit</button>
                            <button onClick={handleUserModalSave} className="flex-1 py-2 bg-primary text-white rounded font-bold text-sm">Uložit</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
