import React from 'react';
import { Order, OrderStatus, DataSourceMode, Language, Ride, GlobalSettings } from '../../types';

interface UseOrderLogicProps {
    dataSource: DataSourceMode;
    apiCall: (endpoint: string, method: string, body?: any) => Promise<any>;
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    setRides: React.Dispatch<React.SetStateAction<Ride[]>>;
    rides: Ride[];
    language: Language;
    settings: GlobalSettings;
    showNotify: (msg: string) => void;
    t: (key: string) => string;
}

export const useOrderLogic = ({ dataSource, apiCall, setOrders, setRides, rides, language, settings, showNotify, t }: UseOrderLogicProps) => {

    const addOrder = async (order: Order): Promise<boolean> => {
        const orderWithHistory: Order = {
            ...order,
            language: language,
            companyDetailsSnapshot: JSON.parse(JSON.stringify(settings.companyDetails)),
            statusHistory: [{ status: order.status, date: new Date().toISOString() }]
        };
        
        if (dataSource === 'api') {
            const res = await apiCall('/api/orders', 'POST', orderWithHistory);
            if (res && res.success) {
                setOrders(prev => [orderWithHistory, ...prev]);
                showNotify(t('notification.order_created').replace('{id}', order.id));
                return true;
            }
            return false;
        } else {
            setOrders(prev => [orderWithHistory, ...prev]);
            showNotify(t('notification.order_created').replace('{id}', order.id));
            return true;
        }
    };

    const updateOrder = async (order: Order, sendNotify?: boolean, isUserEdit?: boolean): Promise<boolean> => {
        let updatedOrder = { ...order };
        
        // Auto-cancel if empty
        if (updatedOrder.items.length === 0) {
            updatedOrder.status = OrderStatus.CANCELLED;
            if (!updatedOrder.statusHistory?.some(h => h.status === OrderStatus.CANCELLED)) {
                updatedOrder.statusHistory = [...(updatedOrder.statusHistory || []), { status: OrderStatus.CANCELLED, date: new Date().toISOString() }];
            }
        }

        // Cleanup rides if order parameters changed that affect logistics (Date, Address)
        // We find rides in the *current state* passed via props (which comes from StoreContext state)
        const affectedRide = rides.find(r => r.orderIds.includes(order.id));
        if (affectedRide && affectedRide.status === 'planned') {
            // Note: We don't have access to the old order state easily here without passing it or finding it.
            // Assuming the caller might handle logic or we force update if it's in a ride.
            // Simplified: If in planned ride, force reset steps.
            const newRide = { ...affectedRide, steps: [] }; // Reset route calculation
            
            if (dataSource === 'api') apiCall('/api/admin/rides', 'POST', newRide);
            setRides(prev => prev.map(r => r.id === newRide.id ? newRide : r));
        }

        if (dataSource === 'api') {
            const res = await apiCall('/api/orders', 'POST', { ...updatedOrder, sendNotify });
            if (res && res.success) {
                setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
                if (updatedOrder.status === OrderStatus.CREATED) showNotify(t('notification.saved'));
                return true;
            }
            return false;
        } else {
            setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
            showNotify(t('notification.saved'));
            return true;
        }
    };

    const updateOrderStatus = async (ids: string[], status: OrderStatus, notify?: boolean, sendPush?: boolean): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall('/api/orders/status', 'PUT', { ids, status, notifyCustomer: notify, sendPush });
            if (res && res.success) {
                setOrders(prev => prev.map(o => {
                    if (ids.includes(o.id)) {
                        return { ...o, status, statusHistory: [...(o.statusHistory || []), { status, date: new Date().toISOString() }] };
                    }
                    return o;
                }));
                const msg = notify ? `${t('notification.saved')} + ${t('notification.email_sent')}` : t('notification.saved');
                showNotify(msg);
                return true;
            }
            return false;
        } else {
            setOrders(prev => prev.map(o => {
                if (ids.includes(o.id)) {
                    return { ...o, status, statusHistory: [...(o.statusHistory || []), { status, date: new Date().toISOString() }] };
                }
                return o;
            }));
            showNotify(t('notification.saved'));
            return true;
        }
    };

    const searchOrders = async (filters: any) => {
        if (dataSource === 'api') {
            const q = new URLSearchParams(filters).toString();
            const res = await apiCall(`/api/orders?${q}`, 'GET');
            if (res && res.success) return res;
            return { orders: [], total: 0, page: 1, pages: 1 };
        } else {
            // Local mock search not fully implemented
            return { orders: [], total: 0, page: 1, pages: 1 };
        }
    };

    return {
        addOrder,
        updateOrder,
        updateOrderStatus,
        searchOrders
    };
};