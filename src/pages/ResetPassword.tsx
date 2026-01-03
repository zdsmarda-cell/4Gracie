
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { Lock, CheckCircle, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resetPasswordByToken, openAuthModal, logout } = useStore();
  
  const token = searchParams.get('token');
  
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // LOGOUT ON MOUNT: Ensures clean state, prevents "cycling" if admin is logged in
  useEffect(() => {
    logout();
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMsg('Chybějící token pro obnovu hesla.');
    }
  }, [token]);

  const handleFinish = () => {
    // 1. Force navigation to homepage and clean history stack
    // This removes the /reset-password route so the component unmounts immediately
    navigate('/', { replace: true });
    
    // 2. Open the login modal slightly after navigation starts
    // This ensures the modal opens over the Homepage, not the ResetPage
    setTimeout(() => {
        openAuthModal();
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (pass1 !== pass2) {
      setStatus('error');
      setMsg('Hesla se neshodují.');
      return;
    }
    if (pass1.length < 4) {
      setStatus('error');
      setMsg('Heslo je příliš krátké.');
      return;
    }
    if (!token) return;

    setIsSubmitting(true);
    try {
        const result = await resetPasswordByToken(token, pass1);
        if (result.success) {
          setStatus('success');
          setMsg(result.message);
          
          // Optional: Auto-redirect after 3 seconds if user doesn't click
          setTimeout(() => {
             handleFinish();
          }, 3000);
        } else {
          setStatus('error');
          setMsg(result.message);
        }
    } catch (e) {
        setStatus('error');
        setMsg('Neznámá chyba.');
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-serif font-bold text-primary">Nové heslo</h2>
          <p className="text-sm text-gray-500 mt-2">Zadejte nové heslo pro váš účet.</p>
        </div>

        {status === 'success' ? (
          <div className="text-center animate-in zoom-in duration-300">
            <div className="bg-green-50 text-green-700 p-6 rounded-xl mb-6">
              <CheckCircle className="mx-auto mb-2" size={32} />
              <p className="font-bold">{msg}</p>
              <p className="text-xs mt-2 opacity-75">Budete přesměrováni na přihlášení...</p>
            </div>
            <button 
              onClick={handleFinish}
              className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg hover:bg-black transition flex items-center justify-center"
            >
              Přihlásit se nyní <ArrowRight size={16} className="ml-2"/>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nové heslo</label>
              <input 
                type="password" 
                required
                className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent outline-none"
                value={pass1}
                onChange={e => setPass1(e.target.value)}
                disabled={isSubmitting}
                placeholder="Min. 4 znaky"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Potvrzení hesla</label>
              <input 
                type="password" 
                required
                className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-accent outline-none"
                value={pass2}
                onChange={e => setPass2(e.target.value)}
                disabled={isSubmitting}
                placeholder="Zadejte znovu"
              />
            </div>

            {status === 'error' && (
              <div className="flex items-center text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                <AlertTriangle size={16} className="mr-2 flex-shrink-0" />
                {msg}
              </div>
            )}

            <button 
              type="submit" 
              disabled={!token || isSubmitting}
              className="w-full bg-accent text-white py-3 rounded-xl font-bold shadow-lg hover:bg-yellow-600 transition disabled:opacity-50 flex justify-center items-center"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Uložit heslo'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
