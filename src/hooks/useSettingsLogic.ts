
import { useState, useCallback } from 'react';
import { GlobalSettings, DayConfig, DiscountCode, EventSlot, DataSourceMode } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

interface UseSettingsLogicProps {
    dataSource: DataSourceMode;
    apiCall: (endpoint: string, method: string, body?: any) => Promise<any>;
    showNotify: (msg: string) => void;
    t: (key: string) => string;
}

export const useSettingsLogic = ({ dataSource, apiCall, showNotify, t }: UseSettingsLogicProps) => {
    const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
    const [dayConfigs, setDayConfigs] = useState<DayConfig[]>([]);
    const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);

    const updateSettings = useCallback(async (s: GlobalSettings): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall('/api/settings', 'POST', s);
            if (res && res.success) { setSettings(s); showNotify(t('notification.saved')); return true; }
            return false;
        } else {
            setSettings(s); return true;
        }
    }, [dataSource, apiCall, showNotify, t]);

    const updateDayConfig = useCallback(async (c: DayConfig): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall('/api/calendar', 'POST', c);
            if (res && res.success) {
                setDayConfigs(prev => { const exists = prev.find(d => d.date === c.date); return exists ? prev.map(d => d.date === c.date ? c : d) : [...prev, c]; });
                showNotify('Kalendář aktualizován v DB.'); return true;
            }
            return false;
        } else {
            setDayConfigs(prev => { const exists = prev.find(d => d.date === c.date); return exists ? prev.map(d => d.date === c.date ? c : d) : [...prev, c]; });
            return true;
        }
    }, [dataSource, apiCall, showNotify]);

    const removeDayConfig = useCallback(async (date: string): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall(`/api/calendar/${date}`, 'DELETE');
            if (res && res.success) { setDayConfigs(prev => prev.filter(d => d.date !== date)); showNotify('Výjimka smazána z DB.'); return true; }
            return false;
        } else {
            setDayConfigs(prev => prev.filter(d => d.date !== date)); return true;
        }
    }, [dataSource, apiCall, showNotify]);

    const updateEventSlot = useCallback(async (slot: EventSlot): Promise<boolean> => {
        const newSlots = [...(settings.eventSlots || [])];
        const idx = newSlots.findIndex(s => s.date === slot.date);
        if (idx > -1) newSlots[idx] = slot;
        else newSlots.push(slot);
        return await updateSettings({ ...settings, eventSlots: newSlots });
    }, [settings, updateSettings]);

    const removeEventSlot = useCallback(async (date: string): Promise<boolean> => {
        const newSlots = (settings.eventSlots || []).filter(s => s.date !== date);
        return await updateSettings({ ...settings, eventSlots: newSlots });
    }, [settings, updateSettings]);

    const notifyEventSubscribers = useCallback(async (date: string): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall('/api/admin/notify-event', 'POST', { date });
            if (res && res.success) showNotify(`Notifikace odeslána ${res.count} odběratelům.`);
            return true;
        }
        return false;
    }, [dataSource, apiCall, showNotify]);

    const addDiscountCode = useCallback(async (c: DiscountCode): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall('/api/discounts', 'POST', c);
            if (res && res.success) { setDiscountCodes(prev => [...prev, c]); showNotify('Slevový kód uložen do DB.'); return true; }
            return false;
        } else {
            setDiscountCodes(prev => [...prev, c]); return true;
        }
    }, [dataSource, apiCall, showNotify]);

    const updateDiscountCode = useCallback(async (c: DiscountCode): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall('/api/discounts', 'POST', c);
            if (res && res.success) { setDiscountCodes(prev => prev.map(x => x.id === c.id ? c : x)); showNotify('Slevový kód aktualizován v DB.'); return true; }
            return false;
        } else {
            setDiscountCodes(prev => prev.map(x => x.id === c.id ? c : x)); return true;
        }
    }, [dataSource, apiCall, showNotify]);

    const deleteDiscountCode = useCallback(async (id: string): Promise<boolean> => {
        if (dataSource === 'api') {
            const res = await apiCall(`/api/discounts/${id}`, 'DELETE');
            if (res && res.success) { setDiscountCodes(prev => prev.filter(x => x.id !== id)); showNotify('Slevový kód smazán z DB.'); return true; }
            return false;
        } else {
            setDiscountCodes(prev => prev.filter(x => x.id !== id)); return true;
        }
    }, [dataSource, apiCall, showNotify]);

    return {
        settings,
        setSettings,
        dayConfigs,
        setDayConfigs,
        discountCodes,
        setDiscountCodes,
        updateSettings,
        updateDayConfig,
        removeDayConfig,
        updateEventSlot,
        removeEventSlot,
        notifyEventSubscribers,
        addDiscountCode,
        updateDiscountCode,
        deleteDiscountCode
    };
};
