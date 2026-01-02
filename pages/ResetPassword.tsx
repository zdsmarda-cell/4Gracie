
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { Lock, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resetPasswordByToken, openAuthModal } = useStore();
  
  const token = searchParams.get('token');
  
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMsg('Chybějící token pro obnovu hesla.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    const result = await resetPasswordByToken(token, pass1);
    
    if (result.success) {
      setStatus('success');
      setMsg(result.message);
    } else {
      setStatus('error');
      setMsg(result.message);
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
            </div>
            <button 
              onClick={() => { navigate('/'); openAuthModal(); }}
              className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg hover:bg-black transition flex items-center justify-center"
            >
              Přihlásit se <ArrowRight size={16} className="ml-2"/>
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
              disabled={!token}
              className="w-full bg-accent text-white py-3 rounded-xl font-bold shadow-lg hover:bg-yellow-600 transition disabled:opacity-50"
            >
              Uložit heslo
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
