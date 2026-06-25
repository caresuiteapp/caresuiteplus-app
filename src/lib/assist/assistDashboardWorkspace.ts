import type { DashboardKpi, DashboardQuickAction } from '@/types/dashboard';
import type { AssistDashboardStats } from '@/types/modules/assist';

export const ASSIST_WORKSPACE_KPI_COUNT = 8;
export const ASSIST_ACCENT = '#0EA5E9';

function emptySubValue(count: number, emptyLabel: string, activeLabel: (n: number) => string): string {
  return count === 0 ? emptyLabel : activeLabel(count);
}

/** Eight Assist workspace KPIs — planning, execution and proof workflow. */
export function buildAssistWorkspaceKpis(stats: AssistDashboardStats): DashboardKpi[] {
  const accent = ASSIST_ACCENT;
  const warn = '#F59E0B';
  const danger = '#EF4444';
  const runningNow = stats.activeCount + stats.inProgressCount;

  return [
    {
      id: 'assist-ws-kpi-today',
      label: 'Heute geplant',
      value: stats.todayCount,
      subValue: emptySubValue(stats.todayCount, 'Keine Einsätze heute', (n) => `${n} geplant`),
      icon: '📅',
      accentColor: accent,
      route: '/assist/assignments',
    },
    {
      id: 'assist-ws-kpi-running',
      label: 'Läuft gerade',
      value: runningNow,
      subValue: emptySubValue(runningNow, 'Kein laufender Einsatz', (n) => `${n} in Durchführung`),
      icon: '▶️',
      accentColor: runningNow > 0 ? '#22C55E' : accent,
      route: '/assist/durchfuehrung',
    },
    {
      id: 'assist-ws-kpi-documentation',
      label: 'Dokumentation offen',
      value: stats.incompleteCount,
      subValue: emptySubValue(stats.incompleteCount, 'Alles dokumentiert', (n) => `${n} offen`),
      icon: '📝',
      accentColor: stats.incompleteCount > 0 ? warn : accent,
      route: '/assist/durchfuehrung',
    },
    {
      id: 'assist-ws-kpi-signature',
      label: 'Signatur offen',
      value: stats.openSignatureCount,
      subValue: emptySubValue(stats.openSignatureCount, 'Keine offenen', (n) => `${n} offen`),
      icon: '🖊️',
      accentColor: stats.openSignatureCount > 0 ? warn : accent,
      route: '/assist/nachweise',
    },
    {
      id: 'assist-ws-kpi-proof-review',
      label: 'Nachweise zu prüfen',
      value: stats.openProofReviewCount,
      subValue: emptySubValue(stats.openProofReviewCount, 'Keine offenen', (n) => `${n} zu prüfen`),
      icon: '✍️',
      accentColor: stats.openProofReviewCount > 0 ? warn : accent,
      route: '/assist/nachweise',
    },
    {
      id: 'assist-ws-kpi-at-risk',
      label: 'Problemfälle',
      value: stats.atRiskCount,
      subValue: emptySubValue(stats.atRiskCount, 'Keine Risiken', (n) => `${n} prüfen`),
      icon: '⚠️',
      accentColor: stats.atRiskCount > 0 ? danger : accent,
      route: '/assist/qualitaet',
    },
    {
      id: 'assist-ws-kpi-portal-release',
      label: 'Portal-Freigabe offen',
      value: stats.openPortalReleaseCount,
      subValue: emptySubValue(stats.openPortalReleaseCount, 'Keine offenen', (n) => `${n} offen`),
      icon: '🌐',
      accentColor: stats.openPortalReleaseCount > 0 ? '#8B5CF6' : accent,
      route: '/assist/nachweise',
    },
    {
      id: 'assist-ws-kpi-trips',
      label: 'Fahrten offen',
      value: stats.openTripsCount,
      subValue: emptySubValue(stats.openTripsCount, 'Keine offenen', (n) => `${n} offen`),
      icon: '🚗',
      accentColor: stats.openTripsCount > 0 ? warn : accent,
      route: '/assist/fahrten',
    },
  ];
}

export const ASSIST_HEADER_PRIMARY_ACTIONS: DashboardQuickAction[] = [
  {
    id: 'assist-header-plan',
    label: 'Einsatz planen',
    icon: '➕',
    route: '/assist/assignments?create=1',
    variant: 'primary',
  },
];

export const ASSIST_SIDEBAR_QUICK_ACTIONS: DashboardQuickAction[] = [
  { id: 'assist-qa-plan', label: 'Einsatz planen', icon: '📅', route: '/assist/assignments?create=1' },
  { id: 'assist-qa-live', label: 'Live-Status', icon: '📡', route: '/assist/live-status' },
  { id: 'assist-qa-proof', label: 'Nachweis prüfen', icon: '📝', route: '/assist/nachweise' },
  { id: 'assist-qa-package', label: 'Aufgabenpaket', icon: '☑️', route: '/assist/aufgaben' },
];

export const ASSIST_QUICK_ACCESS: DashboardQuickAction[] = [
  { id: 'assist-qa-assignments', label: 'Einsätze', icon: '📋', route: '/assist/assignments' },
  { id: 'assist-qa-durchfuehrung', label: 'Durchführung', icon: '✅', route: '/assist/durchfuehrung' },
  { id: 'assist-qa-nachweise', label: 'Nachweise', icon: '📝', route: '/assist/nachweise' },
  { id: 'assist-qa-aufgaben', label: 'Aufgaben', icon: '☑️', route: '/assist/aufgaben' },
  { id: 'assist-qa-live-status', label: 'Live-Status', icon: '📡', route: '/assist/live-status' },
  { id: 'assist-qa-fahrten', label: 'Fahrten', icon: '🚗', route: '/assist/fahrten' },
  { id: 'assist-qa-touren', label: 'Touren', icon: '🗺️', route: '/assist/touren' },
  { id: 'assist-qa-calendar', label: 'Kalender', icon: '📅', route: '/assist/calendar' },
  {
    id: 'assist-qa-clients',
    label: 'Zugeordnete Klient:innen',
    icon: '👥',
    route: '/assist/zugeordnete-klienten',
  },
  { id: 'assist-qa-settings', label: 'Einstellungen', icon: '⚙️', route: '/assist/einstellungen' },
];

export function buildAssistOpenTasks(
  stats: AssistDashboardStats | null | undefined,
): { title: string; count: number | string }[] {
  if (!stats) {
    return [{ title: 'Keine Assist-Daten', count: '—' }];
  }

  const runningNow = stats.activeCount + stats.inProgressCount;

  return [
    { title: 'Heutige Einsätze', count: stats.todayCount },
    { title: 'Laufende Einsätze', count: runningNow },
    { title: 'Dokumentation offen', count: stats.incompleteCount },
    { title: 'Signatur offen', count: stats.openSignatureCount },
    { title: 'Nachweise zu prüfen', count: stats.openProofReviewCount },
  ];
}
