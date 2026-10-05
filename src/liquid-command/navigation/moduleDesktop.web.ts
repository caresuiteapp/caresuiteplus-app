import type { DesktopApp } from './desktopAppCatalog.web';
import type { ProductKey } from '@/types';

export const DESKTOP_MODULES: readonly { key: ProductKey; label: string }[] = [
  { key: 'office', label: 'Office' }, { key: 'assist', label: 'Assist' },
  { key: 'pflege', label: 'Pflegedienst Ambulant' }, { key: 'stationaer', label: 'Stationär' },
  { key: 'beratung', label: 'Beratung' }, { key: 'akademie', label: 'Akademie' },
];

export function desktopModuleForRoute(route: string): ProductKey | null {
  const path = route.split(/[?#]/, 1)[0];
  for (const module of DESKTOP_MODULES) {
    if (path === `/${module.key}` || path.startsWith(`/${module.key}/`)) return module.key;
  }
  if (path === '/business/office' || path.startsWith('/business/office/') ||
      path === '/business/messages' || path.startsWith('/business/messages/') ||
      path.startsWith('/business/connect/') || path === '/business/integrations' ||
      path === '/business/templates') return 'office';
  return null;
}

export function moduleDesktopStorageKey(tenantId: string, userId: string, module: ProductKey) {
  return `caresuite.healthos.module-desktop.v1.${encodeURIComponent(JSON.stringify([tenantId, userId, module]))}`;
}

export function normalizeModuleWidgets(value: unknown, availableIds: readonly string[], defaults: readonly string[]) {
  const allowed = new Set(availableIds);
  const source = Array.isArray(value) ? value : defaults;
  return [...new Set(source.filter((id): id is string => typeof id === 'string' && allowed.has(id)))].slice(0, 12);
}

const TASK_AREAS = ['Übersicht', 'Klient:innen', 'Planung', 'Durchführung', 'Nachweise', 'Personal', 'Abrechnung', 'Dokumente', 'Organisation'] as const;
function taskArea(app: DesktopApp): typeof TASK_AREAS[number] {
  const route = app.route.split('?')[0];
  if (/clients|klienten|residents|bewohner/.test(route)) return 'Klient:innen';
  if (/nachweise|proof|signature/.test(route)) return 'Nachweise';
  if (/payroll|invoice|billing|abrechnung|budget/.test(route)) return 'Abrechnung';
  if (/employee|personal|time-tracking|fahrtenbuch/.test(route)) return 'Personal';
  if (/kalender|calendar|tour|dienst|planning/.test(route)) return 'Planung';
  if (/einsaetze|execution|live-status|dokumentation|medikation|vital/.test(route)) return 'Durchführung';
  if (/document|dokument|template/.test(route)) return 'Dokumente';
  if (route === '/office' || route === '/business/office/dashboard' || DESKTOP_MODULES.some(m => route === `/${m.key}`)) return 'Übersicht';
  return 'Organisation';
}
export function buildModuleDesktopNavigation(apps: readonly DesktopApp[], module: ProductKey, query = '') {
  const needle = query.trim().toLocaleLowerCase('de-DE');
  const local = apps.filter(app => desktopModuleForRoute(app.route) === module &&
    (!needle || `${app.label} ${app.description}`.toLocaleLowerCase('de-DE').includes(needle)));
  return TASK_AREAS.map(title => ({ title, items: local.filter(app => taskArea(app) === title) })).filter(group => group.items.length);
}
