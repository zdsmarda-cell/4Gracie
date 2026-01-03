
import React from 'react';
import { useStore } from '../../context/StoreContext';

export const OperatorTab: React.FC = () => {
    const { settings, updateSettings, t } = useStore();

    const saveOperator = async (e: React.FormEvent) => {
        e.preventDefault();
        await updateSettings({ ...settings });
        alert('Nastavení uloženo.');
    };

    return (
        <div className="animate-fade-in max-w-2xl bg-white p-8 rounded-2xl border shadow-sm">
            <h2 className="text-xl font-bold mb-6">{t('admin.company_data')}</h2>
            <form onSubmit={saveOperator} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-400 block mb-1">Název</label><input className="w-full border rounded p-2" value={settings.companyDetails.name} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, name: e.target.value}})} /></div>
                <div><label className="text-xs font-bold text-gray-400 block mb-1">Email</label><input className="w-full border rounded p-2" value={settings.companyDetails.email} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, email: e.target.value}})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-400 block mb-1">Telefon</label><input className="w-full border rounded p-2" value={settings.companyDetails.phone} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, phone: e.target.value}})} /></div>
                <div><label className="text-xs font-bold text-gray-400 block mb-1">Web/Jiné</label><input className="w-full border rounded p-2" disabled value="www.4gracie.cz" /></div>
                </div>
                <hr className="border-gray-100" />
                <div><label className="text-xs font-bold text-gray-400 block mb-1">Ulice</label><input className="w-full border rounded p-2" value={settings.companyDetails.street} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, street: e.target.value}})} /></div>
                <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-400 block mb-1">Město</label><input className="w-full border rounded p-2" value={settings.companyDetails.city} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, city: e.target.value}})} /></div>
                <div><label className="text-xs font-bold text-gray-400 block mb-1">PSČ</label><input className="w-full border rounded p-2" value={settings.companyDetails.zip} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, zip: e.target.value}})} /></div>
                </div>
                <hr className="border-gray-100" />
                <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-400 block mb-1">IČ</label><input className="w-full border rounded p-2" value={settings.companyDetails.ic} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, ic: e.target.value}})} /></div>
                <div><label className="text-xs font-bold text-gray-400 block mb-1">DIČ</label><input className="w-full border rounded p-2" value={settings.companyDetails.dic} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, dic: e.target.value}})} /></div>
                </div>
                <div><label className="text-xs font-bold text-gray-400 block mb-1">Číslo účtu</label><input className="w-full border rounded p-2" value={settings.companyDetails.bankAccount} onChange={e => updateSettings({...settings, companyDetails: {...settings.companyDetails, bankAccount: e.target.value}})} /></div>
                <div className="pt-4"><button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg font-bold shadow-lg">Uložit změny</button></div>
            </form>
        </div>
    );
};
