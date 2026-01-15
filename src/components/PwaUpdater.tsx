
import React from 'react';
import { useStore } from '../context/StoreContext';
import { RefreshCw, Download } from 'lucide-react';

export const PwaUpdater: React.FC = () => {
    const { isPwaUpdateAvailable, updatePwa, appVersion } = useStore();

    if (!isPwaUpdateAvailable) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:right-auto md:w-96 z-[1001] animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-primary text-white p-4 rounded-2xl shadow-2xl border border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-accent/20 p-2 rounded-full">
                        <Download size={20} className="text-accent" />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm">Nová verze aplikace</h4>
                        <p className="text-xs text-gray-300">Aktualizace je připravena k instalaci.</p>
                        {appVersion && <p className="text-[10px] text-gray-500 mt-1 font-mono">v.{appVersion}</p>}
                    </div>
                </div>
                <button 
                    onClick={updatePwa}
                    className="bg-accent hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2"
                >
                    <RefreshCw size={14} /> Aktualizovat
                </button>
            </div>
        </div>
    );
};
