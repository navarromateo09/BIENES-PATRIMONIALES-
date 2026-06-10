import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getStockAPI } from '../hooks/useStockAPI';

const AuthContext = createContext(null);

function rolLabel(rol) {
  const r = (rol || 'usuario').toLowerCase();
  if (r === 'admin') return 'Admin';
  if (r === 'oficina') return 'Oficina';
  return 'Usuario';
}

export function AuthProvider({ children }) {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);

  const refresh = useCallback(async () => {
    const api = getStockAPI();
    if (!api?.getAuthStatus) {
      setUser(null);
      return null;
    }
    const status = await api.getAuthStatus();
    if (status?.hasUser && status.username) {
      const u = {
        username: status.username,
        rol: status.rol || 'usuario',
        rolLabel: rolLabel(status.rol)
      };
      setUser(u);
      return u;
    }
    setUser(null);
    return null;
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refresh();
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, [refresh]);

  const login = useCallback(async (username, password) => {
    const api = getStockAPI();
    if (!api?.login) return { ok: false, error: 'API no disponible' };
    const result = await api.login(username, password);
    if (result?.ok) await refresh();
    return result;
  }, [refresh]);

  const createAccount = useCallback(async (username, password) => {
    const api = getStockAPI();
    if (!api?.createAccount) return { ok: false, error: 'API no disponible' };
    return api.createAccount(username, password);
  }, []);

  const logout = useCallback(async () => {
    const api = getStockAPI();
    if (api?.logout) await api.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    checking,
    user,
    isAuthenticated: !!user,
    isAdmin: (user?.rol || '').toLowerCase() === 'admin',
    refresh,
    login,
    createAccount,
    logout,
    rolLabel
  }), [checking, user, refresh, login, createAccount, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
