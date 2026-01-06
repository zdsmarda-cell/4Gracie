
import { useState, useCallback } from 'react';
import { User, DataSourceMode } from '../types';

const hashPassword = (pwd: string) => `hashed_${btoa(pwd)}`;

const INITIAL_USERS: User[] = [
  { id: 'admin1', name: 'Admin User', email: 'info@4gracie.cz', phone: '+420123456789', role: 'admin', billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword('1234') },
  { id: 'user1', name: 'Jan Novák', email: 'jan.novak@example.com', phone: '+420987654321', role: 'customer', billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword('1234'), marketingConsent: true }
];

export const useAuth = (
    dataSource: DataSourceMode,
    apiCall: (endpoint: string, method: string, body?: any) => Promise<any>,
    showNotify: (msg: string, type?: 'success'|'error', autoClose?: boolean) => void,
    fetchDataTrigger: () => Promise<void>
) => {
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [user, setUser] = useState<User | null>(() => {
        try {
            const item = localStorage.getItem('session_user');
            return item ? JSON.parse(item) : null;
        } catch { return null; }
    });

    const login = async (email: string, password?: string) => {
        if (dataSource === 'api') {
            const res = await apiCall('/api/users/login', 'POST', { email, password });
            if (res && res.success) {
                setUser(res.user);
                localStorage.setItem('session_user', JSON.stringify(res.user));
                return { success: true };
            }
            return { success: false, message: res?.message || 'Login failed' };
        } else {
            const foundUser = allUsers.find(u => u.email === email);
            if (foundUser) {
                if (foundUser.isBlocked) return { success: false, message: 'Blokován.' };
                // Strict password check
                if (!password || foundUser.passwordHash !== hashPassword(password)) {
                    return { success: false, message: 'Chybné heslo.' };
                }
                setUser(foundUser);
                localStorage.setItem('session_user', JSON.stringify(foundUser));
                return { success: true };
            }
            return { success: false, message: 'Nenalezen.' };
        }
    };

    const register = (name: string, email: string, phone: string, password?: string) => {
        if (allUsers.find(u => u.email.toLowerCase() === email.toLowerCase())) { 
            showNotify('Tento email je již registrován.', 'error');
            return; 
        }
        const newUser: User = { id: Date.now().toString(), name, email, phone, role: 'customer', billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword(password || '1234'), marketingConsent: false };
        
        if (dataSource === 'api') {
            apiCall('/api/users', 'POST', newUser).then(res => {
                if (res && res.success) { 
                    setAllUsers(prev => [...prev, newUser]); 
                    setUser(newUser); 
                    localStorage.setItem('session_user', JSON.stringify(newUser));
                }
            });
        } else {
            setAllUsers(prev => [...prev, newUser]); 
            setUser(newUser);
            localStorage.setItem('session_user', JSON.stringify(newUser));
        }
    };

    const logout = () => { 
        setUser(null); 
        localStorage.removeItem('session_user'); 
    };

    const addUser = async (name: string, email: string, phone: string, role: 'customer' | 'admin' | 'driver'): Promise<boolean> => {
        if (allUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) { alert('Uživatel již existuje.'); return false; }
        const newUser: User = { id: Date.now().toString(), name, email, phone, role, billingAddresses: [], deliveryAddresses: [], isBlocked: false, passwordHash: hashPassword('1234'), marketingConsent: false };
        
        if (dataSource === 'api') {
            const res = await apiCall('/api/users', 'POST', newUser);
            if (res && res.success) {
                setAllUsers(prev => [...prev, newUser]);
                // Success notification removed
                return true;
            }
            return false;
        } else {
            setAllUsers(prev => [...prev, newUser]);
            // Success notification removed
            return true;
        }
    };

    const updateUser = async (u: User): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall('/api/users', 'POST', u);
            if (res && res.success) {
                setUser(u);
                localStorage.setItem('session_user', JSON.stringify(u));
                setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
                // Success notification removed
                return true;
            }
            return false;
        } else {
            setUser(u);
            localStorage.setItem('session_user', JSON.stringify(u));
            setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
            return true;
        }
    };

    const updateUserAdmin = async (u: User): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall('/api/users', 'POST', u);
            if (res && res.success) {
                setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
                if (user && user.id === u.id) {
                    setUser(u);
                    localStorage.setItem('session_user', JSON.stringify(u));
                }
                // Success notification removed
                return true;
            }
            return false;
        } else {
            setAllUsers(prev => prev.map(x => x.id === u.id ? u : x));
            if (user && user.id === u.id) {
                setUser(u);
                localStorage.setItem('session_user', JSON.stringify(u));
            }
            return true;
        }
    };

    const toggleUserBlock = async (id: string): Promise<boolean> => { 
        const u = allUsers.find(x => x.id === id); 
        if (u) { 
            const updated = { ...u, isBlocked: !u.isBlocked }; 
            return await updateUserAdmin(updated); 
        } 
        return false; 
    };

    const sendPasswordReset = async (email: string) => { 
        if (dataSource === 'api') { 
            const res = await apiCall('/api/auth/reset-password', 'POST', { email }); 
            if (res && res.success) { return { success: true, message: res.message }; } 
            return { success: false, message: res?.message || 'Server error' }; 
        } 
        return { success: true, message: 'Email sent (simulated)' }; 
    };

    const resetPasswordByToken = async (token: string, newPass: string) => { 
        if (dataSource === 'api') { 
            const newHash = hashPassword(newPass); 
            const res = await apiCall('/api/auth/reset-password-confirm', 'POST', { token, newPasswordHash: newHash }); 
            if (res && res.success) { 
                await fetchDataTrigger(); 
                return { success: true, message: res.message || 'Heslo úspěšně změněno.' }; 
            } else { 
                return { success: false, message: res?.message || 'Chyba serveru při změně hesla.' }; 
            } 
        } else { 
            return { success: true, message: 'Heslo změněno (Lokální simulace)' }; 
        } 
    };

    const changePassword = async (o: string, n: string) => { 
        if (!user) return { success: false, message: 'Login required' }; 
        if (hashPassword(o) !== user.passwordHash) return { success: false, message: 'Staré heslo nesouhlasí' }; 
        const u = { ...user, passwordHash: hashPassword(n) }; 
        await updateUser(u); 
        return { success: true, message: 'Změněno' }; 
    };

    return {
        user,
        setUser,
        allUsers,
        setAllUsers,
        login,
        register,
        logout,
        addUser,
        updateUser,
        updateUserAdmin,
        toggleUserBlock,
        sendPasswordReset,
        resetPasswordByToken,
        changePassword,
        INITIAL_USERS
    };
};
