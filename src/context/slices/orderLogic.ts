
import React, { useCallback } from 'react';
import { Order, OrderStatus, DataSourceMode, Language, Ride, GlobalSettings } from '../../types';

interface UseOrderLogicProps {
    dataSource: DataSourceMode;
    apiCall: (endpoint: string, method: string, body?: any) => Promise<any>;
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    setRides: React.Dispatch<React.SetStateAction<Ride[]>>;
    rides: Ride[];
    orders?: Order[]; // Added optional prop for local access
    language: Language;
    settings: GlobalSettings;
    showNotify: (msg: string) => void;
    t: (key: string) => string;
}

export const useOrderLogic = ({ dataSource, apiCall, setOrders, setRides, rides, orders = [], language, settings, showNotify, t }: UseOrderLogicProps) => {

    const addOrder = useCallback(async (order: Order): Promise<boolean> => {
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
    }, [dataSource, apiCall, setOrders, language, settings.companyDetails, showNotify, t]);

    const updateOrder = useCallback(async (order: Order, sendNotify?: boolean, isUserEdit?: boolean): Promise<boolean> => {
        let updatedOrder = { ...order };
        
        if (updatedOrder.items.length === 0) {
            updatedOrder.status = OrderStatus.CANCELLED;
            if (!updatedOrder.statusHistory?.some(h => h.status === OrderStatus.CANCELLED)) {
                updatedOrder.statusHistory = [...(updatedOrder.statusHistory || []), { status: OrderStatus.CANCELLED, date: new Date().toISOString() }];
            }
        }

        const affectedRide = rides.find(r => r.orderIds.includes(order.id));
        if (affectedRide && affectedRide.status === 'planned') {
            const newRide = { ...affectedRide, steps: [] }; 
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
    }, [dataSource, apiCall, setOrders, setRides, rides, showNotify, t]);

    const updateOrderStatus = useCallback(async (ids: string[], status: OrderStatus, notify?: boolean, sendPush?: boolean): Promise<boolean> => {
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
    }, [dataSource, apiCall, setOrders, showNotify, t]);

    const searchOrders = useCallback(async (filters: any) => {
        if (dataSource === 'api') {
            const q = new URLSearchParams(filters).toString();
            const res = await apiCall(`/api/orders?${q}`, 'GET');
            if (res && res.success) return res;
            return { orders: [], total: 0, page: 1, pages: 1 };
        } else {
            // Local fallback logic for filtering orders array
            let filtered = [...orders];

            if (filters.id) {
                filtered = filtered.filter(o => o.id.toLowerCase().includes(filters.id.toLowerCase()));
            }
            if (filters.userId) {
                filtered = filtered.filter(o => o.userId === filters.userId);
            }
            if (filters.dateFrom) {
                filtered = filtered.filter(o => o.deliveryDate >= filters.dateFrom);
            }
            if (filters.dateTo) {
                filtered = filtered.filter(o => o.deliveryDate <= filters.dateTo);
            }
            if (filters.createdFrom) {
                filtered = filtered.filter(o => o.createdAt >= filters.createdFrom);
            }
            if (filters.createdTo) {
                filtered = filtered.filter(o => o.createdAt <= filters.createdTo);
            }
            if (filters.status) {
                const statuses = filters.status.split(',').filter((s: string) => s.trim() !== '');
                if (statuses.length > 0) {
                    filtered = filtered.filter(o => statuses.includes(o.status));
                }
            }
            if (filters.customer) {
                filtered = filtered.filter(o => o.userName?.toLowerCase().includes(filters.customer.toLowerCase()));
            }
            if (filters.deliveryType) {
                filtered = filtered.filter(o => o.deliveryType === filters.deliveryType);
            }
            if (filters.isPaid === 'yes') filtered = filtered.filter(o => o.isPaid);
            if (filters.isPaid === 'no') filtered = filtered.filter(o => !o.isPaid);
            
            // Sorting (Default: deliveryDate DESC)
            if (filters.sort) {
                 const key = filters.sort;
                 const dir = filters.order === 'asc' ? 1 : -1;
                 filtered.sort((a: any, b: any) => {
                     if (a[key] < b[key]) return -1 * dir;
                     if (a[key] > b[key]) return 1 * dir;
                     return 0;
                 });
            } else {
                 // Default sort
                 filtered.sort((a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime());
            }

            const page = Number(filters.page) || 1;
            const limit = Number(filters.limit) || 50;
            const startIndex = (page - 1) * limit;
            const paginated = filtered.slice(startIndex, startIndex + limit);

            return { 
                orders: paginated, 
                total: filtered.length, 
                page: page, 
                pages: Math.ceil(filtered.length / limit) 
            };
        }
    }, [dataSource, apiCall, orders]);

    return {
        addOrder,
        updateOrder,
        updateOrderStatus,
        searchOrders
    };
};
