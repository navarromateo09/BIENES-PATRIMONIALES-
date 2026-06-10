import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import LoadingOverlay from '../components/LoadingOverlay';

const LoadingContext = createContext(null);

export function LoadingProvider({ children }) {
  const [message, setMessage] = useState(null);

  const show = useCallback((msg) => setMessage(msg || 'Cargando…'), []);
  const hide = useCallback(() => setMessage(null), []);

  useEffect(() => {
    window.appLoading = {
      show,
      hide,
      __reactBridge: true
    };
    return () => {
      if (window.appLoading?.__reactBridge) {
        delete window.appLoading;
      }
    };
  }, [show, hide]);

  const value = useMemo(() => ({ show, hide, visible: !!message }), [show, hide, message]);

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {message && <LoadingOverlay message={message} />}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoading debe usarse dentro de LoadingProvider');
  return ctx;
}
