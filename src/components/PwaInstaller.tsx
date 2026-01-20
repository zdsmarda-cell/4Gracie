
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
        <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300 md:hidden">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 relative animate-in zoom-in-95 duration-300">
                <button 
                    onClick={handleDismiss} 
                    className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition"
                >
                    <X size={20} />
                </button>

                <div className="flex flex-col items-center text-center mt-2">
                    <div className="w-20 h-20 bg-white rounded-3xl shadow-lg border border-gray-100 flex items-center justify-center mb-6 p-2">
                        <img src="/logo.png" className="w-full h-full object-contain" alt="App Logo" />
                    </div>
                    
                    <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">Nainstalovat aplikaci</h3>
                    
                    <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                        Pro rychlejší a pohodlnější objednávání si přidejte 4Gracie přímo na plochu vašeho telefonu.
                    </p>

                    <button 
                        onClick={handleInstallClick}
                        className="w-full bg-primary text-white py-4 rounded-xl font-bold text-base shadow-xl hover:bg-black transition flex justify-center items-center gap-3"
                    >
                        <Download size={20} />
                        Stáhnout aplikaci
                    </button>
                </div>
            </div>
        </div>
    );
};
