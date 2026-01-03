
import React from 'react';
import { useStore } from '../../context/StoreContext';

export const PaymentsTab: React.FC = () => {
    const { settings, updateSettings, t } = useStore();

    return (
        <div className="animate-fade-in max-w-2xl">
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h2 className="text-xl font-bold mb-6">{t('admin.payment_methods')}</h2>
                <div className="space-y-4">
                {settings.paymentMethods.map((pm, idx) => (
                    <div key={pm.id} className="flex items-center justify-between p-4 border rounded-xl bg-gray-50">
                    <div>
                        <h4 className="font-bold">{pm.label}</h4>
                        <p className="text-xs text-gray-500">{pm.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={pm.enabled} onChange={e => {
                            const newMethods = [...settings.paymentMethods];
                            newMethods[idx].enabled = e.target.checked;
                            updateSettings({...settings, paymentMethods: newMethods});
                        }} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                    </div>
                ))}
                </div>
            </div>
        </div>
    );
};
