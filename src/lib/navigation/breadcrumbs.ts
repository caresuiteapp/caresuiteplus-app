import type { BreadcrumbItem, BreadcrumbTrail } from '@/types/navigation/breadcrumbs';
import { APP_ROUTES, getRouteByPath } from './routes';

const SEGMENT_LABELS: Record<string, string> = {
  create: 'Neu anlegen',
  edit: 'Bearbeiten',
  clients: 'Klient:innen',
  employees: 'Mitarbeitende',
  budgets: 'Budgets',
  durchfuehrung: 'Durchführung',
  nachweise: 'Nachweise',
  fahrten: 'Fahrten',
  execute: 'Durchführen',
  invoices: 'Rechnungen',
  assignments: 'Einsätze',
  calendar: 'Kalender',
  plans: 'Pflegepläne',
  vitalwerte: 'Vitalwerte',
  cases: 'Fälle',
  courses: 'Kurse',
  bewohner: 'Bewohner:innen',
  wohnbereiche: 'Wohnbereiche',
  uebergabebericht: 'Übergabebericht',
  auswertungen: 'Auswertungen',
  settings: 'Einstellungen',
  teilnehmer: 'Teilnehmer',
  zertifikate: 'Zertifikate',
  protokolle: 'Protokolle',
  wiedervorlagen: 'Wiedervorlagen',
  audit: 'Audit-Log',
  consent: 'Einwilligungen',
  kim: 'KIM-Postfach',
  documents: 'Dokumente',
  appointments: 'Termine',
  messages: 'Nachrichten',
  modules: 'Module verwalten',
};

function normalizePathname(pathname: string): string {
  return pathname.split('?')[0].replace(/\/$/, '') || '/';
}

function isDynamicSegment(segment: string): boolean {
  if (segment.startsWith('[')) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return true;
  }
  return segment.length > 24;
}

function labelForSegment(segment: string, cumulativePath: string): string {
  const route = getRouteByPath(cumulativePath);
  if (route) return route.label;

  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  if (segment === 'create') return 'Neu anlegen';
  if (isDynamicSegment(segment)) return 'Detail';

  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

/**
 * Erzeugt eine Breadcrumb-Kette aus einem Expo-Router-Pfad.
 * Nutzt APP_ROUTES als Label-Quelle; dynamische Segmente werden als „Detail“ dargestellt.
 */
export function getBreadcrumbs(pathname: string): BreadcrumbTrail {
  const normalized = normalizePathname(pathname);

  if (normalized === '/') {
    return [{ path: '/', label: 'Start', isCurrent: true }];
  }

  const segments = normalized.split('/').filter(Boolean);
  const crumbs: BreadcrumbItem[] = [];

  const rootRoute = APP_ROUTES.find((r) => r.path === '/');
  crumbs.push({
    path: '/',
    label: rootRoute?.label ?? 'Start',
  });

  let cumulative = '';
  segments.forEach((segment, index) => {
    cumulative += `/${segment}`;
    const isLast = index === segments.length - 1;

    crumbs.push({
      path: cumulative,
      label: labelForSegment(segment, cumulative),
      isCurrent: isLast,
    });
  });

  return crumbs;
}

export function formatBreadcrumbTrail(trail: BreadcrumbTrail): string {
  return trail.map((item) => item.label).join(' › ');
}
