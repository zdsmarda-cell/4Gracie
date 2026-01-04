
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { 
    Product, Category, DiscountCode, PackagingType, DayConfig, 
    OrderStatus, User, DeliveryRegion, PickupLocation, 
    DiscountType, RegionException, Order, Language, DeliveryType 
} from '../types';
import { ALLERGENS } from '../constants';
import { 
    LayoutList, Plus, Edit, Trash2, Database, HardDrive, Server, 
    Check, X, User as UserIcon, 
    Ban, ImageIcon, Store, Truck, Filter, Settings 
} from 'lucide-react';
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
import { SettingsTab } from './admin/SettingsTab';
import { Navigate } from 'react-router-dom';

export const Admin: React.FC = () => {
    const { 
        dataSource, setDataSource, t, isPreviewEnvironment, user, refreshData
    } = useStore();

    // Guard Clause: Redirect if not logged in or not admin
    if (!user || user.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    const [activeTab, setActiveTab] = useState('orders');
    
    // Refresh data when tab changes to ensure fresh DB content
    useEffect(() => {
        refreshData();
    }, [activeTab, refreshData]);
    
    // Navigation State (Load -> Orders)
    const [filterDate, setFilterDate] = useState<string | null>(null);

    const handleNavigateToDate = (date: string) => {
        setFilterDate(date);
        setActiveTab('orders');
    };

    // Determine available tabs
    const availableTabs = [
        'orders', 'users', 'load', 'products', 'categories', 
        'delivery', 'pickup', 'capacities', 'discounts', 
        'packaging', 'operator', 'payments', 'app_settings'
    ];

    // Only show 'db' tab in preview environment (localhost, dev, blob)
    if (isPreviewEnvironment) {
        availableTabs.push('db');
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-3xl font-serif font-bold text-gray-800 tracking-tight">{t('admin.dashboard')}</h1>
                <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl shadow-sm overflow-x-auto">
                {availableTabs.map(tab => (
                    <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)} 
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition whitespace-nowrap flex items-center ${activeTab === tab ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:bg-white/50'}`}
                    >
                    {tab === 'app_settings' && <Settings size={12} className="mr-1"/>}
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
            {activeTab === 'app_settings' && <SettingsTab />}
            {activeTab === 'load' && <LoadTab onNavigateToDate={handleNavigateToDate} />}

            {/* Inline Tabs (DB) */}
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
        </div>
    );
};
