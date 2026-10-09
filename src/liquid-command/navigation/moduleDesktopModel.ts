import type { DesktopApp } from './desktopAppCatalogModel';
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

const TASK_AREAS = ['Übersicht', 'Klient:innen', 'Planung', 'Einsätze & Durchführung', 'Mobilität', 'Nachweise', 'Personal', 'Abrechnung', 'Dokumente', 'Kommunikation', 'Organisation', 'Qualität & Auswertung', 'Zugänge & Berechtigungen', 'Verbindungen & Workspace', 'Moduleinstellungen'] as const;

/** Known aliases share a menu entry; full apps and saved widget IDs stay intact. */
function normalizeNavigationApp(app: DesktopApp): DesktopApp {
  let route = app.route;
  if (route === '/assist/einsaetze') route = '/assist/assignments';
  if (route === '/assist/kalender') route = '/assist/calendar';
  if (route === '/business/office/portals') route = '/business/office/access';
  if (route === '/office/messages' || route.startsWith('/office/messages?')) route = route.replace('/office/messages', '/business/messages');
  const labels: Record<string, string> = {
    '/office': 'Office-Arbeitsbereiche',
    '/assist/assignments': 'Einsätze',
    '/assist/calendar': 'Kalender & Einsatzplanung',
    '/assist/zugeordnete-klienten': 'Zugeordnete Klient:innen',
    '/business/office/access': 'Benutzer & Portale',
    '/business/office/time-tracking': 'Zeitkonten & Arbeitszeit',
    '/business/office/time-tracking/live': 'Live-Anwesenheit',
    '/business/templates': 'Dokumentvorlagen',
    '/office/messages/templates': 'Nachrichtenvorlagen',
    '/office/messages/settings': 'Nachrichten-Einstellungen',
    '/business/messages?audience=employees&view=chats&chatAge=new': 'Neue Mitarbeitenden-Chats',
    '/business/office/reporting': 'Berichte',
    '/business/office/audit-log': 'Änderungsprotokoll',
    '/assist/einstellungen': 'Assist-Einstellungen',
  };
  return { ...app, route, label: labels[route] ?? app.label, description: `${app.description} ${app.label}` };
}

function taskArea(app: DesktopApp): typeof TASK_AREAS[number] {
  const route = app.route.split('?')[0];
  if (route.startsWith('/business/connect/') || route === '/business/integrations') return 'Verbindungen & Workspace';
  if (route.startsWith('/business/messages') || route.startsWith('/office/messages')) return 'Kommunikation';
  if (/\/(access|permissions|modules)$/.test(route) || route === '/assist/portale') return 'Zugänge & Berechtigungen';
  if (/\/(qm|qualitaet|reporting|audit-log)$/.test(route)) return 'Qualität & Auswertung';
  if (/\/einstellungen$/.test(route)) return 'Moduleinstellungen';
  if (/clients|klienten|residents|bewohner/.test(route)) return 'Klient:innen';
  if (/document|dokument|template/.test(route)) return 'Dokumente';
  if (/nachweise|proof|signature/.test(route)) return 'Nachweise';
  if (/payroll|employee|personal|time-tracking|fahrtenbuch/.test(route)) return 'Personal';
  if (/invoice|billing|abrechnung|budget/.test(route)) return 'Abrechnung';
  if (/kalender|calendar|tour|dienst|planning/.test(route)) return 'Planung';
  if (/\/fahrten$/.test(route)) return 'Mobilität';
  if (/assignments|einsaetze|durchfuehrung|aufgaben|execution|live-status|dokumentation|medikation|vital/.test(route)) return 'Einsätze & Durchführung';
  if (route === '/office' || route === '/business/office/dashboard' || DESKTOP_MODULES.some(m => route === `/${m.key}`)) return 'Übersicht';
  return 'Organisation';
}
export function buildModuleDesktopNavigation(apps: readonly DesktopApp[], module: ProductKey, query = '') {
  const needle = query.trim().toLocaleLowerCase('de-DE');
  const seen = new Set<string>();
  const local = apps.filter(app => desktopModuleForRoute(app.route) === module)
    // Workspace services remain available in Apps, under one navigation entry.
    .filter(app => !app.route.startsWith('/business/connect/google-workspace?'))
    .map(normalizeNavigationApp)
    .filter(app => { if (seen.has(app.route)) return false; seen.add(app.route); return true; })
    .filter(app => !needle || `${app.label} ${app.description}`.toLocaleLowerCase('de-DE').includes(needle));
  return TASK_AREAS.map(title => ({ title, items: local.filter(app => taskArea(app) === title) })).filter(group => group.items.length);
}
