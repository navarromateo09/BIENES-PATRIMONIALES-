import { useRef } from 'react';
import { useLocation } from 'react-router-dom';

const NAV_ORDER = [
  '/',
  '/deposito',
  '/productos',
  '/expedientes',
  '/guardia',
  '/txt',
  '/dependencias',
  '/actas',
  '/matafuegos',
  '/auditoria',
  '/usuarios'
];

function resolveNavKey(pathname) {
  if (pathname === '/') return '/';
  const exact = NAV_ORDER.find((route) => route !== '/' && pathname.startsWith(route));
  if (exact) return exact;
  return pathname;
}

function navIndex(pathname) {
  const key = resolveNavKey(pathname);
  const idx = NAV_ORDER.indexOf(key);
  return idx >= 0 ? idx : 0;
}

export default function PageTransition({ children }) {
  const location = useLocation();
  const prevPath = useRef(location.pathname);
  const directionRef = useRef('forward');

  if (location.pathname !== prevPath.current) {
    const nextIdx = navIndex(location.pathname);
    const prevIdx = navIndex(prevPath.current);
    directionRef.current = nextIdx >= prevIdx ? 'forward' : 'back';
    prevPath.current = location.pathname;
  }

  return (
    <div
      key={location.pathname}
      className={`page-transition page-transition--${directionRef.current}`}
      data-route={location.pathname}
    >
      {children}
    </div>
  );
}
