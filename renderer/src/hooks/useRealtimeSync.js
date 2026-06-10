import { useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { getStockAPI } from './useStockAPI';

export function useRealtimeSync() {
  const { showToast } = useToast();

  useEffect(() => {
    const api = getStockAPI();
    if (!api?.onDataChanged) return undefined;

    const unsub = api.onDataChanged((payload) => {
      const table = payload?.table;
      if (typeof window._realtimeRefresh === 'function') {
        window._realtimeRefresh(table);
        return;
      }
      if (table) {
        showToast(`Datos actualizados (${table}). Recargá si no ves cambios.`);
      }
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [showToast]);
}
