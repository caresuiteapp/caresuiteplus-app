import type { LiquidPortalNavigationItem } from '@/liquid-command/navigation/portalCatalog';

export const employeePortalDesign = {
  canvas: '#0C1E31', header: '#102134', rail: '#0A192A', panel: '#10263B',
  raised: '#163047', line: '#304B61', text: '#F5F9FF', muted: '#B0C7D9',
  accent: '#8DDCF4', selected: '#123F59', warning: '#FFD596', danger: '#FFBDCA',
} as const;

/** Use available workspace width, including the always-visible navigation rail. */
export function employeePortalLayout(width: number, fontScale = 1) {
  const phone = width < 600;
  const railWidth = phone ? 52 : 72;
  const padding = phone ? 12 : width < 1000 ? 20 : 28;
  const contentWidth = Math.max(0, width - railWidth - padding * 2);
  const readableWidth = contentWidth / Math.max(1, fontScale);
  return {
    phone, railWidth, padding, contentWidth,
    metricColumns: readableWidth >= 650 ? 4 : readableWidth >= 270 ? 2 : 1,
    splitFocus: readableWidth >= 680,
    groupColumns: readableWidth >= 820 ? 3 : readableWidth >= 550 ? 2 : 1,
  };
}

/** These are the same functions in the administration and the employee's scope. */
export const employeePortalArtwork: Record<string, string> = {
  home: '/portal/employee', 'open-assignments': '/portal/employee/offene-einsaetze',
  leave: '/portal/employee/arbeitszeit/urlaub', absence: '/portal/employee/arbeitszeit/abwesenheiten',
  uploads: '/portal/employee/uploads', announcements: '/business/messages?audience=employees&view=broadcasts',
  payroll: '/business/office/payroll', 'care-tours': '/pflege/tourenplanung',
  assignments: '/assist/assignments', documentation: '/office/dokumentation',
  clients: '/assist/zugeordnete-klienten', calendar: '/assist/calendar',
  time: '/business/office/time-tracking', logbook: '/business/office/fahrtenbuch',
  messages: '/business/messages?audience=employees', tasks: '/assist/aufgaben',
  documents: '/business/office/documents', academy: '/akademie',
  consultation: '/beratung', profile: '/settings/profile', help: '/support',
};

export const employeeRailIds = [
  'home', 'assignments', 'open-assignments', 'documentation', 'clients', 'calendar',
  'care-tours', 'consultation', 'academy', 'time', 'logbook', 'messages',
] as const;

export function employeePortalActiveId(pathname: string, navigation: readonly LiquidPortalNavigationItem[]) {
  const path = pathname.replace(/\/+$/, '').replace(/^\/portal\/employee\/times(?=\/|$)/, '/portal/employee/arbeitszeit')
    .replace(/^\/portal\/employee\/signatures(?=\/|$)/, '/portal/employee/documents/signatures');
  return [...navigation].sort((a, b) => b.route.length - a.route.length)
    .find(item => path === item.route || path.startsWith(`${item.route}/`))?.id ?? 'home';
}

export function employeePortalGroups(navigation: readonly LiquidPortalNavigationItem[]) {
  return [
    { title: 'Mein Arbeitstag', ids: ['assignments', 'documentation', 'clients', 'care-tours', 'consultation', 'academy'] },
    { title: 'Zeit & unterwegs', ids: ['calendar', 'time', 'logbook'] },
    { title: 'Im Austausch', ids: ['messages', 'tasks', 'documents'] },
  ].map(group => ({ title: group.title, items: group.ids.flatMap(id => navigation.filter(item => item.id === id)) }))
    .filter(group => group.items.length);
}
