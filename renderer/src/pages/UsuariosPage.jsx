import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getStockAPI } from '../hooks/useStockAPI';
import '../theme/usuarios-page.css';

export default function UsuariosPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [usuarios, setUsuarios] = useState([]);
  const esAdmin1 = (user?.username || '').toLowerCase() === 'admin1';
  const isAdmin = (user?.rol || '').toLowerCase() === 'admin';

  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passNueva2, setPassNueva2] = useState('');
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [resetUser, setResetUser] = useState('');
  const [resetPass, setResetPass] = useState('');

  const cargar = useCallback(async () => {
    if (!isAdmin) return;
    const api = getStockAPI();
    const resp = await api.adminListUsuarios();
    if (!resp?.ok) {
      showToast(resp?.error || 'No se pudieron cargar usuarios', 'error');
      return;
    }
    setUsuarios(resp.usuarios || []);
  }, [isAdmin, showToast]);

  useEffect(() => { cargar(); }, [cargar]);

  const habilitados = usuarios.filter((u) => (u.rol || '').toLowerCase() !== 'pendiente');

  async function onChangeOwnPassword(e) {
    e.preventDefault();
    if (passNueva !== passNueva2) {
      showToast('Las contraseñas nuevas no coinciden', 'error');
      return;
    }
    const api = getStockAPI();
    const r = await api.changePassword(passActual, passNueva);
    if (r?.ok) {
      showToast('Contraseña actualizada');
      setPassActual('');
      setPassNueva('');
      setPassNueva2('');
    } else {
      showToast(r?.error || 'Error', 'error');
    }
  }

  async function onRename(e) {
    e.preventDefault();
    const api = getStockAPI();
    const r = await api.adminRenameUser(renameFrom, renameTo.trim());
    if (r?.ok) {
      showToast(`Usuario renombrado: ${renameFrom} → ${renameTo}`);
      setRenameTo('');
      cargar();
    } else {
      showToast(r?.error || 'Error', 'error');
    }
  }

  async function onReset(e) {
    e.preventDefault();
    const api = getStockAPI();
    const r = await api.adminResetPassword(resetUser, resetPass);
    if (r?.ok) {
      showToast(`Contraseña actualizada para ${resetUser}`);
      setResetPass('');
    } else {
      showToast(r?.error || 'Error', 'error');
    }
  }

  async function onAuthorize(username) {
    if (!confirm(`¿Autorizar al usuario "${username}"?`)) return;
    const api = getStockAPI();
    const r = await api.adminAuthorizeUser(username);
    if (r?.ok) {
      showToast(`Usuario autorizado: ${username}`);
      cargar();
    } else {
      showToast(r?.error || 'Error', 'error');
    }
  }

  async function onReject(username) {
    if (!confirm(`¿Rechazar al usuario "${username}"?`)) return;
    const api = getStockAPI();
    const r = await api.adminRejectUser(username);
    if (r?.ok) {
      showToast(`Usuario rechazado: ${username}`);
      cargar();
    } else {
      showToast(r?.error || 'Error', 'error');
    }
  }

  return (
    <div className="content-panel usuarios-page">
      <div className="panel-header">
        <h2 className="page-title">Gestión de usuarios</h2>
      </div>
      <p className="panel-desc">Administra tu cuenta y contraseña.</p>

      <div className="usuarios-info">
        <p>Usuario actual: <strong>{user?.username}</strong> ({user?.rolLabel})</p>
      </div>

      <section className="usuarios-card" aria-labelledby="usuarios-mi-password">
        <h3 id="usuarios-mi-password" className="usuarios-card-title">Cambiar mi contraseña</h3>
        <p className="usuarios-card-desc">Actualizá la contraseña de tu cuenta actual.</p>
        <form className="usuarios-form" onSubmit={onChangeOwnPassword}>
          <div className="form-group">
            <label htmlFor="usuarios-pass-actual">Contraseña actual</label>
            <input
              id="usuarios-pass-actual"
              type="password"
              value={passActual}
              onChange={(e) => setPassActual(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="usuarios-pass-nueva">Nueva contraseña</label>
            <input
              id="usuarios-pass-nueva"
              type="password"
              value={passNueva}
              onChange={(e) => setPassNueva(e.target.value)}
              autoComplete="new-password"
              required
              minLength={4}
            />
          </div>
          <div className="form-group">
            <label htmlFor="usuarios-pass-nueva2">Repetir nueva contraseña</label>
            <input
              id="usuarios-pass-nueva2"
              type="password"
              value={passNueva2}
              onChange={(e) => setPassNueva2(e.target.value)}
              autoComplete="new-password"
              required
              minLength={4}
            />
          </div>
          <button type="submit" className="btn btn-primary">Cambiar mi contraseña</button>
        </form>
      </section>

      {isAdmin && (
        <section className="usuarios-card" aria-labelledby="usuarios-admin-title">
          <h3 id="usuarios-admin-title" className="usuarios-card-title">Administración de usuarios</h3>
          <p className="usuarios-card-desc">
            Como administrador podés ver usuarios, cambiar nombre o contraseña y gestionar pendientes.
            {esAdmin1 ? ' Solo admin1 puede autorizar o rechazar cuentas pendientes.' : ''}
          </p>

          <div className="table-wrap usuarios-admin-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr><td colSpan={4}>No hay usuarios cargados.</td></tr>
                ) : (
                  usuarios.map((u) => {
                    const rol = (u.rol || 'usuario').toString();
                    const pendiente = rol.toLowerCase() === 'pendiente';
                    return (
                      <tr key={u.username}>
                        <td>{u.username}</td>
                        <td>{rol}</td>
                        <td>{u.created_at ? new Date(u.created_at).toLocaleString('es-AR') : '—'}</td>
                        <td>
                          {esAdmin1 && pendiente ? (
                            <div className="usuarios-admin-actions">
                              <button type="button" className="btn btn-sm btn-success" onClick={() => onAuthorize(u.username)}>
                                Autorizar
                              </button>
                              <button type="button" className="btn btn-sm btn-danger" onClick={() => onReject(u.username)}>
                                Rechazar
                              </button>
                            </div>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="usuarios-card" style={{ marginBottom: 0, boxShadow: 'none', background: 'var(--inst-bg, #f8fafc)' }}>
            <h4 className="usuarios-card-title">Cambiar nombre de usuario</h4>
            <form className="usuarios-form" onSubmit={onRename}>
              <div className="form-group">
                <label htmlFor="usuarios-rename-from">Usuario actual</label>
                <select
                  id="usuarios-rename-from"
                  value={renameFrom}
                  onChange={(e) => setRenameFrom(e.target.value)}
                  required
                >
                  <option value="">— Seleccionar —</option>
                  {habilitados
                    .filter((u) => u.username !== user?.username)
                    .map((u) => (
                      <option key={u.username} value={u.username}>
                        {u.username} ({u.rol})
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="usuarios-rename-to">Nuevo nombre</label>
                <input
                  id="usuarios-rename-to"
                  value={renameTo}
                  onChange={(e) => setRenameTo(e.target.value)}
                  required
                  minLength={3}
                />
              </div>
              <button type="submit" className="btn btn-secondary">Cambiar nombre del usuario</button>
            </form>
          </div>

          <div className="usuarios-card" style={{ marginTop: '1rem', marginBottom: 0, boxShadow: 'none', background: 'var(--inst-bg, #f8fafc)' }}>
            <h4 className="usuarios-card-title">Resetear contraseña de un usuario</h4>
            <form className="usuarios-form" onSubmit={onReset}>
              <div className="form-group">
                <label htmlFor="usuarios-reset-user">Usuario</label>
                <select
                  id="usuarios-reset-user"
                  value={resetUser}
                  onChange={(e) => setResetUser(e.target.value)}
                  required
                >
                  <option value="">— Seleccionar —</option>
                  {habilitados.map((u) => (
                    <option key={u.username} value={u.username}>
                      {u.username} ({u.rol})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="usuarios-reset-pass">Nueva contraseña</label>
                <input
                  id="usuarios-reset-pass"
                  type="password"
                  value={resetPass}
                  onChange={(e) => setResetPass(e.target.value)}
                  required
                  minLength={4}
                />
              </div>
              <button type="submit" className="btn btn-secondary">Cambiar contraseña del usuario</button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}
