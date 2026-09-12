import { liquidGlobalShortcuts, liquidModules, liquidWorkAreas } from './moduleCatalog';
import { officeNav } from '@/lib/navigation/moduleNav/officeNav';
import { assistNav } from '@/lib/navigation/moduleNav/assistNav';
import { pflegeNav } from '@/lib/navigation/moduleNav/pflegeNav';
import { stationaerNav } from '@/lib/navigation/moduleNav/stationaerNav';
import { beratungNav } from '@/lib/navigation/moduleNav/beratungNav';
import { akademieNav } from '@/lib/navigation/moduleNav/akademieNav';
import { zentraleNav } from '@/lib/navigation/moduleNav/zentraleNav';
import { WORKSPACE_SERVICES, workspaceHref } from '@/lib/googleWorkspace/workspaceModel';

export const DESKTOP_CATEGORIES = ['Übersicht', 'Versorgung', 'Team', 'Verwaltung', 'Workspace'] as const;
export type DesktopCategory = (typeof DESKTOP_CATEGORIES)[number];
export type DesktopApp = {
  id: string; label: string; description: string; route: string;
  category: DesktopCategory; group?: string; glyph?: string;
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
    const category = moduleCategory[module.key] ?? 'Verwaltung';
    add({ id: `module-${module.key}`, label: module.label, description: module.description,
      route: module.route, category, group: module.label, glyph: module.glyph });
    liquidWorkAreas[module.key].forEach(area => add({ ...area,
      id: `${module.key}-${area.id}`, category, group: module.label, glyph: module.glyph }));
  });
  [zentraleNav, officeNav, assistNav, pflegeNav, stationaerNav, beratungNav, akademieNav].forEach(module => {
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
