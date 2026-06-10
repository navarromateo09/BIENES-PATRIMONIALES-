import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getStockAPI } from '../hooks/useStockAPI';

export default function LoginPage() {
  const { login, createAccount } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [view, setView] = useState('login');
  const [showPass, setShowPass] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [isPackaged, setIsPackaged] = useState(true);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    document.body.className = 'tema-claro app-institutional';
    const api = getStockAPI();
    if (!api) return;
    if (api.getAssetUrl) {
      api.getAssetUrl('logo-login.png')
        .then((url) => setLogoUrl(url))
        .catch(() => api.getAssetUrl('logo-sidebar.png').then(setLogoUrl).catch(() => {}));
    }
    api.getLastUpdateStatus?.().then((snap) => {
      if (snap?.currentVersion) setAppVersion(snap.currentVersion);
      if (snap?.packaged === false) setIsPackaged(false);
    }).catch(() => {});
    if (!appVersion && api.getAppVersion) {
      api.getAppVersion().then((v) => { if (v) setAppVersion(v); }).catch(() => {});
    }
  }, []);

  async function onCheckUpdates() {
    setCheckingUpdate(true);
    try {
      window.dispatchEvent(new CustomEvent('app-request-update-check'));
      const api = getStockAPI();
      const res = await api?.checkForUpdates?.();
      if (res?.ok === false && res?.error) {
        showToast(res.error, 'warning');
      }
    } catch {
      showToast('No se pudo verificar actualizaciones', 'error');
    } finally {
      setTimeout(() => setCheckingUpdate(false), 1500);
    }
  }

  async function onLogin(e) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.target);
    const user = String(fd.get('usuario') || '').trim();
    const pass = String(fd.get('password') || '');
    try {
      const r = await login(user, pass);
      if (r?.ok) {
        navigate('/', { replace: true });
      } else {
        showToast(r?.error || 'Error de inicio de sesión', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  async function onRegister(e) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.target);
    const user = String(fd.get('usuario') || '').trim();
    const pass = String(fd.get('password') || '');
    const pass2 = String(fd.get('password2') || '');
    if (pass !== pass2) {
      showToast('Las contraseñas no coinciden', 'error');
      setLoading(false);
      return;
    }
    try {
      const r = await createAccount(user, pass);
      if (r?.ok) {
        if (r.pendingApproval) {
          showToast('Cuenta creada. Pendiente de autorización por admin1.');
          setView('login');
        } else {
          navigate('/', { replace: true });
        }
      } else {
        showToast(r?.error || 'No se pudo crear la cuenta', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="pantalla-login" className="pantalla-login">
      <div className="login-box">
        <div className="inst-login-org">
          <p className="inst-login-org-line1">Policía de Tucumán</p>
          <p className="inst-login-org-line2">República Argentina</p>
        </div>
        {logoUrl && <img src={logoUrl} alt="" className="login-logo" style={{ maxWidth: 100, maxHeight: 80, display: 'block', margin: '0 auto 0.75rem' }} />}
        <h1 className="login-titulo">Bienes y Patrimoniales</h1>
        <p className="login-subtitulo">Sistema de gestión de entradas, salidas e inventario patrimonial</p>

        {view === 'login' && (
          <form id="form-login" className="login-form" onSubmit={onLogin}>
            <h2>Iniciar sesión</h2>
            <div className="form-group">
              <label htmlFor="login-usuario">Usuario</label>
              <input id="login-usuario" name="usuario" required placeholder="Usuario" autoComplete="username" />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Contraseña</label>
              <input id="login-password" name="password" type={showPass ? 'text' : 'password'} required placeholder="Contraseña" autoComplete="current-password" />
              <label className="password-toggle-inline">
                <input type="checkbox" checked={showPass} onChange={(e) => setShowPass(e.target.checked)} />
                Mostrar contraseña
              </label>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>Entrar</button>
            <p className="login-switch" style={{ marginTop: '0.65rem' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); setView('olvide'); }}>Olvidé mi contraseña</a>
            </p>
            <p className="login-switch">
              <a href="#" onClick={(e) => { e.preventDefault(); setView('register'); }}>¿No tienes cuenta? Regístrate</a>
            </p>
          </form>
        )}

        {view === 'olvide' && (
          <div className="login-form">
            <h2>Recuperar contraseña</h2>
            <p className="login-hint">
              Por seguridad, este sistema no envía correos ni tiene recuperación automática.
              <br />
              Pedile al <strong>administrador</strong> que te restablezca la contraseña desde <strong>Configuración → Usuarios</strong>.
            </p>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setView('login')}>Volver</button>
          </div>
        )}

        {view === 'register' && (
          <form className="login-form" onSubmit={onRegister}>
            <h2>Crear cuenta</h2>
            <p className="login-hint">Define usuario y contraseña para acceder.</p>
            <div className="form-group">
              <label htmlFor="crear-usuario">Usuario</label>
              <input id="crear-usuario" name="usuario" required placeholder="Usuario" autoComplete="username" />
            </div>
            <div className="form-group">
              <label htmlFor="crear-password">Contraseña</label>
              <input id="crear-password" name="password" type="password" required minLength={4} placeholder="Mínimo 4 caracteres" autoComplete="new-password" />
            </div>
            <div className="form-group">
              <label htmlFor="crear-password2">Repetir contraseña</label>
              <input id="crear-password2" name="password2" type="password" required minLength={4} placeholder="Repetir contraseña" autoComplete="new-password" />
            </div>
            <button type="submit" className="btn btn-success btn-block" disabled={loading}>Crear cuenta</button>
            <p className="login-switch">
              <a href="#" onClick={(e) => { e.preventDefault(); setView('login'); }}>¿Ya tienes cuenta? Iniciar sesión</a>
            </p>
          </form>
        )}

        <div className="login-version-footer">
          {appVersion ? (
            <p className="login-version-label">Versión instalada: <strong>v{appVersion}</strong></p>
          ) : (
            <p className="login-version-label">Versión instalada: …</p>
          )}
          <button
            type="button"
            className="login-version-footer-btn"
            disabled={checkingUpdate}
            onClick={onCheckUpdates}
          >
            {checkingUpdate ? 'Verificando…' : 'Verificar actualizaciones'}
          </button>
          {!isPackaged && (
            <p className="login-version-dev-warning">
              Modo desarrollo: las actualizaciones solo funcionan con el .exe instalado.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
