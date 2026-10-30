import { getRouteByPath } from './routes';
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
};

/** Route identity is shared with the desktop catalogue, never guessed from a record ID. */
export function administrationWorkspaceContext(href: string) {
  const route = canonicalDesktopCatalogRoute(href);
  const path = route.split(/[?#]/, 1)[0];
  const area = desktopCatalogAreaForRoute(route);
  const areaLabel = DESKTOP_AREAS.find(item => item.key === area)?.label ?? 'HealthOS';
  const title = workspaceTitles[path] ?? documentsWorkspaceRouteTitle(path) ?? getRouteByPath(path)?.label ?? areaLabel;
  return { route, area, areaLabel, title };
}
