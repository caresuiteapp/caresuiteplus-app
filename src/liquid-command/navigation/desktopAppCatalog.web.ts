import { liquidGlobalShortcuts, liquidModules, liquidWorkAreas } from './moduleCatalog';
import { officeNav } from '@/lib/navigation/moduleNav/officeNav';
import { assistNav } from '@/lib/navigation/moduleNav/assistNav';
import { pflegeNav } from '@/lib/navigation/moduleNav/pflegeNav';
import { stationaerNav } from '@/lib/navigation/moduleNav/stationaerNav';
import { beratungNav } from '@/lib/navigation/moduleNav/beratungNav';
import { akademieNav } from '@/lib/navigation/moduleNav/akademieNav';
import { zentraleNav } from '@/lib/navigation/moduleNav/zentraleNav';
import { WORKSPACE_SERVICES, workspaceHref } from '@/lib/googleWorkspace/workspaceModel';
import { isUnreleasedModuleKey, isUnreleasedModuleRoute } from '@/lib/modules/constants';

export const DESKTOP_CATEGORIES = ['Übersicht', 'Versorgung', 'Team', 'Verwaltung', 'Workspace'] as const;
export type DesktopCategory = (typeof DESKTOP_CATEGORIES)[number];
export type DesktopApp = {
  id: string; label: string; description: string; route: string;
  category: DesktopCategory; group?: string; glyph?: string;
};
export const DESKTOP_NAVIGATION_SECTIONS = ['Assist', 'Office', 'Einstellungen'] as const;
export type DesktopNavigationSection = (typeof DESKTOP_NAVIGATION_SECTIONS)[number];
export type DesktopNavigationGroup = {
  title: DesktopNavigationSection;
  items: DesktopApp[];
};
const moduleCategory: Record<string, DesktopCategory> = {
  home: 'Übersicht', zentrale: 'Übersicht', office: 'Verwaltung',
  assist: 'Versorgung', pflege: 'Versorgung', stationaer: 'Versorgung', beratung: 'Versorgung',
  akademie: 'Team', robotics: 'Verwaltung', settings: 'Verwaltung',
};

/** One page catalogue for the desktop navigation and Apps; widgets retain their own IDs and storage. */
export function buildDesktopApps(widgetApps: readonly DesktopApp[], roleKey?: string | null): DesktopApp[] {
  const apps: DesktopApp[] = [];
  const knownRoutes = new Set(widgetApps.map(app => app.route));
  const seen = new Set<string>(['/']);
  const add = (app: DesktopApp) => {
    // Unreleased products must not leak into navigation, Apps or search through
    // static catalogues, module sub-pages or old global shortcuts.
    if (isUnreleasedModuleRoute(app.route)) return;
    // Prefer the existing business destination when the Office menu uses its alias.
    const businessAlias = app.route.replace(/^\/office(?=\/|\?|$)/, '/business/office');
    const route = knownRoutes.has(businessAlias) ? businessAlias : app.route;
    if (seen.has(route)) return;
    seen.add(route);
    apps.push({ ...app, route });
  };
  widgetApps.forEach(app => add({ ...app, glyph: app.category === 'Workspace' ? 'G' : '↗' }));
  WORKSPACE_SERVICES.forEach(service => add({
    id: `workspace-${service.key}`, label: service.title, description: service.description,
    category: 'Workspace', route: workspaceHref(service.key), glyph: service.glyph,
  }));
  add({ id: 'workspace-activity', label: 'Workspace-Aktivitäten', description: 'Abrufe und Aktionen Ihrer Google-Verbindung.',
    category: 'Workspace', route: workspaceHref('activity'), glyph: '◷' });
  liquidModules.forEach(module => {
    if (isUnreleasedModuleKey(module.key)) return;
    const category = moduleCategory[module.key] ?? 'Verwaltung';
    add({ id: `module-${module.key}`, label: module.label, description: module.description,
      route: module.route, category, group: module.label, glyph: module.glyph });
    liquidWorkAreas[module.key].forEach(area => add({ ...area,
      id: `${module.key}-${area.id}`, category, group: module.label, glyph: module.glyph }));
  });
  [zentraleNav, officeNav, assistNav, pflegeNav, stationaerNav, beratungNav, akademieNav].forEach(module => {
    if (isUnreleasedModuleKey(module.moduleKey)) return;
    module.groups.forEach(group => group.items.forEach(item => {
      if (item.allowedRoles && !item.allowedRoles.some(role => role === roleKey)) return;
      add({ id: `${module.moduleKey}-${item.key}`, label: item.label, route: item.href,
        description: `${module.label} · ${group.title}`, group: `${module.label} · ${group.title}`,
        category: moduleCategory[module.moduleKey], glyph: '↗' });
    }));
  });
  liquidGlobalShortcuts.forEach(shortcut => add({ ...shortcut, category: 'Übersicht' }));
  if (roleKey === 'platform_admin') liquidWorkAreas.platform.forEach(area => add({ ...area,
    id: `platform-${area.id}`, category: 'Verwaltung', group: 'Plattform', glyph: '▦' }));
  add({ id: 'support', label: 'Support & Hilfe', description: 'Chat, Tickets und Freigaben.', route: '/support', category: 'Verwaltung', glyph: '?' });
  return apps;
}

const SETTINGS_ROUTES = new Set([
  '/business/office/permissions',
  '/business/integrations',
  '/business/templates',
  ...liquidWorkAreas.settings.map(area => area.route),
]);

function desktopNavigationSection(app: DesktopApp): DesktopNavigationSection | null {
  const route = app.route.split('?')[0];

  if (
    route === '/settings' ||
    route.startsWith('/settings/') ||
    route === '/support' ||
    SETTINGS_ROUTES.has(route)
  ) return 'Einstellungen';

  if (route === '/assist' || route.startsWith('/assist/')) return 'Assist';

  if (
    route === '/office' ||
    route.startsWith('/office/') ||
    route === '/business/office' ||
    route.startsWith('/business/office/') ||
    route === '/business/messages' ||
    route.startsWith('/business/messages/')
  ) return 'Office';

  return null;
}

/**
 * The desktop sidebar is the operational CareSuite navigation. It deliberately
 * exposes only the three agreed workspaces; product catalogues such as Robotics
 * remain available outside this navigation and cannot leak in through widgets.
 */
export function buildDesktopNavigationGroups(
  apps: readonly DesktopApp[],
  query = '',
): DesktopNavigationGroup[] {
  const needle = query.trim().toLocaleLowerCase('de-DE');
  const matches = (app: DesktopApp) => !needle ||
    `${app.label} ${app.description} ${app.group ?? ''}`
      .toLocaleLowerCase('de-DE')
      .includes(needle);

  return DESKTOP_NAVIGATION_SECTIONS.map(title => ({
    title,
    items: apps.filter(app => desktopNavigationSection(app) === title && matches(app)),
  })).filter(group => group.items.length > 0);
}
