
import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Language } from '../../types';
import { Settings as SettingsIcon, Languages, Wand2, Server, Terminal } from 'lucide-react';

export const SettingsTab: React.FC = () => {
    const { settings, updateSettings, t } = useStore();
    
    // Local state for Base URL to prevent lag
    const [localBaseUrl, setLocalBaseUrl] = useState(settings.server?.baseUrl || '');

    useEffect(() => {
        setLocalBaseUrl(settings.server?.baseUrl || '');
    }, [settings.server?.baseUrl]);

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
            server: { ...settings.server || { baseUrl: '' }, consoleLogging: enabled } 
        });
    };

    const saveBaseUrl = async () => {
        await updateSettings({
            ...settings,
            server: { ...settings.server || { consoleLogging: false }, baseUrl: localBaseUrl }
        });
    };

    return (
        <div className="animate-fade-in max-w-2xl bg-white p-8 rounded-2xl border shadow-sm">
            <h2 className="text-xl font-bold mb-6 flex items-center">
                <SettingsIcon className="mr-2 text-accent" /> {t('admin.app_settings')}
            </h2>

            <div className="space-y-8">
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
                        Pokud je tato možnost zapnuta, aplikace se při ukládání produktů, kategorií a dalších entit 
                        automaticky spojí s AI službou a vygeneruje překlady do aktivních jazyků.
                    </p>
                    <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white rounded transition">
                        <input 
                            type="checkbox" 
                            className="w-5 h-5 text-accent rounded focus:ring-accent"
                            checked={settings.enableAiTranslation ?? true}
                            onChange={(e) => toggleAi(e.target.checked)}
                        />
                        <span className="text-sm font-bold text-gray-900">Povolit automatické AI překlady</span>
                    </label>
                </div>

                {/* Server Settings Section */}
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <Server size={20} className="mr-2 text-gray-600" />
                        Serverová nastavení
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">URL Aplikace (včetně portu)</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    className="w-full border rounded p-2 text-sm" 
                                    value={localBaseUrl} 
                                    onChange={e => setLocalBaseUrl(e.target.value)} 
                                    placeholder="http://localhost:3000 nebo https://mojedomena.cz" 
                                />
                                <button onClick={saveBaseUrl} className="bg-primary text-white px-3 py-2 rounded text-xs font-bold">Uložit</button>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Používá se pro generování odkazů na obrázky v emailech.</p>
                        </div>

                        <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-white rounded transition">
                            <input 
                                type="checkbox" 
                                className="w-5 h-5 text-accent rounded focus:ring-accent"
                                checked={settings.server?.consoleLogging ?? false}
                                onChange={(e) => toggleConsoleLogging(e.target.checked)}
                            />
                            <div className="flex items-center">
                                <Terminal size={16} className="mr-2 text-gray-500" />
                                <span className="text-sm font-bold text-gray-900">Logovat emaily do konzole serveru</span>
                            </div>
                        </label>
                        <p className="text-xs text-gray-500 ml-9">
                            Pokud je zapnuto, obsah odesílaných emailů (HTML) se bude vypisovat do serverové konzole pro účely ladění.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
