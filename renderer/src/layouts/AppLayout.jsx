import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLoading } from '../contexts/LoadingContext';
import { useToast } from '../contexts/ToastContext';
import { getStockAPI } from '../hooks/useStockAPI';
import Sidebar from '../components/Sidebar';

function getUserMenuPosition(btn) {
  if (!btn) return null;
  const rect = btn.getBoundingClientRect();
  return {
    top: rect.bottom + 6,
    right: Math.max(8, window.innerWidth - rect.right)
  };
}

export default function AppLayout({ children, bodyClass = 'dashboard-page' }) {
  const { user, logout, isAdmin } = useAuth();
  const { show, hide } = useLoading();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passNueva2, setPassNueva2] = useState('');
  const menuBtnRef = useRef(null);
  const dropdownRef = useRef(null);
  const [, setMenuTick] = useState(0);

  useEffect(() => {
    document.body.className = `${bodyClass} app-institutional`;
  }, [bodyClass]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function reposition() {
      setMenuTick((n) => n + 1);
    }
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    const closeOnOutside = (e) => {
      if (menuBtnRef.current?.contains(e.target)) return;
      if (dropdownRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', closeOnOutside);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', closeOnOutside);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [menuOpen]);

  const menuPosition = menuOpen ? getUserMenuPosition(menuBtnRef.current) : null;

  const fecha = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  async function handleExportarBackup() {
    setMenuOpen(false);
    const api = getStockAPI();
    if (!api?.exportBackupFile) {
      showToast('Función de backup no disponible', 'error');
      return;
    }
    try {
      const r = await api.exportBackupFile();
      if (r?.ok) {
        showToast('Backup exportado correctamente', 'success');
      } else if (r?.error && r.error !== 'Cancelado') {
        showToast(r.error || 'Error al exportar', 'error');
      }
    } catch {
      showToast('Error al exportar backup', 'error');
    }
  }

  async function handleRestaurarBackup() {
    setMenuOpen(false);
    const api = getStockAPI();
    if (!api?.restoreBackup) {
      showToast('Función de restauración no disponible', 'error');
      return;
    }
    if (!window.confirm('¿Restaurar datos desde un backup? Se creará un respaldo automático del estado actual antes de restaurar.')) {
      return;
    }
    show('Restaurando backup…');
    try {
      const r = await api.restoreBackup();
      if (r?.ok) {
        showToast(`Backup restaurado: ${r.filename || ''}`, 'success');
        window.setTimeout(() => window.location.reload(), 1500);
      } else if (r?.error && r.error !== 'Cancelado') {
        showToast(r.error || 'Error al restaurar', 'error');
      }
    } catch {
      showToast('Error al restaurar backup', 'error');
    } finally {
      hide();
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (passNueva !== passNueva2) {
      showToast('Las contraseñas nuevas no coinciden', 'error');
      return;
    }
    const api = getStockAPI();
    if (!api?.changePassword) return;
    const r = await api.changePassword(passActual, passNueva);
    if (r?.ok) {
      showToast('Contraseña actualizada');
      setConfigOpen(false);
      setPassActual('');
      setPassNueva('');
      setPassNueva2('');
    } else {
      showToast(r?.error || 'Error al cambiar contraseña', 'error');
    }
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <div className="inst-header-bar">
          <div className="inst-header-strip">
            Policía de Tucumán · Sistema de Gestión de Bienes y Patrimoniales
          </div>
          <header className="dashboard-header">
            <div className="header-greeting">
              <p className="inst-header-subtitle">Panel de control</p>
              <h1>Bienvenido, {user?.username || 'Usuario'}</h1>
              <p id="dashboard-date" className="header-date">{fecha}</p>
            </div>
            <div className="header-actions">
              <button
                type="button"
                ref={menuBtnRef}
                className="btn btn-secondary btn-sm header-user-menu-btn"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((v) => !v)}
              >
                {user?.username} · {user?.rolLabel}
              </button>
              {menuOpen && menuPosition && createPortal(
                <div
                  ref={dropdownRef}
                  className="header-usuario-dropdown open header-usuario-dropdown--portal"
                  role="menu"
                  style={{ top: `${menuPosition.top}px`, right: `${menuPosition.right}px` }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="header-usuario-dropdown-item"
                    onClick={() => { setConfigOpen(true); setMenuOpen(false); }}
                  >
                    Configuración
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="header-usuario-dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      window.dispatchEvent(new CustomEvent('app-request-update-check'));
                    }}
                  >
                    Buscar actualizaciones
                  </button>
                  {isAdmin && (
                    <Link
                      to="/usuarios"
                      role="menuitem"
                      className="header-usuario-dropdown-item"
                      onClick={() => setMenuOpen(false)}
                    >
                      Gestión de usuarios
                    </Link>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      role="menuitem"
                      className="header-usuario-dropdown-item"
                      onClick={handleExportarBackup}
                    >
                      Exportar backup
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      role="menuitem"
                      className="header-usuario-dropdown-item"
                      onClick={handleRestaurarBackup}
                    >
                      Restaurar backup
                    </button>
                  )}
                  <div className="header-usuario-dropdown-separator" role="separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="header-usuario-dropdown-item header-usuario-dropdown-logout"
                    onClick={handleLogout}
                  >
                    Cerrar sesión
                  </button>
                </div>,
                document.body
              )}
            </div>
          </header>
        </div>
        <div className="inst-content-wrap">
          {children}
        </div>
      </main>

      {configOpen && (
        <div className="modal open modal-tema-clara" role="dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Cambiar contraseña</h3>
              <button type="button" className="modal-close" onClick={() => setConfigOpen(false)}>&times;</button>
            </div>
            <form className="modal-body" onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>Contraseña actual</label>
                <input type="password" value={passActual} onChange={(e) => setPassActual(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Nueva contraseña</label>
                <input type="password" value={passNueva} onChange={(e) => setPassNueva(e.target.value)} required minLength={4} />
              </div>
              <div className="form-group">
                <label>Repetir nueva contraseña</label>
                <input type="password" value={passNueva2} onChange={(e) => setPassNueva2(e.target.value)} required minLength={4} />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Guardar</button>
                <button type="button" className="btn btn-secondary" onClick={() => setConfigOpen(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
