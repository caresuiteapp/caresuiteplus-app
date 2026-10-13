const FULL_PAGE_PREFIXES = [
  '/auth',
  '/portal',
  '/client-portal',
  '/employee-portal',
  '/platform',
  '/plattform',
  '/command',
  '/impressum',
  '/datenschutz',
  '/support',
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
 * the separate platform console, public portals/legal pages and sequential
 * execution flows remain full pages.
 */
export function isHealthOSContextualPopupRoute(routePattern: string): boolean {
  const normalized = normalizeRoutePattern(routePattern);
  const withoutGroups = normalized.replace(/\/\([^/]+\)/g, '');
  if (withoutGroups === '/' || withoutGroups.endsWith('/_layout')) return false;
  if (FULL_PAGE_PREFIXES.some((prefix) => withoutGroups === prefix || withoutGroups.startsWith(`${prefix}/`))) return false;
  if (FULL_PAGE_WORKFLOW_MARKERS.some((marker) => withoutGroups.includes(marker))) return false;
  return true;
}

const routePatterns = webRoutePatterns.map(pattern => new RegExp('^' + pattern.split('/').map(segment => segment.startsWith('[...') ? '.+' : segment.startsWith('[') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/') + '$'));

export function resolveHealthOSPopupFallbackPath(pathname: string): string {
  const parts = pathname.split(/[?#]/, 1)[0].split('/').filter(Boolean);
  // Resolve against every actual page, rather than a hardcoded list of modules.
  for (let length = parts.length - 1; length > 0; length -= 1) {
    const parent = '/' + parts.slice(0, length).join('/');
    if (['/business', '/business/dashboard', '/zentrale'].includes(parent)) return '/';
    if (routePatterns.some(pattern => pattern.test(parent))) return parent;
  }
  return '/';
}
import webRoutePatterns from './webRoutePatterns.json';
