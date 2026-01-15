
import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export const PwaInstaller: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            
            // Check if user has already dismissed it
            const dismissed = localStorage.getItem('pwa_install_dismissed');
            if (!dismissed) {
                setIsVisible(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        
        // Show the prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
        
        setDeferredPrompt(null);
        setIsVisible(false);
    };

    const handleDismiss = () => {
        setIsVisible(false);
        // Remember dismissal for 7 days (or just use flag)
        localStorage.setItem('pwa_install_dismissed', 'true');
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[1002] p-4 animate-in slide-in-from-bottom-4 duration-500 md:hidden">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                        <div className="bg-primary p-3 rounded-xl">
                            <img src="/logo.png" className="w-8 h-8 object-contain filter invert" alt="App Logo" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">Nainstalovat aplikaci</h3>
                            <p className="text-xs text-gray-500 mt-1">
                                Přidejte si 4Gracie na plochu pro rychlejší objednávání.
                            </p>
                        </div>
                    </div>
                    <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 p-1">
                        <X size={20} />
                    </button>
                </div>
                <button 
                    onClick={handleInstallClick}
                    className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-black transition flex justify-center items-center gap-2"
                >
                    <Download size={18} />
                    Stáhnout aplikaci
                </button>
            </div>
        </div>
    );
};
