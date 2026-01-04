
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { OrderStatus, DeliveryType } from '../types';
import { Phone, MapPin, Check, Navigation, ChevronLeft, ChevronRight, Ban, Map } from 'lucide-react';

export const Driver: React.FC = () => {
  const { orders, updateOrderStatus, t, formatDate } = useStore();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const deliveryOrders = useMemo(() => {
    return orders
      .filter(o => 
        o.deliveryType === DeliveryType.DELIVERY && 
        o.deliveryDate === selectedDate && 
        o.status !== OrderStatus.CANCELLED
      )
      .sort((a, b) => {
        if (a.status === OrderStatus.DELIVERED && b.status !== OrderStatus.DELIVERED) return 1;
        if (a.status !== OrderStatus.DELIVERED && b.status === OrderStatus.DELIVERED) return -1;
        return 0;
      });
  }, [orders, selectedDate]);

  const handleDateChange = (offset: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + offset);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const markDelivered = async (id: string) => {
    if (confirm(t('driver.complete') + '?')) {
      await updateOrderStatus([id], OrderStatus.DELIVERED, true);
    }
  };

  const getMapLink = (street: string, city: string) => {
    const query = `${street}, ${city}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white p-4 sticky top-0 z-10 shadow-sm border-b">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-primary flex items-center">
            <Navigation className="mr-2 text-accent" /> {t('driver.title')}
          </h1>
          <div className="text-xs font-bold bg-accent/10 text-accent px-2 py-1 rounded">
            {deliveryOrders.filter(o => o.status !== OrderStatus.DELIVERED).length} / {deliveryOrders.length}
          </div>
        </div>
        
        <div className="flex items-center justify-between bg-gray-100 rounded-xl p-1">
          <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-white rounded-lg transition"><ChevronLeft size={20}/></button>
          <span className="font-bold font-mono">{formatDate(selectedDate)}</span>
          <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-white rounded-lg transition"><ChevronRight size={20}/></button>
        </div>
      </div>

      {/* Orders List */}
      <div className="p-4 space-y-4">
        {deliveryOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Ban size={48} className="mx-auto mb-2 opacity-20"/>
            <p>{t('driver.no_orders')}</p>
          </div>
        ) : (
          deliveryOrders.map(order => {
            const isDelivered = order.status === OrderStatus.DELIVERED;
            const phone = order.deliveryPhone;
            const mapLink = getMapLink(order.deliveryStreet || '', order.deliveryCity || '');
            const total = order.totalPrice + order.packagingFee + order.deliveryFee;
            
            return (
              <div key={order.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${isDelivered ? 'opacity-60 grayscale' : ''}`}>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-lg">#{order.id}</div>
                    <div className="text-right">
                      {!order.isPaid && (
                        <div className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-xs mb-1">
                          {t('driver.collect')}: {total} Kč
                        </div>
                      )}
                      {order.isPaid && <div className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">Zaplaceno</div>}
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    <div className="flex items-start">
                      <div className="min-w-[24px] pt-1"><MapPin size={16} className="text-gray-400"/></div>
                      <div className="text-sm">
                          <div className="font-bold">{order.deliveryName}</div>
                          <div>{order.deliveryStreet}</div>
                          <div>{order.deliveryZip} {order.deliveryCity}</div>
                      </div>
                    </div>
                    {order.note && (
                      <div className="bg-yellow-50 p-2 rounded text-xs text-yellow-800 border border-yellow-100">
                        Note: {order.note}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <a href={mapLink} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-600">
                      <Map size={20} className="mb-1 text-blue-500"/>
                      {t('driver.map')}
                    </a>
                    {phone ? (
                      <a href={`tel:${phone}`} className="flex flex-col items-center justify-center p-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-600">
                        <Phone size={20} className="mb-1 text-green-500"/>
                        {t('driver.call')}
                      </a>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-2 bg-gray-50 rounded-xl text-xs font-bold text-gray-300">
                        <Phone size={20} className="mb-1"/>
                        {t('driver.call')}
                      </div>
                    )}
                    {!isDelivered ? (
                      <button onClick={() => markDelivered(order.id)} className="flex flex-col items-center justify-center p-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-gray-800">
                        <Check size={20} className="mb-1"/>
                        {t('driver.complete')}
                      </button>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-2 bg-green-100 text-green-700 rounded-xl text-xs font-bold">
                        <Check size={20} className="mb-1"/>
                        {t('status.delivered')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
