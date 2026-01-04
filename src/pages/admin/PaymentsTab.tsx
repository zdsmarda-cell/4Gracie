
import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { PaymentMethodConfig } from '../../types';
import { generateTranslations } from '../../utils/aiTranslator';
import { Edit, Languages, Globe, X, Check } from 'lucide-react';

const TranslationViewModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    item: PaymentMethodConfig | null;
}> = ({ isOpen, onClose, item }) => {
    if (!isOpen || !item || !item.translations) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h3 className="text-xl font-serif font-bold text-primary flex items-center">
                        <Globe className="mr-2 text-accent" size={24}/> 
                        Překlady
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition"><X size={20}/></button>
                </div>

                <div className="space-y-4">
                    <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100">
                        <div className="flex justify-between items-center mb-1">
                            <h4 className="font-bold text-blue-800 text-sm">English</h4>
                            <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">EN</span>
                        </div>
                        <p className="text-sm font-bold text-gray-800">{item.translations.en?.label || '-'}</p>
                        <p className="text-xs text-gray-600 mt-1">{item.translations.en?.description || '-'}</p>
                    </div>

                    <div className="bg-yellow-50/50 rounded-xl p-3 border border-yellow-100">
                        <div className="flex justify-between items-center mb-1">
                            <h4 className="font-bold text-yellow-800 text-sm">Deutsch</h4>
                            <span className="bg-yellow-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">DE</span>
                        </div>
                        <p className="text-sm font-bold text-gray-800">{item.translations.de?.label || '-'}</p>
                        <p className="text-xs text-gray-600 mt-1">{item.translations.de?.description || '-'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const PaymentsTab: React.FC = () => {
    const { settings, updateSettings, t, tData } = useStore();
    const [editingMethod, setEditingMethod] = useState<PaymentMethodConfig | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [viewingTranslations, setViewingTranslations] = useState<PaymentMethodConfig | null>(null);

    const saveMethod = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMethod) return;
        
        if (settings.enableAiTranslation) {
            setIsTranslating(true);
        }

        const updatedMethod = { ...editingMethod };

        // Generate Translations if enabled
        if (settings.enableAiTranslation) {
            const translations = await generateTranslations({ 
                label: updatedMethod.label,
                description: updatedMethod.description
            });
            updatedMethod.translations = translations;
        }

        const newMethods = settings.paymentMethods.map(pm => 
            pm.id === updatedMethod.id ? updatedMethod : pm
        );

        await updateSettings({ ...settings, paymentMethods: newMethods });
        setIsTranslating(false);
        setEditingMethod(null);
    };

    return (
        <div className="animate-fade-in max-w-3xl">
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h2 className="text-xl font-bold mb-6">{t('admin.payment_methods')}</h2>
                <div className="space-y-4">
                {settings.paymentMethods.map((pm, idx) => (
                    <div key={pm.id} className="flex items-center justify-between p-4 border rounded-xl bg-gray-50 hover:bg-white hover:shadow-sm transition duration-200">
                        <div className="flex-1 mr-4">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-primary">{pm.label}</h4>
                                {pm.translations && (
                                    <button 
                                        onClick={() => setViewingTranslations(pm)}
                                        className="text-gray-400 hover:text-accent transition"
                                        title="Zobrazit překlady"
                                    >
                                        <Languages size={14} />
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-gray-500">{pm.description}</p>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setEditingMethod(pm)}
                                className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-full transition"
                                title="Upravit"
                            >
                                <Edit size={18} />
                            </button>

                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={pm.enabled} onChange={e => {
                                    const newMethods = [...settings.paymentMethods];
                                    newMethods[idx].enabled = e.target.checked;
                                    updateSettings({...settings, paymentMethods: newMethods});
                                }} />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                        </div>
                    </div>
                ))}
                </div>
            </div>

            <TranslationViewModal 
                isOpen={!!viewingTranslations} 
                onClose={() => setViewingTranslations(null)} 
                item={viewingTranslations} 
            />

            {editingMethod && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <form onSubmit={saveMethod} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-lg">Upravit metodu</h3>
                            <div className="bg-gray-100 px-2 py-1 rounded text-[10px] font-mono uppercase text-gray-500">{editingMethod.id}</div>
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">Název (Label)</label>
                            <input 
                                required 
                                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-accent outline-none transition" 
                                value={editingMethod.label} 
                                onChange={e => setEditingMethod({...editingMethod, label: e.target.value})} 
                            />
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-400 block mb-1">Popis (Description)</label>
                            <textarea 
                                required 
                                className="w-full border rounded-lg p-2.5 text-sm h-24 resize-none focus:ring-2 focus:ring-accent outline-none transition" 
                                value={editingMethod.description} 
                                onChange={e => setEditingMethod({...editingMethod, description: e.target.value})} 
                            />
                        </div>

                        {settings.enableAiTranslation && (
                            <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 flex items-start">
                                <Languages size={16} className="mr-2 flex-shrink-0 mt-0.5" />
                                Při uložení budou automaticky přegenerovány překlady do EN a DE pomocí AI.
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <button 
                                type="button" 
                                onClick={() => setEditingMethod(null)} 
                                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition"
                            >
                                {t('common.cancel')}
                            </button>
                            <button 
                                type="submit" 
                                disabled={isTranslating} 
                                className="flex-1 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-black transition shadow-lg flex justify-center items-center"
                            >
                                {isTranslating ? (
                                    <>
                                        <Languages size={16} className="mr-2 animate-pulse"/> 
                                        Překládám...
                                    </>
                                ) : (
                                    <>
                                        <Check size={16} className="mr-2"/>
                                        {t('common.save')}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
