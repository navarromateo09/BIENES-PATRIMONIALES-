import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useSessionIdle } from './hooks/useSessionIdle';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './layouts/AppShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsuariosPage from './pages/UsuariosPage';
import AuditoriaPage from './pages/AuditoriaPage';
import DependenciasPage from './pages/DependenciasPage';
import DepositoPage from './pages/DepositoPage';
import ProductosPage from './pages/ProductosPage';
import GuardiaPage from './pages/GuardiaPage';
import ExpedientesPage from './pages/ExpedientesPage';
import TxtPage from './pages/TxtPage';
import ActasPage from './pages/ActasPage';
import MatafuegosPage from './pages/MatafuegosPage';
import MatafuegoFormPage from './pages/MatafuegoFormPage';
export default function App() {
  const { checking, isAuthenticated } = useAuth();
  useSessionIdle();
  useRealtimeSync();

  useEffect(() => {
    document.body.classList.remove('dashboard-page', 'app-page-theme', 'tema-claro');
  }, []);

  if (checking) {
    return (
      <div className="app-boot-loading">
        <p>Verificando sesión…</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/deposito" element={<DepositoPage />} />
          <Route path="/productos" element={<ProductosPage />} />
          <Route path="/expedientes" element={<ExpedientesPage />} />
          <Route path="/guardia" element={<GuardiaPage />} />
          <Route path="/txt" element={<TxtPage />} />
          <Route path="/dependencias" element={<DependenciasPage />} />
          <Route path="/actas" element={<ActasPage />} />
          <Route path="/matafuegos" element={<MatafuegosPage />} />
          <Route path="/matafuegos/nuevo" element={<MatafuegoFormPage />} />
          <Route path="/matafuegos/editar/:id" element={<MatafuegoFormPage />} />
          <Route path="/auditoria" element={<AuditoriaPage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
    </Routes>
  );
}
