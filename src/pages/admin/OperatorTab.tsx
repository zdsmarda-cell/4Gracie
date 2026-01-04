
import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { CompanyDetails } from '../../types';

export const OperatorTab: React.FC = () => {
    const { settings, updateSettings, t } = useStore();
    
    // Local state buffer to prevent immediate DB writes on keystroke
    const [formData, setFormData] = useState<CompanyDetails>(settings.companyDetails);

    // Sync local state if settings change externally (e.g. initial load)
    useEffect(() => {
        setFormData(settings.companyDetails);
    }, [settings.companyDetails]);

    const saveOperator = async (e: React.FormEvent) => {
        e.preventDefault();
        await updateSettings({ ...settings, companyDetails: formData });
    };

    return (
        <div className="animate-fade-in max-w-2xl bg-white p-8 rounded-2xl border shadow-sm">
            <h2 className="text-xl font-bold mb-6">{t('admin.company_data')}</h2>
            <form onSubmit={saveOperator} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.company_name')}</label><input className="w-full border rounded p-2" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.company_email')}</label><input className="w-full border rounded p-2" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.company_phone')}</label><input className="w-full border rounded p-2" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.company_web')}</label><input className="w-full border rounded p-2" disabled value="www.4gracie.cz" /></div>
                </div>
                <hr className="border-gray-100" />
                <div><label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.company_street')}</label><input className="w-full border rounded p-2" value={formData.street} onChange={e => setFormData({...formData, street: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.company_city')}</label><input className="w-full border rounded p-2" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.company_zip')}</label><input className="w-full border rounded p-2" value={formData.zip} onChange={e => setFormData({...formData, zip: e.target.value})} /></div>
                </div>
                <hr className="border-gray-100" />
                <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.company_ic')}</label><input className="w-full border rounded p-2" value={formData.ic} onChange={e => setFormData({...formData, ic: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.company_dic')}</label><input className="w-full border rounded p-2" value={formData.dic} onChange={e => setFormData({...formData, dic: e.target.value})} /></div>
                </div>
                <div><label className="text-xs font-bold text-gray-400 block mb-1">{t('admin.company_account')}</label><input className="w-full border rounded p-2" value={formData.bankAccount} onChange={e => setFormData({...formData, bankAccount: e.target.value})} /></div>
                <div className="pt-4"><button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg font-bold shadow-lg">{t('admin.save_changes')}</button></div>
            </form>
        </div>
    );
};
