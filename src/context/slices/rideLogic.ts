import React from 'react';
import { Ride, DataSourceMode, Order, Product, GlobalSettings } from '../../types';
import { generateRoutePdf } from '../../utils/pdfGenerator';

interface UseRideLogicProps {
    dataSource: DataSourceMode;
    apiCall: (endpoint: string, method: string, body?: any) => Promise<any>;
    setRides: React.Dispatch<React.SetStateAction<Ride[]>>;
    orders: Order[];
    products: Product[];
    settings: GlobalSettings;
    showNotify: (msg: string) => void;
}

export const useRideLogic = ({ dataSource, apiCall, setRides, orders, products, settings, showNotify }: UseRideLogicProps) => {

    const updateRide = async (ride: Ride): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall('/api/admin/rides', 'POST', ride);
            if (res && res.success) {
                setRides(prev => {
                    const exists = prev.find(r => r.id === ride.id);
                    if (exists) return prev.map(r => r.id === ride.id ? ride : r);
                    return [...prev, ride];
                });
                return true;
            }
            return false;
        } else {
            setRides(prev => {
                const exists = prev.find(r => r.id === ride.id);
                if (exists) return prev.map(r => r.id === ride.id ? ride : r);
                return [...prev, ride];
            });
            return true;
        }
    };

    const deleteRide = async (rideId: string): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall(`/api/admin/rides/${rideId}`, 'DELETE');
            if (res && res.success) {
                setRides(prev => prev.filter(r => r.id !== rideId));
                showNotify('Jízda smazána (žádné objednávky).');
                return true;
            }
            return false;
        } else {
            setRides(prev => prev.filter(r => r.id !== rideId));
            showNotify('Jízda smazána.');
            return true;
        }
    };

    const printRouteSheet = async (ride: Ride, driverName: string) => {
        const blob = await generateRoutePdf(ride, orders, products, settings, driverName);
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `rozvoz_${ride.id}.pdf`;
        a.click();
    };

    return {
        updateRide,
        deleteRide,
        printRouteSheet
    };
};