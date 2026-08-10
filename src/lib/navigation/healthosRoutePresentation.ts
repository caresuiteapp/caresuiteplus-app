const CONTEXT_ACTION_SEGMENTS = new Set([
  'new',
  'create',
  'compose',
  'anlegen',
  'edit',
  'review',
  'configure',
  'request',
  'prepare',
  'upload',
  'details',
  'detail',
]);

const FULL_PAGE_PREFIXES = [
  '/auth',
  '/portal',
  '/client-portal',
  '/employee-portal',
  '/platform/login',
];

const FULL_PAGE_EXACT_ROUTES = new Set([
  '/settings',
]);

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
    .replace(/\/index$/, '')
    .replace(/\/+/g, '/');
  return clean.startsWith('/') ? clean : `/${clean}`;
}

/**
 * One interaction contract for every module:
 * module/list/dashboard navigation remains a page; records, details, creation,
 * editing and review open as overlays. Settings remain full workspaces so a
 * previously mounted record or employee modal can never sit below them.
 * remain full pages because they are sequential operating processes.
 */
export function isHealthOSContextualPopupRoute(routePattern: string): boolean {
  const normalized = normalizeRoutePattern(routePattern);
  const withoutGroups = normalized.replace(/\/\([^/]+\)/g, '');

  // Module roots are navigation destinations, never contextual actions.
  // `/settings` would otherwise match the generic `settings` action segment
  // and reclassify the previously mounted screen as a transparent modal.
  if (FULL_PAGE_EXACT_ROUTES.has(withoutGroups)) {
    return false;
  }

  if (
    FULL_PAGE_PREFIXES.some(
      (prefix) => withoutGroups === prefix || withoutGroups.startsWith(`${prefix}/`),
    )
  ) {
    return false;
  }

  if (FULL_PAGE_WORKFLOW_MARKERS.some((marker) => withoutGroups.includes(marker))) {
    return false;
  }

  const segments = withoutGroups.split('/').filter(Boolean);
  if (segments.length === 0 || segments.at(-1) === '_layout') return false;

  if (segments.some((segment) => /^\[.+\]$/.test(segment))) return true;
  return segments.some((segment) => CONTEXT_ACTION_SEGMENTS.has(segment.toLowerCase()));
}

export function resolveHealthOSPopupFallbackPath(pathname: string): string {
  const normalized = normalizeRoutePattern(pathname.split('?')[0] ?? pathname);
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length <= 1) return '/business';

  const last = segments.at(-1)?.toLowerCase() ?? '';
  if (CONTEXT_ACTION_SEGMENTS.has(last)) {
    segments.pop();
  } else {
    segments.pop();
  }

  const fallback = `/${segments.join('/')}`;
  return fallback === '/' ? '/business' : fallback;
}
