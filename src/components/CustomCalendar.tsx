
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DeliveryRegion, PickupLocation, CartItem } from '../types';

interface CustomCalendarProps {
  onSelect: (date: string) => void;
  selectedDate: string;
  checkAvailability: (date: string, items: CartItem[], excludeOrderId?: string) => any;
  cart: CartItem[];
  region?: DeliveryRegion;
  getRegionInfo: (region: DeliveryRegion, date: string) => any;
  pickupLocation?: PickupLocation;
  getPickupInfo: (location: PickupLocation, date: string) => any;
  excludeOrderId?: string; // ID objednávky pro vyloučení z kapacity (při editaci)
}

export const CustomCalendar: React.FC<CustomCalendarProps> = ({ 
  onSelect, 
  selectedDate, 
  checkAvailability, 
  cart, 
  region, 
  getRegionInfo, 
  pickupLocation, 
  getPickupInfo,
  excludeOrderId
}) => {
  // Inicializace na aktuální datum nebo datum vybrané (pokud existuje)
  const [viewDate, setViewDate] = useState(() => selectedDate ? new Date(selectedDate) : new Date());
  
  const monthNames = ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"];
  const dayNames = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay() || 7; // Monday = 1

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();
  
  const days = [];
  const totalDays = daysInMonth(currentMonth, currentYear);
  const startOffset = startDayOfMonth(currentMonth, currentYear) - 1;

  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let i = 1; i <= totalDays; i++) days.push(i);

  const handleMonthChange = (offset: number) => {
    setViewDate(new Date(currentYear, currentMonth + offset, 1));
  };

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-4 w-full">
      <div className="flex justify-between items-center mb-4">
        <button type="button" onClick={() => handleMonthChange(-1)} className="p-1 hover:bg-gray-100 rounded-full"><ChevronLeft size={20}/></button>
        <span className="font-bold text-sm text-primary uppercase tracking-widest">{monthNames[currentMonth]} {currentYear}</span>
        <button type="button" onClick={() => handleMonthChange(1)} className="p-1 hover:bg-gray-100 rounded-full"><ChevronRight size={20}/></button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map(d => <div key={d} className="text-center text-[9px] font-bold text-gray-400 uppercase">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="h-10" />;
          
          // Fix Timezone issues by constructing date string manually
          const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          
          // Pass excludeOrderId to verify availability correctly during editing
          const availability = checkAvailability(dateStr, cart, excludeOrderId);
          
          // Region Check
          let regionInfo = { isOpen: true, isException: false };
          if (region) {
            regionInfo = getRegionInfo(region, dateStr);
          }

          // Pickup Check
          let pickupInfo = { isOpen: true, isException: false };
          if (pickupLocation) {
            pickupInfo = getPickupInfo(pickupLocation, dateStr);
          }

          let bgColor = "bg-white hover:bg-gray-50";
          let textColor = "text-gray-900";
          let cursor = "cursor-pointer";
          let isBlocked = false;
          let title = '';
          
          if (availability.status === 'closed' || availability.status === 'full' || (region && !regionInfo.isOpen) || (pickupLocation && !pickupInfo.isOpen)) {
            bgColor = "bg-red-100 text-red-600";
            isBlocked = true;
            if (region && !regionInfo.isOpen) title = 'V tento den se do tohoto regionu nerozváží.';
            else if (pickupLocation && !pickupInfo.isOpen) title = 'V tento den má výdejní místo zavřeno.';
            else title = availability.reason || 'Obsazeno/Zavřeno';
          } else if (availability.status === 'exceeds') {
            bgColor = "bg-orange-100 text-orange-600";
            isBlocked = true;
            title = availability.reason || 'Kapacita překročena';
          } else if (availability.status === 'past' || availability.status === 'too_soon') {
            bgColor = "bg-gray-50 text-gray-300";
            isBlocked = true;
            title = availability.reason || 'Mimo povolený termín';
          }
          
          if (selectedDate === dateStr) bgColor = "bg-accent text-white";

          return (
            <button
              type="button"
              key={dateStr}
              disabled={isBlocked}
              onClick={() => onSelect(dateStr)}
              className={`h-10 text-[11px] font-bold rounded-lg transition-all flex flex-col items-center justify-center border border-transparent ${bgColor} ${textColor} ${isBlocked ? 'cursor-not-allowed opacity-80' : cursor}`}
              title={title}
            >
              <span>{day}</span>
              {((region && regionInfo.isException && regionInfo.isOpen) || (pickupLocation && pickupInfo.isException && pickupInfo.isOpen)) && (
                <span className="w-1 h-1 rounded-full bg-blue-500 mt-0.5"></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
