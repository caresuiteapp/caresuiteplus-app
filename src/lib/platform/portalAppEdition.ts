export const PORTAL_ONLY_EDITION = 'portal-only';

export const isPortalOnlyEdition =
  process.env.EXPO_PUBLIC_APP_EDITION === PORTAL_ONLY_EDITION;

const PORTAL_ONLY_EXACT_ROUTES = new Set([
  '/',
  '/auth',
  '/auth/employee-login',
  '/auth/employee-portal-login',
  '/auth/employee-first-login',
  '/auth/client-login',
  '/auth/portal-code-login',
]);

const PORTAL_ONLY_ROUTE_ROOTS = ['/portal/employee', '/portal/client'] as const;

function normalizePathname(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  return path || '/';
}

/**
 * Security boundary for the native portal binary. This list intentionally
 * excludes registration, business, Office, Assist, settings and every
 * administrative or company-management route.
 */
export function isRouteAvailableInPortalApp(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  if (PORTAL_ONLY_EXACT_ROUTES.has(normalized)) return true;
  return PORTAL_ONLY_ROUTE_ROOTS.some(
    (root) => normalized === root || normalized.startsWith(`${root}/`),
  );
}
