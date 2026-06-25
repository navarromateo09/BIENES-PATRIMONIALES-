import { Outlet, useLocation } from 'react-router-dom';
import AppLayout from './AppLayout';
import PageTransition from '../components/PageTransition';

const ROUTE_BODY_CLASS = {
  '/': 'dashboard-page',
  '/deposito': 'app-page-theme',
  '/productos': 'app-page-theme',
  '/expedientes': 'app-page-theme',
  '/guardia': 'app-page-theme page-guardia',
  '/txt': 'app-page-theme',
  '/dependencias': 'app-page-theme page-dependencias',
  '/actas': 'app-page-theme',
  '/matafuegos': 'app-page-theme page-matafuegos',
  '/auditoria': 'dashboard-page',
  '/usuarios': 'dashboard-page'
};

function resolveBodyClass(pathname) {
  if (pathname.startsWith('/matafuegos')) return 'app-page-theme page-matafuegos';
  return ROUTE_BODY_CLASS[pathname] || 'dashboard-page';
}

export default function AppShell() {
  const location = useLocation();
  const bodyClass = resolveBodyClass(location.pathname);

  return (
    <AppLayout bodyClass={bodyClass}>
      <PageTransition>
        <Outlet />
      </PageTransition>
    </AppLayout>
  );
}
