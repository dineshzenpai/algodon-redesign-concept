import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const AdminContext = createContext(null);
export const useAdmin = () => useContext(AdminContext);
export const adminMoney = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));

export function useResource(path, { pollInterval = 3500 } = {}) {
  const admin = useAdmin();
  const api = admin?.api;
  const revision = admin?.revision;
  const [result, setResult] = useState({ data: null, error: '', loading: true });
  const [retry, setRetry] = useState(0);

  const fetchData = useCallback(async (isBackground = false) => {
    if (!path || !api) return;
    if (!isBackground) {
      setResult(prev => ({ ...prev, loading: !prev.data }));
    }
    try {
      const data = await api(path);
      setResult({ data, error: '', loading: false });
    } catch (error) {
      if (!isBackground) {
        setResult(prev => ({ ...prev, error: error.message, loading: false }));
      }
    }
  }, [path, api]);

  useEffect(() => {
    let cancelled = false;
    fetchData(false);

    // Live background polling for real-time reflection of changes
    const interval = setInterval(() => {
      if (!cancelled && typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchData(true);
      }
    }, pollInterval);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [path, revision, retry, fetchData, pollInterval]);

  const reload = useCallback(() => {
    setResult(prev => ({ ...prev, loading: true }));
    setRetry(v => v + 1);
  }, []);

  return { ...result, reload };
}
