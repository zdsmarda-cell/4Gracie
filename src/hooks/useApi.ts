
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

  const apiCall = useCallback(async (endpoint: string, method: string, body?: any, isRetry: boolean = false) => {
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
      let token = localStorage.getItem('auth_token');
      
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
      
      // --- TOKEN REFRESH LOGIC ---
      if ((res.status === 401 || res.status === 403) && !isRetry) {
          const refreshToken = localStorage.getItem('refresh_token');
          if (refreshToken) {
              try {
                  console.log("🔄 Token expired, attempting refresh...");
                  const refreshUrl = getFullApiUrl('/api/auth/refresh-token');
                  const refreshRes = await fetch(refreshUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ refreshToken })
                  });

                  if (refreshRes.ok) {
                      const data = await refreshRes.json();
                      if (data.success && data.token) {
                          console.log("✅ Token refreshed successfully.");
                          localStorage.setItem('auth_token', data.token);
                          // Retry original request with new token (pass isRetry=true to prevent infinite loop)
                          setIsOperationPending(false); // Reset pending before recursive call to avoid stuck state
                          return await apiCall(endpoint, method, body, true);
                      }
                  } else {
                      console.warn("❌ Token refresh failed.");
                  }
              } catch (refreshErr) {
                  console.error("❌ Token refresh error:", refreshErr);
              }
          }
          // If no refresh token or refresh failed:
          logout();
          throw new Error('Session expired');
      }
      // ---------------------------

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Server returned invalid data.");
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
      
      if (e.message === 'Session expired') {
          // Handled by logout above, just suppress notify if needed or allow generic error
      } else if ((isProd && !isLocalhost) || e.message === 'TIMEOUT_LIMIT_REACHED' || e.message.includes('fetch failed')) {
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
