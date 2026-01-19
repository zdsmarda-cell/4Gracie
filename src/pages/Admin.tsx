
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { 
    Product, Category, DiscountCode, PackagingType, DayConfig, 
    OrderStatus, User, DeliveryRegion, PickupLocation, 
    DiscountType, RegionException, Order, Language, DeliveryType 
} from '../types';
import { ALLERGENS } from '../constants';
import { 
    LayoutList, Plus, Edit, Trash2, Database, HardDrive, Server, 
    Download, Upload, FileText, Check, X, User as UserIcon, 
    Ban, ImageIcon, Store, Truck, Filter, Settings, Calendar, Mail, Smartphone, Map
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
import { EventsTab } from './admin/EventsTab';
import { EmailsTab } from './admin/EmailsTab';
import { MobileNotificationsTab } from './admin/MobileNotificationsTab';
import { RidesTab } from './admin/RidesTab'; // Import
import { Navigate } from 'react-router-dom';

export const Admin: React.FC = () => {
    const { 
        dataSource, setDataSource, t, isPreviewEnvironment, user
    } = useStore();

    if (!user || user.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    const [activeTab, setActiveTab] = useState('orders');
    
    const [filterDate, setFilterDate] = useState<string | null>(null);
    const [filterEventOnly, setFilterEventOnly] = useState(false);
    const [filterActiveOnly, setFilterActiveOnly] = useState(false); // NEW State
    const [emailFilter, setEmailFilter] = useState<string | null>(null);

    const handleNavigateToDate = (date: string) => {
        setFilterDate(date);
        setFilterEventOnly(false);
        setFilterActiveOnly(true); // Enable active filter when coming from Load tab
        setActiveTab('orders');
    };

    const handleNavigateToEventOrders = (date: string) => {
        setFilterDate(date);
        setFilterEventOnly(true);
        setFilterActiveOnly(true); // Usually events care about active load too
        setActiveTab('orders');
    };

    const handleNavigateToEmails = (email: string) => {
        setEmailFilter(email);
        setActiveTab('emails');
    };

    const clearFilters = () => {
        setFilterDate(null);
        setFilterEventOnly(false);
        setFilterActiveOnly(false);
    };

    const availableTabs = [
        'orders', 'rides', 'users', 'load', 'products', 'categories', // Rides added
        'delivery', 'pickup', 'capacities', 'events', 'discounts', 
        'packaging', 'operator', 'payments', 'emails', 'mobile_notifications', 'app_settings'
    ];

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
                    onClick={() => { setActiveTab(tab); setEmailFilter(null); }} 
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition whitespace-nowrap flex items-center ${activeTab === tab ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:bg-white/50'}`}
                    >
                    {tab === 'app_settings' && <Settings size={12} className="mr-1"/>}
                    {tab === 'events' && <Calendar size={12} className="mr-1"/>}
                    {tab === 'emails' && <Mail size={12} className="mr-1"/>}
                    {tab === 'mobile_notifications' && <Smartphone size={12} className="mr-1"/>}
                    {tab === 'rides' && <Map size={12} className="mr-1"/>}
                    {tab === 'db' ? t('admin.db') : tab === 'categories' ? t('admin.categories') : tab === 'pickup' ? t('admin.pickup') : tab === 'emails' ? 'Emaily' : tab === 'mobile_notifications' ? 'Mobilní Notifikace' : tab === 'rides' ? t('admin.rides') : t(`admin.${tab}`)}
                    </button>
                ))}
                </div>
            </div>

            {/* Modular Tabs */}
            {activeTab === 'orders' && <OrdersTab initialDate={filterDate} initialEventOnly={filterEventOnly} initialActiveOnly={filterActiveOnly} onClearFilters={clearFilters} />}
            {activeTab === 'rides' && <RidesTab />}
            {activeTab === 'users' && <UsersTab onNavigateToEmails={handleNavigateToEmails} />}
            {activeTab === 'products' && <ProductsTab />}
            {activeTab === 'discounts' && <DiscountsTab />}
            {activeTab === 'delivery' && <DeliveryTab />}
            {activeTab === 'pickup' && <PickupTab />}
            {activeTab === 'categories' && <CategoriesTab />}
            {activeTab === 'packaging' && <PackagingTab />}
            {activeTab === 'capacities' && <CapacitiesTab />}
            {activeTab === 'events' && <EventsTab onNavigateToOrders={handleNavigateToEventOrders} />}
            {activeTab === 'operator' && <OperatorTab />}
            {activeTab === 'payments' && <PaymentsTab />}
            {activeTab === 'app_settings' && <SettingsTab />}
            {activeTab === 'emails' && <EmailsTab initialRecipient={emailFilter} />}
            {activeTab === 'mobile_notifications' && <MobileNotificationsTab />}
            {activeTab === 'load' && <LoadTab onNavigateToDate={handleNavigateToDate} />}

            {/* Inline Tabs (DB) */}
            {activeTab === 'db' && (
                <div className="animate-fade-in space-y-8">
                <div className="bg-white p-8 rounded-2xl border shadow-sm max-w-2xl mx-auto text-center">
                    <h2 className="text-2xl font-bold mb-6 flex items-center justify-center gap-2">
                        <Database className="text-accent" /> Databázové připojení
                    </h2>
                    
                    {!isPreviewEnvironment && (
                        <div className="bg-blue-50 text-blue-700 p-4 rounded-xl mb-6 text-sm font-bold border border-blue-200">
                            Aplikace běží v produkčním režimu. Připojení k DB je vynuceno.
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => { if (isPreviewEnvironment && dataSource !== 'api') setDataSource('local'); }}
                            disabled={!isPreviewEnvironment || dataSource === 'api'}
                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${dataSource === 'local' ? 'border-accent bg-yellow-50/50' : (!isPreviewEnvironment || dataSource === 'api') ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed' : 'border-gray-200 hover:bg-gray-50'}`}
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
