
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { X, Cookie } from 'lucide-react';

export const CookieBanner: React.FC = () => {
    const { cookieSettings, saveCookieSettings, t } = useStore();
    const [showDetails, setShowDetails] = useState(false);
    const [tempSettings, setTempSettings] = useState({ analytics: false, marketing: false });

    // If cookies already set (consent given), don't show banner
    if (cookieSettings) return null;

    const handleAcceptAll = () => {
        saveCookieSettings({
            essential: true,
            analytics: true,
            marketing: true,
            timestamp: new Date().toISOString()
        });
    };

    const handleNecessaryOnly = () => {
        saveCookieSettings({
            essential: true,
            analytics: false,
            marketing: false,
            timestamp: new Date().toISOString()
        });
    };

    const handleSaveSelection = () => {
        saveCookieSettings({
            essential: true,
            analytics: tempSettings.analytics,
            marketing: tempSettings.marketing,
            timestamp: new Date().toISOString()
        });
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[1000] p-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start">
                    <div className="bg-gray-100 p-3 rounded-full hidden md:block">
                        <Cookie size={32} className="text-gray-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-serif font-bold text-gray-900 mb-2 flex items-center">
                            <Cookie size={20} className="mr-2 md:hidden text-gray-600" />
                            {t('cookie.title')}
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed mb-4">
                            {t('cookie.text')}
                        </p>

                        {showDetails && (
                            <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100 animate-in fade-in zoom-in-95">
                                <label className="flex items-center space-x-3 cursor-not-allowed opacity-70">
                                    <input type="checkbox" checked disabled className="rounded text-gray-400" />
                                    <div>
                                        <span className="block text-sm font-bold text-gray-800">{t('cookie.essential')}</span>
                                    </div>
                                </label>
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={tempSettings.marketing} 
                                        onChange={e => setTempSettings({...tempSettings, marketing: e.target.checked, analytics: e.target.checked})}
                                        className="rounded text-accent focus:ring-accent" 
                                    />
                                    <div>
                                        <span className="block text-sm font-bold text-gray-800">{t('cookie.marketing')}</span>
                                    </div>
                                </label>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3">
                            {showDetails ? (
                                <button 
                                    onClick={handleSaveSelection}
                                    className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition shadow-sm"
                                >
                                    Uložit výběr
                                </button>
                            ) : (
                                <>
                                    <button 
                                        onClick={handleAcceptAll}
                                        className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition shadow-sm"
                                    >
                                        {t('cookie.accept_all')}
                                    </button>
                                    <button 
                                        onClick={handleNecessaryOnly}
                                        className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition"
                                    >
                                        {t('cookie.necessary_only')}
                                    </button>
                                </>
                            )}
                            <button 
                                onClick={() => setShowDetails(!showDetails)}
                                className="px-4 py-2.5 text-gray-500 text-sm font-medium hover:text-gray-900 transition underline decoration-gray-300 underline-offset-4"
                            >
                                {showDetails ? t('common.cancel') : t('cookie.settings')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
