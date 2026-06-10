import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { getStockAPI } from '../hooks/useStockAPI';
import { SidebarIcon } from './SidebarIcons';

const NAV = [
  { section: 'Operaciones' },
  { to: '/', label: 'Inicio', end: true },
  { to: '/deposito', label: 'Depósito' },
  { to: '/productos', label: 'Inventario' },
  { to: '/expedientes', label: 'Expedientes' },
  { to: '/guardia', label: 'Entregas' },
  { to: '/txt', label: 'TXT' },
  { section: 'Control y soporte' },
  { to: '/dependencias', label: 'Dependencias' },
  { to: '/actas', label: 'Actas' },
  { to: '/matafuegos', label: 'Matafuegos' },
  { to: '/auditoria', label: 'Auditoría' }
];

export default function Sidebar() {
  const { isAdmin } = useAuth();
  const [version, setVersion] = useState('');

  useEffect(() => {
    const api = getStockAPI();
    if (api?.getAppVersion) {
      api.getAppVersion().then((v) => setVersion(v || '')).catch(() => {});
    }
  }, []);

  return (
    <aside className="dashboard-sidebar">
      <div className="inst-sidebar-brand">
        <img src="./emblemalogin.png" alt="" className="inst-sidebar-logo" />
        <p className="inst-sidebar-org">Policía de Tucumán</p>
        <p className="inst-sidebar-app">Bienes y Patrimoniales</p>
      </div>
      <nav className="sidebar-nav">
        {NAV.map((item, idx) => {
          if (item.section) {
            return <p key={idx} className="sidebar-section-label">{item.section}</p>;
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-icon" aria-hidden="true"><SidebarIcon to={item.to} /></span>
              {item.label}
            </NavLink>
          );
        })}
        {isAdmin && (
          <NavLink to="/usuarios" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <span className="sidebar-icon" aria-hidden="true"><SidebarIcon to="/usuarios" /></span>
            Usuarios
          </NavLink>
        )}
      </nav>
      <div className="sidebar-footer">
        <div className="inst-sidebar-footer-line" />
        <div className="inst-sidebar-secure">
          <span className="inst-secure-dot" />
          Sistema seguro
        </div>
        {version && <small>Sistema v{version}</small>}
        <small>República Argentina</small>
      </div>
    </aside>
  );
}
