
import { useState, useCallback } from 'react';
import { DataSourceMode } from '../types';

export const useApi = (
  initialDataSource: DataSourceMode,
  getFullApiUrl: (endpoint: string) => string,
  logout: () => void,
  showNotify: (msg: string, type?: 'success' | 'error', autoClose?: boolean) => void
) => {
  const [dataSource, setDataSourceState] = useState<DataSourceMode>(initialDataSource);
  const [isLoading, setIsLoading] = useState(true);
  const [isOperationPending, setIsOperationPending] = useState(false);
  const [dbConnectionError, setDbConnectionError] = useState(false);

  const setDataSource = (mode: DataSourceMode) => {
    localStorage.setItem('app_data_source', mode);
    setDataSourceState(mode);
  };

  const apiCall = useCallback(async (endpoint: string, method: string, body?: any) => {
    const controller = new AbortController();
    setIsOperationPending(true);
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            controller.abort();
            reject(new Error('TIMEOUT_LIMIT_REACHED'));
        }, 15000); 
    });

    try {
      const url = getFullApiUrl(endpoint);
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res: any = await Promise.race([
        fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        }),
        timeoutPromise
      ]);
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Server returned invalid data.");
      }
      
      if (res.status === 401) {
          logout();
          throw new Error('Unauthorized');
      }

      if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || `API Error: ${res.status}`);
      }
      
      setDbConnectionError(false);
      return await res.json();
    } catch (e: any) {
      // @ts-ignore
      const isProd = import.meta?.env?.PROD;
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if ((isProd && !isLocalhost) || e.message === 'TIMEOUT_LIMIT_REACHED' || e.message.includes('fetch failed')) {
         setDbConnectionError(true);
      } 
      console.warn(`[API] Call to ${endpoint} failed:`, e);
      return null;
    } finally {
        setIsOperationPending(false); 
    }
  }, [getFullApiUrl, logout]);

  return {
    dataSource,
    setDataSource,
    isLoading,
    setIsLoading,
    isOperationPending,
    dbConnectionError,
    setDbConnectionError,
    apiCall
  };
};
