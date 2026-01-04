
import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Language } from '../../types';
import { Settings as SettingsIcon, Languages, Wand2, Terminal } from 'lucide-react';

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

    const toggleSqlDebug = async (enabled: boolean) => {
        await updateSettings({ ...settings, sqlDebug: enabled });
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

                {/* Console Section */}
                <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 text-gray-300">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                        <Terminal size={20} className="mr-2 text-green-500" />
                        Konzole
                    </h3>
                    <label className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-gray-800 rounded transition">
                        <input 
                            type="checkbox" 
                            className="w-5 h-5 text-green-500 bg-gray-700 border-gray-600 rounded focus:ring-green-500 focus:ring-offset-gray-900"
                            checked={settings.sqlDebug ?? false}
                            onChange={(e) => toggleSqlDebug(e.target.checked)}
                        />
                        <div>
                            <span className="text-sm font-bold text-white block">SQL debug</span>
                            <span className="text-xs text-gray-500">Zobrazovat všechny SQL dotazy v konzoli serveru (pro vývojáře).</span>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    );
};
