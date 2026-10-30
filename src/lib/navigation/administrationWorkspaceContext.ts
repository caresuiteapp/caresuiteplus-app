import { APP_ROUTES } from './routes';
import { documentsWorkspaceRouteTitle } from './documentsWorkspaceRoutes';
import { canonicalDesktopCatalogRoute, desktopCatalogAreaForRoute } from '@/liquid-command/navigation/appsWidgetsCatalogModel.shared';
import { DESKTOP_AREAS } from '@/liquid-command/navigation/desktopAreas';

const workspaceTitles: Readonly<Record<string, string>> = {
  '/unternehmen': 'Unternehmen', '/unternehmen/standorte': 'Standorte',
  '/unternehmen/abteilungen': 'Abteilungen', '/unternehmen/gesellschaften': 'Gesellschaften',
  '/unternehmen/franchise': 'Franchise & Beziehungen', '/unternehmen/personalzuordnung': 'Personalzuordnung',
  '/unternehmen/zugriffe': 'Zugriffsbereiche', '/unternehmen/inventar': 'Inventar',
  '/unternehmen/ressourcen': 'Verträge & Ressourcen', '/unternehmen/vertraege': 'Verträge',
  '/unternehmen/versicherungen': 'Versicherungen', '/unternehmen/fuhrpark': 'Fuhrpark',
  '/unternehmen/zuordnungen': 'Ressourcenzuordnung', '/office/notizen': 'Notizen',
  '/business/office/clients': 'Klient:innen', '/business/office/employees': 'Personal',
  '/business/office/fahrtenbuch': 'Fahrtenbuch', '/business/office/invoices': 'Rechnungen',
  '/business/office/payroll': 'Gehaltsstatistik', '/business/office/access': 'Portale & Zugänge',
  '/business/office/document-catalog': 'Dokumentenkatalog',
  '/business/office/employees/new': 'Personalakte anlegen',
  '/business/office/employees/hr-cases': 'Personalvorgänge',
  '/business/office/employees/[id]': 'Personalakte',
};

// Resolve registered dynamic pages as well as ordinary parent routes. The
// popup's identity must come from shared labels, never from a record ID or a
// broad module fallback that makes a correct detail route look redirected.
const titleRoutes = [...APP_ROUTES.map(({ path, label }) => ({ path, label })),
  ...Object.entries(workspaceTitles).map(([path, label]) => ({ path, label }))]
  .map(route => ({ ...route, segments: route.path.split('/').filter(Boolean) }))
  .filter(route => route.segments.length > 0)
  .sort((a, b) => b.segments.length - a.segments.length ||
    b.segments.filter(part => !part.startsWith('[')).length - a.segments.filter(part => !part.startsWith('[')).length);

function registeredWorkspaceTitle(path: string) {
  const segments = path.split('/').filter(Boolean);
  return titleRoutes.find(route => route.segments.length <= segments.length &&
    route.segments.every((part, index) => part === segments[index] || /^\[(?!\.\.\.)[^\]]+\]$/.test(part)))?.label;
}

/** Route identity is shared with the desktop catalogue, never guessed from a record ID. */
export function administrationWorkspaceContext(href: string) {
  const route = canonicalDesktopCatalogRoute(href);
  const path = route.split(/[?#]/, 1)[0];
  const area = desktopCatalogAreaForRoute(route);
  const areaLabel = DESKTOP_AREAS.find(item => item.key === area)?.label ?? 'HealthOS';
  const title = workspaceTitles[path] ?? documentsWorkspaceRouteTitle(path) ?? registeredWorkspaceTitle(path) ?? areaLabel;
  return { route, area, areaLabel, title };
}
