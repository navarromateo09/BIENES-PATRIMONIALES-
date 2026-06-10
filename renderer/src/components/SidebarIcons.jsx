/** Iconos del menú lateral — estilo institucional */

export function IconHome() {
  return (
    <svg viewBox="0 0 24 24" className="sidebar-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  );
}

export function IconDeposito() {
  return (
    <svg viewBox="0 0 24 24" className="sidebar-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11h4l2-4h7l2 4h3v7H3v-7z" /><path d="M10 18h4" />
    </svg>
  );
}

export function IconInventario() {
  return (
    <svg viewBox="0 0 24 24" className="sidebar-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9l8-5 8 5v10H4V9z" /><path d="M4 9l8 5 8-5" /><path d="M12 4v10" />
    </svg>
  );
}

export function IconExpedientes() {
  return (
    <svg viewBox="0 0 24 24" className="sidebar-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h7l2 2h7v10H4V6z" /><path d="M11 6v2" />
    </svg>
  );
}

export function IconEntregas() {
  return (
    <svg viewBox="0 0 24 24" className="sidebar-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h9l3 3h4v7H4V7z" /><path d="M4 12h16" /><path d="M8 16h4" />
    </svg>
  );
}

export function IconTxt() {
  return (
    <svg viewBox="0 0 24 24" className="sidebar-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="1" /><path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

export function IconDependencias() {
  return (
    <svg viewBox="0 0 24 24" className="sidebar-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="9" width="16" height="11" rx="1" /><path d="M9 9V5h6v4" />
    </svg>
  );
}

export function IconActas() {
  return (
    <svg viewBox="0 0 24 24" className="sidebar-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}

export function IconMatafuegos() {
  return (
    <svg viewBox="0 0 24 24" className="sidebar-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 4h4l3-2" /><path d="M10 4v3" /><rect x="8" y="7" width="8" height="11" rx="2" /><path d="M12 11v3" />
    </svg>
  );
}

export function IconAuditoria() {
  return (
    <svg viewBox="0 0 24 24" className="sidebar-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function IconUsuarios() {
  return (
    <svg viewBox="0 0 24 24" className="sidebar-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2" /><path d="M17 14c2.2 0 4 1.3 4 3" />
    </svg>
  );
}

const ICON_MAP = {
  '/': IconHome,
  '/deposito': IconDeposito,
  '/productos': IconInventario,
  '/expedientes': IconExpedientes,
  '/guardia': IconEntregas,
  '/txt': IconTxt,
  '/dependencias': IconDependencias,
  '/actas': IconActas,
  '/matafuegos': IconMatafuegos,
  '/auditoria': IconAuditoria,
  '/usuarios': IconUsuarios
};

export function SidebarIcon({ to }) {
  const Icon = ICON_MAP[to] || IconHome;
  return <Icon />;
}
