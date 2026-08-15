const FULL_PAGE_PREFIXES = [
  '/auth',
  '/portal',
  '/client-portal',
  '/employee-portal',
  '/platform/login',
  '/impressum',
  '/datenschutz',
  '/christianreinhardt',
  '/agb',
];

const FULL_PAGE_WORKFLOW_MARKERS = [
  '/assignments/[id]/execute',
  '/execution/',
  '/first-login',
  '/recovery-bridge',
  '/reset-password',
];

function normalizeRoutePattern(routePattern: string): string {
  const clean = routePattern
    .replace(/\\/g, '/')
    .replace(/^app\//, '/')
    .replace(/\.(tsx|ts|jsx|js)$/, '')
    .replace(/^\/?index$/, '')
    .replace(/\/index$/, '')
    .replace(/\/+/g, '/');
  if (!clean) return '/';
  return clean.startsWith('/') ? clean : `/${clean}`;
}

/**
 * CareSuite HealthOS has one central surface. Every authenticated internal
 * destination is presented above it as a large contextual popup. Authentication,
 * public portals/legal pages and sequential execution flows remain full pages.
 */
export function isHealthOSContextualPopupRoute(routePattern: string): boolean {
  const normalized = normalizeRoutePattern(routePattern);
  const withoutGroups = normalized.replace(/\/\([^/]+\)/g, '');
  if (withoutGroups === '/' || withoutGroups.endsWith('/_layout')) return false;
  if (FULL_PAGE_PREFIXES.some((prefix) => withoutGroups === prefix || withoutGroups.startsWith(`${prefix}/`))) return false;
  if (FULL_PAGE_WORKFLOW_MARKERS.some((marker) => withoutGroups.includes(marker))) return false;
  return true;
}

export function resolveHealthOSPopupFallbackPath(_pathname: string): string {
  return '/';
}
