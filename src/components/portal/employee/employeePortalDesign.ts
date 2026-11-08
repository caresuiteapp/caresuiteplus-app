import type { LiquidPortalNavigationItem } from '@/liquid-command/navigation/portalCatalog';

export const employeePortalDesign = {
  canvas: '#102238',
  header: 'rgba(235,246,255,0.10)', rail: 'rgba(10,24,39,0.24)',
  panel: 'rgba(235,246,255,0.095)', raised: 'rgba(235,246,255,0.115)',
  control: 'rgba(10,24,39,0.42)', dialog: '#20394F',
  line: 'rgba(213,235,252,0.24)', text: '#F5F9FF', muted: '#D9E9F5',
  accent: '#BCEEFF', selected: 'rgba(83,184,225,0.22)', warning: '#FFE5B8', danger: '#FFE1E9',
} as const;

export const employeePortalWorkspace = {
  canvas: '#F0F5F8',
  surface: '#FFFFFF',
  subtle: '#EAF2F7',
  line: '#D2E0E9',
  text: '#102B40',
  secondary: '#3D5A70',
  accent: '#086B69',
  accentSoft: '#E4F3F1',
  danger: '#A4233B',
  radius: 16,
} as const;

/** Use available workspace width, including the always-visible navigation rail. */
export function employeePortalLayout(width: number, fontScale = 1) {
  const phone = width < 600;
  const railArtworkSize = phone ? 44 : width < 1100 ? 54 : 64;
  const railButtonSize = railArtworkSize + 10;
  const railWidth = railButtonSize + 14;
  const padding = phone ? 12 : width < 1000 ? 20 : 28;
  const contentWidth = Math.max(0, width - railWidth - padding * 2);
  const readableWidth = contentWidth / Math.max(1, fontScale);
  return {
    phone, railWidth, railArtworkSize, railButtonSize, padding, contentWidth,
    metricColumns: readableWidth >= 650 ? 4 : readableWidth >= 270 ? 2 : 1,
    splitFocus: readableWidth >= 680,
    groupColumns: readableWidth >= 820 ? 3 : readableWidth >= 550 ? 2 : 1,
    shortcutTiles: readableWidth >= 1200,
    shortcutArtworkSize: phone ? 56 : 68,
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
    .replace(/^\/portal\/employee\/signatures(?=\/|$)/, '/portal/employee/documents/signatures')
    .replace(/^\/portal\/employee\/schedule$/, '/portal/employee/calendar')
    .replace(/^\/portal\/employee\/execution$/, '/portal/employee/assignments');
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
