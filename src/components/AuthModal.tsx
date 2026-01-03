
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { X, Mail, Lock, User, AlertCircle, ArrowLeft, Phone } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'forgot';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, login, register, sendPasswordReset, t } = useStore();
  const [mode, setMode] = useState<AuthMode>('login');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isAuthModalOpen) return null;

  // Strict regex patterns
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePhone = (phone: string) => /^[+]?[0-9]{9,}$/.test(phone.replace(/\s/g, ''));
  const validateName = (name: string) => name.trim().length >= 3;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'login') {
      const result = login(email, password);
      if (result.success) {
        closeAuthModal();
      } else {
        setError(result.message || 'Chyba přihlášení');
      }
    } else if (mode === 'register') {
      if (!name || !email || !password || !phone) {
        setError(t('validation.required'));
        return;
      }
      if (!validateName(name)) {
        setError(t('validation.name_length'));
        return;
      }
      if (!validateEmail(email)) {
        setError(t('validation.email_format'));
        return;
      }
      if (!validatePhone(phone)) {
        setError(t('validation.phone_format'));
        return;
      }
      if (password.length < 4) {
        setError(t('validation.password_length'));
        return;
      }

      register(name, email, phone, password);
      closeAuthModal();
    } else if (mode === 'forgot') {
      if (!email) {
        setError(t('validation.required'));
        return;
      }
      if (!validateEmail(email)) {
        setError(t('validation.email_format'));
        return;
      }
      sendPasswordReset(email);
      // Optional: keep modal open or switch back to login
      setMode('login');
    }
  };

  const handleBack = () => {
    setMode('login');
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative animate-in zoom-in-95 duration-200">
        <button onClick={closeAuthModal} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition text-gray-500">
          <X size={20} />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-serif font-bold text-primary">
            {mode === 'login' && t('nav.login')}
            {mode === 'register' && 'Registrace'}
            {mode === 'forgot' && 'Obnova hesla'}
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            {mode === 'login' && 'Vítejte zpět!'}
            {mode === 'register' && 'Vytvořte si účet pro rychlejší objednávky'}
            {mode === 'forgot' && 'Zadejte svůj email pro zaslání instrukcí'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div className="relative">
                <User className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder={t('common.name')} 
                  className="w-full border rounded-xl pl-10 p-3 text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder={t('common.phone')} 
                  className="w-full border rounded-xl pl-10 p-3 text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
            <input 
              type="email" 
              placeholder={t('common.email')}
              className="w-full border rounded-xl pl-10 p-3 text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {mode !== 'forgot' && (
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
              <input 
                type="password" 
                placeholder="Heslo" 
                className="w-full border rounded-xl pl-10 p-3 text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          )}

          {error && (
            <div className="flex items-center text-red-500 text-xs bg-red-50 p-3 rounded-lg">
              <AlertCircle size={14} className="mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          {mode === 'login' && (
            <div className="flex justify-end">
              <button type="button" onClick={() => setMode('forgot')} className="text-xs text-gray-500 hover:text-accent font-bold">
                Zapomněli jste heslo?
              </button>
            </div>
          )}

          <button type="submit" className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg hover:bg-black transition">
            {mode === 'login' && t('nav.login')}
            {mode === 'register' && 'Vytvořit účet'}
            {mode === 'forgot' && 'Odeslat email'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          {mode === 'login' ? (
            <p className="text-gray-500">
              Ještě nemáte účet?{' '}
              <button onClick={() => setMode('register')} className="text-accent font-bold hover:underline">
                Registrovat se
              </button>
            </p>
          ) : (
            <button onClick={handleBack} className="flex items-center justify-center w-full text-gray-500 hover:text-primary transition">
              <ArrowLeft size={16} className="mr-2" />
              Zpět na přihlášení
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
