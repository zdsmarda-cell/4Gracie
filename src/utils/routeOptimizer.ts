
import { Order, RideStep, GlobalSettings, Ride } from "../types";

// Asynchronous optimizer that calls the backend AI
export const calculateOptimalRoute = async (
    orders: Order[], 
    departureTime: string, 
    settings: GlobalSettings,
    apiCall: (endpoint: string, method: string, body?: any) => Promise<any>
): Promise<RideStep[]> => {
    
    // Prepare payload for AI
    const depotAddress = `${settings.companyDetails.street}, ${settings.companyDetails.city}`;
    
    const ordersPayload = orders.map(o => ({
        id: o.id,
        address: o.deliveryAddress || `${o.deliveryStreet}, ${o.deliveryCity}`,
        isPaid: o.isPaid,
        itemsCount: o.items.reduce((s, i) => s + i.quantity, 0),
        customerName: o.deliveryName || o.userName,
        customerPhone: o.deliveryPhone,
        note: o.note
    }));

    const logisticsSettings = settings.logistics || {
        stopTimeMinutes: 5,
        loadingSecondsPerItem: 30,
        unloadingPaidSeconds: 120,
        unloadingUnpaidSeconds: 300
    };

    try {
        const response = await apiCall('/api/admin/optimize-route', 'POST', {
            depot: depotAddress,
            orders: ordersPayload,
            departureTime,
            settings: logisticsSettings
        });

        if (response && response.success && Array.isArray(response.steps)) {
            // Merge AI result with local data to ensure all fields are present
            return response.steps.map((step: any) => {
                const originalOrder = orders.find(o => o.id === step.orderId);
                return {
                    ...step,
                    // Ensure these exist even if AI omits them (fallback)
                    customerName: originalOrder?.deliveryName || originalOrder?.userName || step.customerName,
                    customerPhone: originalOrder?.deliveryPhone || step.customerPhone,
                    note: originalOrder?.note || step.note,
                    isPaid: originalOrder?.isPaid ?? step.isPaid
                };
            });
        } else {
            console.warn("AI Route Optimization failed or returned invalid format. Falling back to simple list.");
            throw new Error(response?.error || 'Unknown AI error');
        }
    } catch (e) {
        console.error("Routing Error:", e);
        // Fallback: Return simple list without times if AI fails, flagging error
        return orders.map(o => ({
            orderId: o.id,
            type: 'delivery',
            address: o.deliveryAddress || 'N/A',
            arrivalTime: '??:??',
            departureTime: '??:??',
            customerName: o.deliveryName,
            customerPhone: o.deliveryPhone,
            error: 'AI connection failed'
        }));
    }
};
