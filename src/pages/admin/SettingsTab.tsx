
import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Language } from '../../types';
import { Settings as SettingsIcon, Languages, Wand2, Server, Terminal, Clock, Truck } from 'lucide-react';

export const SettingsTab: React.FC = () => {
    const { settings, updateSettings, t } = useStore();
    
    const toggleLanguage = async (lang: Language) => {
        const current = settings.enabledLanguages || [];
        let updated: Language[];

        if (current.includes(lang)) {
            // Check if it's the last one
            if (current.length <= 1) {
                alert('Minimálně jeden jazyk musí být vždy aktivní.');
                return;
            }
            updated = current.filter(l => l !== lang);
        } else {
            updated = [...current, lang];
        }
        
        await updateSettings({ ...settings, enabledLanguages: updated });
    };

    const toggleAi = async (enabled: boolean) => {
        await updateSettings({ ...settings, enableAiTranslation: enabled });
    };

    const toggleConsoleLogging = async (enabled: boolean) => {
        await updateSettings({ 
            ...settings, 
            server: { ...settings.server || {}, consoleLogging: enabled } 
        });
    };

    return (
        <div className="animate-fade-in max-w-4xl bg-white p-8 rounded-2xl border shadow-sm">
            <h2 className="text-xl font-bold mb-6 flex items-center">
                <SettingsIcon className="mr-2 text-accent" /> {t('admin.app_settings')}
            </h2>

            <div className="space-y-8">
                
                {/* Logistics Section */}
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <Truck size={20} className="mr-2 text-green-600" />
                        {t('admin.logistics_settings')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Doba nakládky v depu (základ - min)</label>
                            <input 
                                type="number" 
                                className="w-full border rounded p-2 text-sm" 
                                value={settings.logistics?.stopTimeMinutes}
                                onChange={e => updateSettings({ ...settings, logistics: { ...settings.logistics, stopTimeMinutes: Number(e.target.value) } })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Čas naložení 1 balíku (sec)</label>
                            <input 
                                type="number" 
                                className="w-full border rounded p-2 text-sm" 
                                value={settings.logistics?.loadingSecondsPerItem}
                                onChange={e => updateSettings({ ...settings, logistics: { ...settings.logistics, loadingSecondsPerItem: Number(e.target.value) } })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Doba vykládky - Zaplaceno (sec)</label>
                            <input 
                                type="number" 
                                className="w-full border rounded p-2 text-sm" 
                                value={settings.logistics?.unloadingPaidSeconds}
                                onChange={e => updateSettings({ ...settings, logistics: { ...settings.logistics, unloadingPaidSeconds: Number(e.target.value) } })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Doba vykládky - Dobírka (sec)</label>
                            <input 
                                type="number" 
                                className="w-full border rounded p-2 text-sm" 
                                value={settings.logistics?.unloadingUnpaidSeconds}
                                onChange={e => updateSettings({ ...settings, logistics: { ...settings.logistics, unloadingUnpaidSeconds: Number(e.target.value) } })}
                            />
                        </div>
                    </div>
                </div>

                {/* Language Section */}
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <Languages size={20} className="mr-2 text-blue-600" />
                        Jazykové mutace
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                        Zvolte, které jazykové verze budou dostupné v hlavičce aplikace pro zákazníky.
                        Výchozí jazyk je vždy Čeština (CS).
                    </p>
                    <div className="space-y-3">
                        {(Object.values(Language) as Language[]).map(lang => (
                            <label key={lang} className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white rounded transition">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 text-accent rounded focus:ring-accent"
                                    checked={settings.enabledLanguages?.includes(lang) ?? true}
                                    onChange={() => toggleLanguage(lang)}
                                />
                                <span className="text-sm font-bold uppercase">{lang}</span>
                                {lang === Language.CS && <span className="text-xs text-gray-400">(Výchozí)</span>}
                            </label>
                        ))}
                    </div>
                </div>

                {/* AI Translation Section */}
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <Wand2 size={20} className="mr-2 text-purple-600" />
                        AI Překlady
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                        Při uložení produktu, kategorie nebo jiného obsahu se automaticky vygenerují překlady do aktivních jazyků pomocí AI (Google Gemini).
                    </p>
                    <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white rounded transition">
                        <input 
                            type="checkbox" 
                            className="w-5 h-5 text-accent rounded focus:ring-accent"
                            checked={settings.enableAiTranslation}
                            onChange={(e) => toggleAi(e.target.checked)}
                        />
                        <span className="text-sm font-bold">Povolit automatické AI překlady</span>
                    </label>
                </div>

                {/* Server Settings */}
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <Server size={20} className="mr-2 text-gray-600" />
                        Serverová nastavení
                    </h3>
                    <div className="space-y-4">
                         {/* API URL (Read only) */}
                         <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">URL Aplikace (pro emaily)</label>
                            <input 
                                className="w-full border rounded p-2 text-sm bg-gray-100 text-gray-500" 
                                disabled
                                value={window.location.origin}
                            />
                        </div>

                         {/* Console Logging */}
                         <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white rounded transition">
                            <input 
                                type="checkbox" 
                                className="w-5 h-5 text-accent rounded focus:ring-accent"
                                checked={settings.server?.consoleLogging || false}
                                onChange={(e) => toggleConsoleLogging(e.target.checked)}
                            />
                            <div className="flex items-center">
                                <Terminal size={16} className="mr-2 text-gray-400"/>
                                <span className="text-sm font-bold">Podrobné logování serveru (Console)</span>
                            </div>
                        </label>
                    </div>
                </div>

            </div>
        </div>
    );
};
