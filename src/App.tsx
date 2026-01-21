
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { StoreProvider, useStore } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { CookieBanner } from './components/CookieBanner';
import { PwaUpdater } from './components/PwaUpdater';
import { PwaInstaller } from './components/PwaInstaller'; // NEW
import { Menu } from './pages/Menu';
import { Cart } from './pages/Cart';
import { Admin } from './pages/Admin';
import { Profile } from './pages/Profile';
import { ResetPassword } from './pages/ResetPassword';
import { Terms } from './pages/Terms';
import { Contacts } from './pages/Contacts';
import { Driver } from './pages/Driver'; // IMPORT DRIVER PAGE
import { X, Truck, AlertCircle, CheckCircle, Loader2, Store, Settings, RefreshCw } from 'lucide-react';
import { initGA, logPageView } from './utils/analytics';

const MaintenancePage = () => {
    return (
        <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 text-center">
            {/* Logo Section */}
            <div className="mb-12 animate-in fade-in zoom-in duration-700">
                <img 
                    src="/logo.png" 
                    alt="4Gracie" 
                    className="h-48 md:h-64 object-contain border-4 border-accent rounded-3xl p-4 bg-white shadow-2xl"
                />
            </div>

            {/* Message Section */}
            <div className="max-w-md space-y-6 text-white animate-in slide-in-from-bottom-4 duration-700 delay-200">
                <div className="inline-flex p-3 bg-accent/20 rounded-full text-accent mb-4">
                    <Settings size={32} className="animate-spin-slow" />
                </div>
                <h1 className="text-3xl font-serif font-bold tracking-tight">Aktualizace systému</h1>
                <p className="text-gray-300 leading-relaxed">
                    Momentálně probíhá plánovaná údržba nebo aktualizace serveru. Omlouváme se za dočasnou nedostupnost našich služeb.
                </p>
                <div className="pt-8">
                    <button 
                        onClick={() => window.location.reload()}
                        className="bg-accent text-white px-8 py-3 rounded-xl font-bold hover:bg-yellow-600 transition flex items-center justify-center gap-2 mx-auto shadow-lg shadow-accent/20"
                    >
                        <RefreshCw size={18} />
                        Zkusit znovu
                    </button>
                </div>
            </div>

            {/* Footer info */}
            <div className="mt-12 text-gray-500 text-xs">
                &copy; {new Date().getFullYear()} 4 grácie
            </div>

            <style>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 8s linear infinite;
                }
            `}</style>
        </div>
    );
};

const LoginMock = () => {
  const { user, login, dataSource } = useStore();
  if (user || dataSource === 'api') return null;
  return (
    <div className="fixed bottom-4 right-4 bg-white p-4 shadow-xl rounded-lg border border-gray-200 z-50">
      <p className="text-xs text-gray-500 mb-2">Rychlé Demo Přihlášení (Lokální):</p>
      <div className="space-x-2 flex flex-wrap gap-2">
        <button onClick={() => login('jan.novak@example.com', '1234')} className="px-3 py-1 bg-gray-800 text-white text-xs rounded">User (Heslo: 1234)</button>
        <button onClick={() => login('info@4gracie.cz', '1234')} className="px-3 py-1 bg-red-800 text-white text-xs rounded">Admin (Heslo: 1234)</button>
        <button onClick={() => login('ridic@4gracie.cz', '1234')} className="px-3 py-1 bg-green-700 text-white text-xs rounded">Řidič (Heslo: 1234)</button>
      </div>
    </div>
  );
};

const GlobalLoadingSpinner = () => {
  const { isOperationPending } = useStore();
  if (!isOperationPending) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
      <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-300">
        <Loader2 size={48} className="text-accent animate-spin mb-4" />
        <p className="text-sm font-bold text-gray-600">Čekám na odpověď serveru...</p>
      </div>
    </div>
  );
};

const NotificationToast = () => {
  const { globalNotification, dismissNotification } = useStore();
  useEffect(() => {
    if (globalNotification && globalNotification.autoClose) {
      const timer = setTimeout(dismissNotification, globalNotification.type === 'error' ? 8000 : 4000);
      return () => clearTimeout(timer);
    }
  }, [globalNotification, dismissNotification]);
  if (!globalNotification) return null;
  const isError = globalNotification.type === 'error';
  return (
    <div className={`fixed top-24 right-4 max-w-sm w-full bg-white border border-l-4 shadow-xl rounded-lg pointer-events-auto z-[100] animate-in slide-in-from-right-10 duration-300 ${isError ? 'border-l-red-500' : 'border-l-green-500'}`}>
      <div className="p-4 flex items-start">
        <div className="flex-shrink-0">
          {isError ? <AlertCircle className="h-5 w-5 text-red-500" /> : <CheckCircle className="h-5 w-5 text-green-500" />}
        </div>
        <div className="ml-3 w-0 flex-1 pt-0.5">
          <p className="text-sm font-medium text-gray-900">{isError ? 'Chyba' : 'Úspěch'}</p>
          <p className="mt-1 text-xs text-gray-500">{globalNotification.message}</p>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            onClick={dismissNotification}
            className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

const DeliveryRegionsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { settings } = useStore();
  const regions = settings.deliveryRegions.filter(r => r.enabled);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-serif font-bold text-primary flex items-center"><Truck className="mr-2 text-accent" /> Rozvozové regiony</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={20}/></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          {regions.length === 0 ? <p className="text-center text-gray-500">Momentálně nejsou aktivní žádné rozvozové regiony.</p> : (
            <div className="grid grid-cols-1 gap-6">
              {regions.map(region => (
                <div key={region.id} className="border rounded-xl p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div><h3 className="font-bold text-lg">{region.name}</h3><p className="text-xs text-gray-500">Standardní čas rozvozu: <strong>{region.deliveryTimeStart || '?'} - {region.deliveryTimeEnd || '?'}</strong></p></div>
                    <div className="text-right"><span className="block font-bold text-accent">{region.price} Kč</span><span className="text-[10px] text-gray-400">Zdarma od {region.freeFrom} Kč</span></div>
                  </div>
                  <div className="mb-4"><h4 className="text-xs font-bold uppercase text-gray-400 mb-1">Doručovací PSČ</h4><p className="text-xs font-mono text-gray-600 leading-relaxed">{region.zips.join(', ')}</p></div>
                  {region.exceptions && region.exceptions.length > 0 && (
                    <div className="bg-white border rounded-lg p-3">
                      <h4 className="text-xs font-bold uppercase text-red-500 mb-2">Výjimky v kalendáři</h4>
                      <div className="space-y-1">
                        {region.exceptions.map((ex, idx) => (
                          <div key={idx} className="flex justify-between text-xs"><span className="font-mono font-bold">{ex.date}</span><span>{ex.isOpen ? <span className="text-blue-600">Změna času: {ex.deliveryTimeStart} - {ex.deliveryTimeEnd}</span> : <span className="text-red-600 font-bold">NEROZVÁŽÍ SE</span>}</span></div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 bg-gray-50 border-t text-center"><button onClick={onClose} className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold">Zavřít</button></div>
      </div>
    </div>
  );
};

const PickupLocationsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { settings } = useStore();
  const locations = settings.pickupLocations?.filter(l => l.enabled) || [];
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-serif font-bold text-primary flex items-center"><Store className="mr-2 text-accent" /> Výdejní místa (Osobní odběr)</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={20}/></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          {locations.length === 0 ? <p className="text-center text-gray-500">Momentálně nejsou k dispozici žádná odběrná místa.</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {locations.map(loc => (
                <div key={loc.id} className="border rounded-xl p-4 bg-gray-50">
                  <div className="mb-4"><h3 className="font-bold text-lg text-primary">{loc.name}</h3><p className="text-sm text-gray-600">{loc.street}, {loc.city}, {loc.zip}</p></div>
                  <div>
                    <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">Otevírací doba</h4>
                    <div className="space-y-1 text-xs">
                        {[1, 2, 3, 4, 5, 6, 0].map(day => {
                            const dayName = day === 0 ? 'Neděle' : day === 1 ? 'Pondělí' : day === 2 ? 'Úterý' : day === 3 ? 'Středa' : day === 4 ? 'Čtvrtek' : day === 5 ? 'Pátek' : 'Sobota';
                            const config = loc.openingHours[day];
                            return (
                                <div key={day} className="flex justify-between border-b border-gray-100 last:border-0 py-1"><span className="font-medium text-gray-600">{dayName}</span>{config?.isOpen ? <span className="font-bold">{config.start} - {config.end}</span> : <span className="text-gray-400 italic">Zavřeno</span>}</div>
                            );
                        })}
                    </div>
                  </div>
                  {loc.exceptions && loc.exceptions.length > 0 && (
                    <div className="mt-4 bg-white border rounded-lg p-3">
                      <h4 className="text-xs font-bold uppercase text-red-500 mb-2">Výjimky v otevírací době</h4>
                      <div className="space-y-1">
                        {loc.exceptions.map((ex, idx) => (
                          <div key={idx} className="flex justify-between text-xs"><span className="font-mono font-bold">{ex.date}</span><span>{ex.isOpen ? <span className="text-blue-600 font-bold">{ex.deliveryTimeStart} - {ex.deliveryTimeEnd}</span> : <span className="text-red-600 font-bold">ZAVŘENO</span>}</span></div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 bg-gray-50 border-t text-center"><button onClick={onClose} className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-bold">Zavřít</button></div>
      </div>
    </div>
  );
};

const MainContent = () => {
    const { dbConnectionError, settings, t, cookieSettings } = useStore();
    const [isRegionsModalOpen, setIsRegionsModalOpen] = useState(false);
    const [isPickupModalOpen, setIsPickupModalOpen] = useState(false);
    
    // Analytics Hook
    const location = useLocation();

    // Initialize GA only if cookie consent is given
    useEffect(() => {
        if (cookieSettings?.analytics) {
            initGA();
        }
    }, [cookieSettings]);

    // Track Page Views
    useEffect(() => {
        if (cookieSettings?.analytics) {
            logPageView(location.pathname + location.search);
        }
    }, [location, cookieSettings]);

    if (dbConnectionError) {
        return <MaintenancePage />;
    }

    const hasActiveDelivery = settings.deliveryRegions.some(r => r.enabled);
    const hasActivePickup = settings.pickupLocations?.some(l => l.enabled);
    const currentYear = new Date().getFullYear();

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <Navbar />
            <NotificationToast />
            <CookieBanner />
            <PwaUpdater />
            <PwaInstaller /> 
            <GlobalLoadingSpinner />
            <AuthModal />
            <DeliveryRegionsModal isOpen={isRegionsModalOpen} onClose={() => setIsRegionsModalOpen(false)} />
            <PickupLocationsModal isOpen={isPickupModalOpen} onClose={() => setIsPickupModalOpen(false)} />
            <main className="flex-grow">
                <Routes>
                    <Route path="/" element={<Menu />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/driver" element={<Driver />} /> 
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/contacts" element={<Contacts />} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </main>
            <footer className="bg-primary text-gray-400 py-8 text-center text-sm">
                <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex flex-col items-center md:items-start gap-1">
                        <p>&copy; {currentYear} 4 grácie</p>
                        <div className="flex gap-4">
                            <Link to="/contacts" className="text-accent hover:text-white transition underline text-xs font-bold">{t('footer.contacts')}</Link>
                            <Link to="/terms" className="text-accent hover:text-white transition underline text-xs font-bold">{t('footer.terms')}</Link>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        {hasActiveDelivery && (
                            <button onClick={() => setIsRegionsModalOpen(true)} className="text-accent hover:text-white transition underline text-xs font-bold flex items-center"><Truck size={14} className="mr-1" /> {t('footer.delivery_regions')}</button>
                        )}
                        {hasActivePickup && (
                            <button onClick={() => setIsPickupModalOpen(true)} className="text-accent hover:text-white transition underline text-xs font-bold flex items-center"><Store size={14} className="mr-1" /> {t('footer.pickup_points')}</button>
                        )}
                    </div>
                </div>
            </footer>
            <LoginMock />
        </div>
    );
};

const App: React.FC = () => {
  return (
    <StoreProvider>
      <Router>
        <MainContent />
      </Router>
    </StoreProvider>
  );
};

export default App;
