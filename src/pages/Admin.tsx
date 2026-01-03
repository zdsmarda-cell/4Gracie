
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Database, HardDrive, Server, Download, Upload, FileText, Check } from 'lucide-react';
import { OrdersTab } from './admin/OrdersTab';
import { UsersTab } from './admin/UsersTab';
import { ProductsTab } from './admin/ProductsTab';
import { DiscountsTab } from './admin/DiscountsTab';
import { DeliveryTab, PickupTab } from './admin/LogisticsTabs';
import { CategoriesTab } from './admin/CategoriesTab';
import { PackagingTab } from './admin/PackagingTab';
import { CapacitiesTab } from './admin/CapacitiesTab';
import { OperatorTab } from './admin/OperatorTab';
import { PaymentsTab } from './admin/PaymentsTab';
import { LoadTab } from './admin/LoadTab';

export const Admin: React.FC = () => {
    const { 
        dataSource, setDataSource, allUsers, orders, products, discountCodes, dayConfigs, settings, 
        importDatabase, t, formatDate
    } = useStore();

    const [activeTab, setActiveTab] = useState('orders');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [restoreSelection, setRestoreSelection] = useState<Record<string, boolean>>({
        users: true, orders: true, products: true, discountCodes: true, dayConfigs: true, settings: true
    });
    
    // For Navigation from Load Tab to Orders Tab
    const [filterDate, setFilterDate] = useState<string | null>(null);

    const getRestoreLabel = (key: string) => {
        switch(key) {
            case 'users': return t('admin.users');
            case 'orders': return t('admin.orders');
            case 'products': return t('admin.products');
            case 'discountCodes': return t('admin.discounts');
            case 'dayConfigs': return t('admin.exceptions'); 
            case 'settings': return t('admin.settings');
            default: return key;
        }
    };

    const handleImport = async () => {
        if (!importFile) return;
        
        const readFile = (file: File): Promise<string> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target?.result as string);
                reader.onerror = e => reject(e);
                reader.readAsText(file);
            });
        };

        try {
            const text = await readFile(importFile);
            const data = JSON.parse(text);
            
            if (!window.confirm('Opravdu chcete přepsat stávající data? Tato akce je nevratná.')) return;
            
            const res = await importDatabase(data, restoreSelection);
            if (res.success) {
                alert(t('admin.import_success'));
                setImportFile(null);
            } else {
                alert('Import failed: ' + res.message);
            }
        } catch (e: any) {
            console.error(e);
            alert('Chyba při zpracování souboru: ' + e.message);
        }
    };

    const handleNavigateToDate = (date: string) => {
        setFilterDate(date);
        setActiveTab('orders');
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-serif font-bold text-gray-800 tracking-tight">{t('admin.dashboard')}</h1>
                <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl shadow-sm overflow-x-auto">
                {(['orders', 'users', 'load', 'products', 'categories', 'delivery', 'pickup', 'capacities', 'discounts', 'packaging', 'operator', 'payments', 'backup', 'db'] as const).map(tab => (
                    <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)} 
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition whitespace-nowrap ${activeTab === tab ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:bg-white/50'}`}
                    >
                    {tab === 'db' ? t('admin.db') : tab === 'categories' ? t('admin.categories') : tab === 'pickup' ? t('admin.pickup') : t(`admin.${tab}`)}
                    </button>
                ))}
                </div>
            </div>

            {/* Modular Tabs */}
            {activeTab === 'orders' && <OrdersTab initialDate={filterDate} onClearInitialDate={() => setFilterDate(null)} />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'products' && <ProductsTab />}
            {activeTab === 'discounts' && <DiscountsTab />}
            {activeTab === 'delivery' && <DeliveryTab />}
            {activeTab === 'pickup' && <PickupTab />}
            {activeTab === 'categories' && <CategoriesTab />}
            {activeTab === 'packaging' && <PackagingTab />}
            {activeTab === 'capacities' && <CapacitiesTab />}
            {activeTab === 'operator' && <OperatorTab />}
            {activeTab === 'payments' && <PaymentsTab />}
            {activeTab === 'load' && <LoadTab onNavigateToDate={handleNavigateToDate} />}

            {activeTab === 'db' && (
                <div className="animate-fade-in space-y-8">
                <div className="bg-white p-8 rounded-2xl border shadow-sm max-w-2xl mx-auto text-center">
                    <h2 className="text-2xl font-bold mb-6 flex items-center justify-center gap-2">
                        <Database className="text-accent" /> Databázové připojení
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => { if (dataSource !== 'api') setDataSource('local'); }}
                            disabled={dataSource === 'api'}
                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${dataSource === 'local' ? 'border-accent bg-yellow-50/50' : dataSource === 'api' ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                            <div className={`p-4 rounded-full ${dataSource === 'local' ? 'bg-accent text-white' : 'bg-gray-100 text-gray-400'}`}><HardDrive size={32} /></div>
                            <div><h3 className="font-bold text-lg">Interní paměť</h3></div>
                            {dataSource === 'local' && <Check className="text-green-500" />}
                        </button>
                        <button 
                            onClick={() => setDataSource('api')}
                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${dataSource === 'api' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                            <div className={`p-4 rounded-full ${dataSource === 'api' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}><Server size={32} /></div>
                            <div><h3 className="font-bold text-lg">MariaDB</h3></div>
                            {dataSource === 'api' && <Check className="text-green-500" />}
                        </button>
                    </div>
                </div>
                </div>
            )}

            {activeTab === 'backup' && (
            <div className="bg-white p-8 rounded-xl shadow-sm border max-w-2xl mx-auto animate-fade-in">
                <h2 className="text-xl font-bold mb-6 flex items-center justify-center gap-2"><Database className="text-primary"/> {t('admin.backup')}</h2>
                
                <div className="bg-gray-50 p-4 rounded-lg text-center mb-8 border">
                    <p className="text-sm text-gray-500 mb-1">Aktuální zdroj dat</p>
                    <p className="font-bold text-lg text-primary flex items-center justify-center gap-2">
                        {dataSource === 'api' ? <Server size={18} className="text-blue-600"/> : <HardDrive size={18} className="text-accent"/>}
                        {dataSource === 'api' ? 'MariaDB (Databáze)' : 'Lokální Paměť (Browser)'}
                    </p>
                </div>

                <div className="space-y-8">
                    <div>
                        <h3 className="font-bold text-lg mb-2 flex items-center"><Download size={18} className="mr-2"/> {t('admin.export_title')}</h3>
                        <p className="text-sm text-gray-500 mb-4">{t('admin.export_desc')}</p>
                        <button onClick={() => {
                            const data = { users: allUsers, orders, products, discountCodes, dayConfigs, settings };
                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `backup_4gracie_${formatDate(new Date().toISOString())}_${dataSource}.json`;
                            a.click();
                        }} className="w-full bg-primary text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center hover:bg-gray-800 transition"><Download size={20} className="mr-2"/> Stáhnout JSON Zálohu</button>
                    </div>

                    <div className="border-t pt-6">
                        <h3 className="font-bold text-lg mb-2 flex items-center"><Upload size={18} className="mr-2"/> {t('admin.import_title')}</h3>
                        <p className="text-sm text-gray-500 mb-4">{t('admin.import_desc')}</p>
                        
                        {dataSource === 'api' && (
                            <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-xs mb-4 flex items-start">
                                <Server size={16} className="mr-2 flex-shrink-0 mt-0.5"/>
                                Import proběhne jako transakce do databáze. Všechna stávající data budou nahrazena daty ze souboru.
                            </div>
                        )}

                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-gray-50 transition cursor-pointer relative mb-4">
                            <input 
                                type="file" 
                                accept=".json" 
                                onChange={e => setImportFile(e.target.files ? e.target.files[0] : null)} 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            {importFile ? (
                                <div className="text-green-600 font-bold flex flex-col items-center">
                                    <FileText size={32} className="mb-2"/>
                                    {importFile.name}
                                </div>
                            ) : (
                                <div className="text-gray-400 flex flex-col items-center">
                                    <Upload size={32} className="mb-2"/>
                                    <span>Klikněte pro výběr souboru</span>
                                </div>
                            )}
                        </div>

                        {importFile && (
                            <div className="mb-4 bg-gray-50 p-4 rounded-xl border">
                                <h4 className="font-bold text-sm mb-2">{t('admin.restore_sections')}</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {(Object.keys(restoreSelection) as Array<keyof typeof restoreSelection>).map(key => (
                                        <label key={key} className="flex items-center space-x-2 text-sm cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={restoreSelection[key]} 
                                                onChange={e => setRestoreSelection({...restoreSelection, [key]: e.target.checked})}
                                                className="rounded text-accent focus:ring-accent"
                                            />
                                            <span className="capitalize">{getRestoreLabel(key as string)}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {importFile && (
                            <button 
                                onClick={handleImport} 
                                className="mt-2 w-full bg-red-600 text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center hover:bg-red-700 transition shadow-lg"
                            >
                                <Upload size={20} className="mr-2"/> {t('admin.perform_import')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
            )}
        </div>
    );
};
