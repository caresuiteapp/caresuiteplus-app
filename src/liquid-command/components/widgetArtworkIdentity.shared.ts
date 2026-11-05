import { canonicalDesktopCatalogRoute } from '../navigation/appsWidgetsCatalogModel.shared';

/** Function identity, never a person, month, search result or tracking campaign. */
export function widgetArtworkIdentity(route: string): string {
  const canonical = canonicalDesktopCatalogRoute(route.trim() || '/');
  const [location] = canonical.split('#', 1);
  const [rawPath, search = ''] = location.split('?');
  let path = rawPath.replace(/\/+$/, '') || '/';
  const aliases: Record<string, string> = {
    '/': '/Desktop', '/business': '/Desktop', '/business/home': '/Desktop',
    '/office/clients': '/business/office/clients',
    '/office/employees': '/business/office/employees',
    '/office/invoices': '/business/office/invoices',
    '/office/document-catalog': '/business/office/document-catalog',
    '/akademie/courses': '/akademie/kurse',
    '/akademie/kalender': '/akademie/calendar',
    '/pflege/kalender': '/pflege/calendar',
    '/pflege/auswertungen': '/pflege/reports',
  };
  const roots = new Set(['/', '/business', '/business/home']);
  const alias = Object.keys(aliases).find(key => path === key || (!roots.has(key) && path.startsWith(`${key}/`)));
  if (alias) path = aliases[alias] + path.slice(alias.length);
  // Record details use the function's picture, without encoding personal IDs.
  path = path.replace(/\/(?:[0-9]+|[0-9a-f]{8}-[0-9a-f-]{27,})(?=\/|$)/gi, '/record');
  const query = new URLSearchParams(search);
  const meaningful: [string, string][] = [];
  const keys = path === '/business/connect/google-workspace' ? ['service']
    : path === '/business/messages' ? ['audience', 'view', 'chatAge']
    : ['/robotics', '/settings', '/assist', '/', '/Desktop'].includes(path) ? ['area']
    : path === '/akademie' ? ['section'] : [];
  for (const key of keys) {
    const value = query.get(key);
    if (value && value !== 'overview') meaningful.push([key, value]);
  }
  meaningful.sort(([a], [b]) => a.localeCompare(b, 'en'));
  const params = new URLSearchParams(meaningful).toString();
  return `${path}${params ? `?${params}` : ''}`;
}
