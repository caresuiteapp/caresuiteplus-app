import type { DashboardKpi, DashboardQuickAction } from '@/types/dashboard';
import type { BeratungDashboardStats, CounselingListItem } from '@/types/modules/beratung';

export const BERATUNG_WORKSPACE_KPI_COUNT = 12;
export const BERATUNG_ACCENT = '#8B5CF6';

export type BeratungDashboardSection = {
  id: string;
  title: string;
  subtitle: string;
  links: {
    id: string;
    label: string;
    description?: string;
    route: string;
    count?: number;
    icon?: string;
  }[];
};

export type BeratungPriorityItem = {
  id: string;
  label: string;
  description: string;
  route: string;
  severity: 'high' | 'medium' | 'low';
  count?: number;
};

function emptySubValue(count: number, emptyLabel: string, activeLabel: (n: number) => string): string {
  return count === 0 ? emptyLabel : activeLabel(count);
}

/** Twelve consultation workspace KPIs — not Office or Zentrale tiles. */
export function buildBeratungWorkspaceKpis(stats: BeratungDashboardStats): DashboardKpi[] {
  const accent = BERATUNG_ACCENT;
  const warn = '#F59E0B';
  const danger = '#EF4444';

  return [
    {
      id: 'beratung-ws-kpi-open-cases',
      label: 'Offene Fälle',
      value: stats.openCount,
      subValue: emptySubValue(stats.openCount, 'Keine offenen Fälle', (n) => `${n} aktiv bearbeitet`),
      icon: '📋',
      accentColor: accent,
      route: '/beratung/cases?status=open',
    },
    {
      id: 'beratung-ws-kpi-new-cases',
      label: 'Neue Fälle',
      value: stats.newCasesCount,
      subValue: emptySubValue(stats.newCasesCount, 'Keine neuen Fälle', (n) => `${n} neu`),
      icon: '✨',
      accentColor: stats.newCasesCount > 0 ? warn : accent,
      route: '/beratung/cases?filter=new',
    },
    {
      id: 'beratung-ws-kpi-appointments-today',
      label: 'Termine heute',
      value: stats.appointmentsTodayCount,
      subValue: emptySubValue(stats.appointmentsTodayCount, 'Keine Termine heute', (n) => `${n} geplant`),
      icon: '📅',
      accentColor: accent,
      route: '/beratung/calendar?date=today',
    },
    {
      id: 'beratung-ws-kpi-first-consultations',
      label: 'Erstgespräche offen',
      value: stats.openFirstConsultationsCount,
      subValue: emptySubValue(
        stats.openFirstConsultationsCount,
        'Keine offenen Erstgespräche',
        (n) => `${n} offen`,
      ),
      icon: '🤝',
      accentColor: stats.openFirstConsultationsCount > 0 ? warn : accent,
      route: '/beratung/erstgespraech?status=open',
    },
    {
      id: 'beratung-ws-kpi-protocols',
      label: 'Protokolle offen',
      value: stats.openProtocolsCount,
      subValue: emptySubValue(stats.openProtocolsCount, 'Alle Protokolle abgeschlossen', (n) => `${n} offen`),
      icon: '📝',
      accentColor: stats.openProtocolsCount > 0 ? warn : accent,
      route: '/beratung/protokolle?status=open',
    },
    {
      id: 'beratung-ws-kpi-follow-ups',
      label: 'Wiedervorlagen fällig',
      value: stats.dueFollowUpsCount,
      subValue: emptySubValue(stats.dueFollowUpsCount, 'Keine fälligen Wiedervorlagen', (n) => `${n} fällig`),
      icon: '🔔',
      accentColor: stats.dueFollowUpsCount > 0 ? warn : accent,
      route: '/beratung/wiedervorlagen?filter=due',
    },
    {
      id: 'beratung-ws-kpi-callbacks',
      label: 'Rückmeldungen offen',
      value: stats.openCallbacksCount,
      subValue: emptySubValue(stats.openCallbacksCount, 'Keine offenen Rückmeldungen', (n) => `${n} offen`),
      icon: '📞',
      accentColor: stats.openCallbacksCount > 0 ? warn : accent,
      route: '/beratung/kontaktverlauf?filter=callback',
    },
    {
      id: 'beratung-ws-kpi-relatives',
      label: 'Angehörigenkontakte offen',
      value: stats.openRelativeContactsCount,
      subValue: emptySubValue(
        stats.openRelativeContactsCount,
        'Keine offenen Angehörigenkontakte',
        (n) => `${n} offen`,
      ),
      icon: '👨‍👩‍👧',
      accentColor: stats.openRelativeContactsCount > 0 ? warn : accent,
      route: '/beratung/angehoerige?status=open',
    },
    {
      id: 'beratung-ws-kpi-no-next-step',
      label: 'Fälle ohne nächsten Schritt',
      value: stats.casesWithoutNextStepCount,
      subValue: emptySubValue(
        stats.casesWithoutNextStepCount,
        'Alle Fälle haben nächsten Schritt',
        (n) => `${n} prüfen`,
      ),
      icon: '⚠️',
      accentColor: stats.casesWithoutNextStepCount > 0 ? danger : accent,
      route: '/beratung/cases?filter=no-next-step',
    },
    {
      id: 'beratung-ws-kpi-deadlines',
      label: 'Fristen / Eskalationen',
      value: stats.deadlinesEscalationsCount,
      subValue: emptySubValue(
        stats.deadlinesEscalationsCount,
        'Keine überfälligen Fristen',
        (n) => `${n} eskalieren`,
      ),
      icon: '⏰',
      accentColor: stats.deadlinesEscalationsCount > 0 ? danger : accent,
      route: '/beratung/wiedervorlagen?filter=overdue',
    },
    {
      id: 'beratung-ws-kpi-closed-week',
      label: 'Abgeschlossen diese Woche',
      value: stats.closedThisWeekCount,
      subValue: emptySubValue(stats.closedThisWeekCount, 'Keine Abschlüsse diese Woche', (n) => `${n} abgeschlossen`),
      icon: '✅',
      accentColor: accent,
      route: '/beratung/cases?status=closed&range=week',
    },
    {
      id: 'beratung-ws-kpi-reports',
      label: 'Berichte offen',
      value: stats.openReportsCount,
      subValue: emptySubValue(stats.openReportsCount, 'Keine offenen Berichte', (n) => `${n} offen`),
      icon: '📄',
      accentColor: stats.openReportsCount > 0 ? warn : accent,
      route: '/beratung/berichte?status=open',
    },
  ];
}

export const BERATUNG_HEADER_PRIMARY_ACTIONS: DashboardQuickAction[] = [
  {
    id: 'beratung-header-case',
    label: 'Fall anlegen',
    icon: '➕',
    route: '/beratung/faelle/new',
    variant: 'primary',
  },
  {
    id: 'beratung-header-first-consultation',
    label: 'Erstgespräch dokumentieren',
    icon: '➕',
    route: '/beratung/erstgespraech?create=1',
    variant: 'primary',
  },
];

export const BERATUNG_HEADER_SECONDARY_ACTIONS: DashboardQuickAction[] = [
  {
    id: 'beratung-header-follow-ups',
    label: 'Wiedervorlagen öffnen',
    icon: '🔔',
    route: '/beratung/wiedervorlagen',
    variant: 'secondary',
  },
  {
    id: 'beratung-header-protocol',
    label: 'Protokoll schreiben',
    icon: '📝',
    route: '/beratung/protokolle/new',
    variant: 'secondary',
  },
  {
    id: 'beratung-header-contact',
    label: 'Kontakt erfassen',
    icon: '📞',
    route: '/beratung/kontaktverlauf?create=1',
    variant: 'secondary',
  },
];

export const BERATUNG_SIDEBAR_QUICK_ACTIONS: DashboardQuickAction[] = [
  { id: 'beratung-qa-case', label: 'Fall anlegen', icon: '➕', route: '/beratung/faelle/new' },
  {
    id: 'beratung-qa-first-consultation',
    label: 'Erstgespräch dokumentieren',
    icon: '🤝',
    route: '/beratung/erstgespraech?create=1',
  },
  { id: 'beratung-qa-protocol', label: 'Protokoll schreiben', icon: '📝', route: '/beratung/protokolle/new' },
  {
    id: 'beratung-qa-follow-up',
    label: 'Wiedervorlage setzen',
    icon: '🔔',
    route: '/beratung/wiedervorlagen?create=1',
  },
  {
    id: 'beratung-qa-contact',
    label: 'Kontakt erfassen',
    icon: '📞',
    route: '/beratung/kontaktverlauf?create=1',
  },
  { id: 'beratung-qa-relatives', label: 'Angehörige öffnen', icon: '👨‍👩‍👧', route: '/beratung/angehoerige' },
  { id: 'beratung-qa-calendar', label: 'Kalender', icon: '📅', route: '/beratung/calendar' },
  { id: 'beratung-qa-reports', label: 'Berichte', icon: '📄', route: '/beratung/berichte' },
];

export const BERATUNG_QUICK_ACCESS: DashboardQuickAction[] = [
  { id: 'beratung-qa-all-cases', label: 'Alle Fälle', icon: '📋', route: '/beratung/cases' },
  { id: 'beratung-qa-overview', label: 'Fallübersicht', icon: '📂', route: '/beratung/faelle' },
  { id: 'beratung-qa-calendar', label: 'Kalender', icon: '📅', route: '/beratung/calendar' },
  { id: 'beratung-qa-protocols', label: 'Protokolle', icon: '📝', route: '/beratung/protokolle' },
  { id: 'beratung-qa-follow-ups', label: 'Wiedervorlagen', icon: '🔔', route: '/beratung/wiedervorlagen' },
  { id: 'beratung-qa-first-consultation', label: 'Erstgespräch', icon: '🤝', route: '/beratung/erstgespraech' },
  { id: 'beratung-qa-contact-log', label: 'Kontaktverlauf', icon: '📞', route: '/beratung/kontaktverlauf' },
  { id: 'beratung-qa-relatives', label: 'Angehörige', icon: '👨‍👩‍👧', route: '/beratung/angehoerige' },
  { id: 'beratung-qa-reports', label: 'Berichte', icon: '📄', route: '/beratung/berichte' },
  { id: 'beratung-qa-analytics', label: 'Auswertungen', icon: '📈', route: '/beratung/auswertungen' },
  { id: 'beratung-qa-settings', label: 'Einstellungen', icon: '⚙️', route: '/beratung/settings' },
];

export function buildBeratungOpenTasks(
  stats: BeratungDashboardStats | null | undefined,
): { title: string; count: number | string }[] {
  if (!stats) {
    return [{ title: 'Keine Beratungsdaten', count: '—' }];
  }

  return [
    { title: 'Termine', count: stats.appointmentsTodayCount },
    { title: 'Wiedervorlagen', count: stats.dueFollowUpsCount },
    { title: 'Protokolle', count: stats.openProtocolsCount },
    { title: 'Rückrufe', count: stats.openCallbacksCount },
    { title: 'Neue Fälle', count: stats.newCasesCount },
    { title: 'Fristen', count: stats.deadlinesEscalationsCount },
  ];
}

export function buildBeratungDashboardPriorities(stats: BeratungDashboardStats): BeratungPriorityItem[] {
  const items: BeratungPriorityItem[] = [];

  if (stats.deadlinesEscalationsCount > 0) {
    items.push({
      id: 'priority-deadlines',
      label: 'Fristen / Eskalationen',
      description: `${stats.deadlinesEscalationsCount} überfällige Wiedervorlage(n) — bitte bearbeiten.`,
      route: '/beratung/wiedervorlagen?filter=overdue',
      severity: 'high',
      count: stats.deadlinesEscalationsCount,
    });
  }
  if (stats.casesWithoutNextStepCount > 0) {
    items.push({
      id: 'priority-no-next-step',
      label: 'Fälle ohne nächsten Schritt',
      description: `${stats.casesWithoutNextStepCount} Fall/Fälle ohne Termin oder Wiedervorlage.`,
      route: '/beratung/cases?filter=no-next-step',
      severity: 'high',
      count: stats.casesWithoutNextStepCount,
    });
  }
  if (stats.dueFollowUpsCount > 0) {
    items.push({
      id: 'priority-follow-ups',
      label: 'Wiedervorlagen fällig',
      description: `${stats.dueFollowUpsCount} Wiedervorlage(n) sind heute oder überfällig.`,
      route: '/beratung/wiedervorlagen?filter=due',
      severity: 'medium',
      count: stats.dueFollowUpsCount,
    });
  }
  if (stats.openProtocolsCount > 0) {
    items.push({
      id: 'priority-protocols',
      label: 'Protokolle offen',
      description: `${stats.openProtocolsCount} Protokoll(e) warten auf Abschluss.`,
      route: '/beratung/protokolle?status=open',
      severity: 'medium',
      count: stats.openProtocolsCount,
    });
  }
  if (stats.openCallbacksCount > 0) {
    items.push({
      id: 'priority-callbacks',
      label: 'Rückmeldungen offen',
      description: `${stats.openCallbacksCount} Rückruf(e) sind noch offen.`,
      route: '/beratung/kontaktverlauf?filter=callback',
      severity: 'medium',
      count: stats.openCallbacksCount,
    });
  }
  if (stats.openFirstConsultationsCount > 0) {
    items.push({
      id: 'priority-first-consultation',
      label: 'Erstgespräche offen',
      description: `${stats.openFirstConsultationsCount} Erstgespräch/Erstberatung steht aus.`,
      route: '/beratung/erstgespraech?status=open',
      severity: 'low',
      count: stats.openFirstConsultationsCount,
    });
  }

  return items;
}

export function buildBeratungDashboardSections(
  stats: BeratungDashboardStats,
  recentCases: CounselingListItem[],
): BeratungDashboardSection[] {
  return [
    {
      id: 'cases',
      title: 'Aktuelle Fälle',
      subtitle: 'Offene Beratungsfälle und Fallübersicht',
      links: [
        {
          id: 'cases-all',
          label: 'Alle Fälle',
          description: 'Suche, Filter und Status',
          route: '/beratung/cases',
          count: stats.openCount,
          icon: '📋',
        },
        {
          id: 'cases-overview',
          label: 'Fallübersicht',
          description: 'Strukturierte Fallansicht',
          route: '/beratung/faelle',
          count: stats.totalCases,
          icon: '📂',
        },
        {
          id: 'cases-create',
          label: 'Fall anlegen',
          description: 'Neuen Beratungsfall eröffnen',
          route: '/beratung/faelle/new',
          icon: '➕',
        },
        ...(recentCases.slice(0, 3).map((counselingCase) => ({
          id: `case-${counselingCase.id}`,
          label: counselingCase.subject,
          description: counselingCase.clientName,
          route: `/beratung/cases/${counselingCase.id}`,
          icon: '👤' as const,
        })) ?? []),
      ],
    },
    {
      id: 'appointments',
      title: 'Termine & Erstgespräche',
      subtitle: 'Kalender, Erstberatung und Terminplanung',
      links: [
        {
          id: 'appt-calendar',
          label: 'Kalender',
          description: 'Termine und Erstgespräche',
          route: '/beratung/calendar',
          count: stats.appointmentsTodayCount,
          icon: '📅',
        },
        {
          id: 'appt-first-consultation',
          label: 'Erstgespräch',
          description: 'Erstberatung dokumentieren',
          route: '/beratung/erstgespraech',
          count: stats.openFirstConsultationsCount,
          icon: '🤝',
        },
        {
          id: 'appt-create',
          label: 'Erstgespräch dokumentieren',
          description: 'Neues Erstgespräch erfassen',
          route: '/beratung/erstgespraech?create=1',
          icon: '➕',
        },
      ],
    },
    {
      id: 'protocols',
      title: 'Protokolle & Dokumentation',
      subtitle: 'Fallbezogene Protokolle und Nachweise',
      links: [
        {
          id: 'proto-list',
          label: 'Protokolle',
          description: 'Alle Beratungsprotokolle',
          route: '/beratung/protokolle',
          count: stats.openProtocolsCount,
          icon: '📝',
        },
        {
          id: 'proto-create',
          label: 'Protokoll schreiben',
          description: 'Neues Protokoll anlegen',
          route: '/beratung/protokolle/new',
          icon: '➕',
        },
      ],
    },
    {
      id: 'follow-ups',
      title: 'Wiedervorlagen & Fristen',
      subtitle: 'Fällige Nachverfolgungen und Eskalationen',
      links: [
        {
          id: 'follow-list',
          label: 'Wiedervorlagen',
          description: 'Offene und fällige Termine',
          route: '/beratung/wiedervorlagen',
          count: stats.dueFollowUpsCount,
          icon: '🔔',
        },
        {
          id: 'follow-overdue',
          label: 'Fristen / Eskalationen',
          description: 'Überfällige Wiedervorlagen',
          route: '/beratung/wiedervorlagen?filter=overdue',
          count: stats.deadlinesEscalationsCount,
          icon: '⏰',
        },
        {
          id: 'follow-create',
          label: 'Wiedervorlage setzen',
          description: 'Neue Frist vergeben',
          route: '/beratung/wiedervorlagen?create=1',
          icon: '➕',
        },
      ],
    },
    {
      id: 'contacts',
      title: 'Kontakt & Angehörige',
      subtitle: 'Kontaktverlauf, Rückmeldungen und Angehörige',
      links: [
        {
          id: 'contact-log',
          label: 'Kontaktverlauf',
          description: 'Telefon, E-Mail und Gespräche',
          route: '/beratung/kontaktverlauf',
          count: stats.openCallbacksCount,
          icon: '📞',
        },
        {
          id: 'contact-relatives',
          label: 'Angehörige',
          description: 'Angehörigenkontakte und Beteiligte',
          route: '/beratung/angehoerige',
          count: stats.openRelativeContactsCount,
          icon: '👨‍👩‍👧',
        },
        {
          id: 'contact-create',
          label: 'Kontakt erfassen',
          description: 'Neuen Kontakt dokumentieren',
          route: '/beratung/kontaktverlauf?create=1',
          icon: '➕',
        },
      ],
    },
    {
      id: 'reports',
      title: 'Auswertungen & Berichte',
      subtitle: 'Berichte, KPIs und Modul-Auswertungen',
      links: [
        {
          id: 'reports-list',
          label: 'Berichte',
          description: 'Beratungsberichte und Entwürfe',
          route: '/beratung/berichte',
          count: stats.openReportsCount,
          icon: '📄',
        },
        {
          id: 'reports-analytics',
          label: 'Auswertungen',
          description: 'Kennzahlen und Statistiken',
          route: '/beratung/auswertungen',
          icon: '📈',
        },
        {
          id: 'reports-settings',
          label: 'Einstellungen',
          description: 'Modul-Konfiguration',
          route: '/beratung/settings',
          icon: '⚙️',
        },
      ],
    },
  ];
}
