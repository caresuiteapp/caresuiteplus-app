import { getRouteByPath } from './routes';
import { documentsWorkspaceRouteTitle } from './documentsWorkspaceRoutes';
import { canonicalDesktopCatalogRoute, desktopCatalogAreaForRoute } from '@/liquid-command/navigation/appsWidgetsCatalogModel.shared';
import { DESKTOP_AREAS } from '@/liquid-command/navigation/desktopAreas';

const companyTitles: Readonly<Record<string, string>> = {
  '/unternehmen': 'Unternehmen', '/unternehmen/standorte': 'Standorte',
  '/unternehmen/abteilungen': 'Abteilungen', '/unternehmen/gesellschaften': 'Gesellschaften',
  '/unternehmen/franchise': 'Franchise & Beziehungen', '/unternehmen/personalzuordnung': 'Personalzuordnung',
  '/unternehmen/zugriffe': 'Zugriffsbereiche', '/unternehmen/inventar': 'Inventar',
  '/unternehmen/ressourcen': 'Verträge & Ressourcen', '/unternehmen/vertraege': 'Verträge',
  '/unternehmen/versicherungen': 'Versicherungen', '/unternehmen/fuhrpark': 'Fuhrpark',
  '/unternehmen/zuordnungen': 'Ressourcenzuordnung', '/office/notizen': 'Notizen',
};

/** Route identity is shared with the desktop catalogue, never guessed from a record ID. */
export function administrationWorkspaceContext(href: string) {
  const route = canonicalDesktopCatalogRoute(href);
  const path = route.split(/[?#]/, 1)[0];
  const area = desktopCatalogAreaForRoute(route);
  const areaLabel = DESKTOP_AREAS.find(item => item.key === area)?.label ?? 'HealthOS';
  const title = companyTitles[path] ?? documentsWorkspaceRouteTitle(path) ?? getRouteByPath(path)?.label ?? areaLabel;
  return { route, area, areaLabel, title };
}
