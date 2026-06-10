import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStockAPI } from './useStockAPI';

const ACTIVITY_MS = 20000;

export function useSessionIdle() {
  const navigate = useNavigate();

  useEffect(() => {
    const api = getStockAPI();
    if (!api?.sessionActivity || !api?.onSessionExpired) return undefined;

    let lastPing = 0;
    function ping() {
      const now = Date.now();
      if (now - lastPing < ACTIVITY_MS) return;
      lastPing = now;
      api.sessionActivity().catch(() => {});
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, ping, { passive: true }));
    ping();

    const unsub = api.onSessionExpired(() => {
      navigate('/login', { replace: true });
    });

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, ping));
      if (typeof unsub === 'function') unsub();
    };
  }, [navigate]);
}
