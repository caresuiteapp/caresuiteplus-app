import type { DashboardKpi, DashboardQuickAction } from '@/types/dashboard';
import type { CarePlanListItem, PflegeDashboardStats } from '@/types/modules/pflege';

export const PFLEGE_WORKSPACE_KPI_COUNT = 12;
export const PFLEGE_ACCENT = '#22C55E';

export type PflegeDashboardSection = {
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

export type PflegePriorityItem = {
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

/** Twelve ambulatory care workspace KPIs — not Zentrale or Stationär tiles. */
export function buildPflegeWorkspaceKpis(stats: PflegeDashboardStats): DashboardKpi[] {
  const accent = PFLEGE_ACCENT;
  const warn = '#F59E0B';

  return [
    {
      id: 'pflege-ws-kpi-visits-today',
      label: 'Tourstopps heute',
      value: stats.visitsToday,
      subValue: emptySubValue(stats.visitsToday, 'Keine Tourstopps erfasst', () => 'Ohne abgesagte Stopps und Touren'),
      icon: '📅',
      accentColor: accent,
      route: '/pflege/tourenplanung',
    },
    {
      id: 'pflege-ws-kpi-running',
      label: 'Tourstopps in Durchführung',
      value: stats.runningNow,
      subValue: emptySubValue(stats.runningNow, 'Kein heutiger Stopp mit diesem Status', () => 'Status der heutigen Stopps'),
      icon: '▶️',
      accentColor: stats.runningNow > 0 ? '#22C55E' : accent,
      route: '/pflege/tourenplanung',
    },
    {
      id: 'pflege-ws-kpi-active-plans',
      label: 'Aktive Pflegepläne',
      value: stats.activePlansCount,
      subValue:
        stats.unavailableKpiIds?.includes('pflege-ws-kpi-plan-total')
          ? 'Gesamtanzahl nicht ermittelt'
          : `${stats.totalPlans} Pflegepläne ohne Archiv`,
      icon: '📋',
      accentColor: accent,
      route: '/pflege/plans?status=aktiv',
    },
    {
      id: 'pflege-ws-kpi-due-measures',
      label: 'Evaluationstermine erreicht',
      value: stats.dueMeasuresCount,
      subValue: emptySubValue(stats.dueMeasuresCount, 'Kein erreichter Termin erfasst', () => 'Aktive Maßnahmen, Termin bis heute'),
      icon: '✅',
      accentColor: stats.dueMeasuresCount > 0 ? warn : accent,
      route: '/pflege/massnahmen?filter=due',
    },
    {
      id: 'pflege-ws-kpi-open-docs',
      label: 'Unsignierte Dokumentation',
      value: stats.openDocumentationCount,
      subValue: emptySubValue(stats.openDocumentationCount, 'Keine unsignierten Einträge', () => 'Einträge mit Status unsigniert'),
      icon: '📝',
      accentColor: stats.openDocumentationCount > 0 ? warn : accent,
      route: '/pflege/dokumentation',
    },
    {
      id: 'pflege-ws-kpi-due-vitals',
      label: 'Vitalwerte fällig',
      value: stats.dueVitalsCount,
      subValue: emptySubValue(stats.dueVitalsCount, 'Keine fällig', (n) => `${n} Messung(en)`),
      icon: '❤️',
      accentColor: stats.dueVitalsCount > 0 ? warn : accent,
      route: '/pflege/vitalwerte',
    },
    {
      id: 'pflege-ws-kpi-abnormal-vitals',
      label: 'Gespeicherte Grenzwertmarkierungen',
      value: stats.abnormalVitalsCount,
      subValue: emptySubValue(stats.abnormalVitalsCount, 'Keine solche Markierung erfasst', () => 'Außerhalb hinterlegter Grenzen gespeichert'),
      icon: '⚠️',
      accentColor: stats.abnormalVitalsCount > 0 ? warn : accent,
      route: '/pflege/vitalwerte',
    },
    {
      id: 'pflege-ws-kpi-medication',
      label: 'Medikation offen',
      value: stats.openMedicationCount,
      subValue: emptySubValue(stats.openMedicationCount, 'Keine offenen Verordnungen', (n) => `${n} offen`),
      icon: '💊',
      accentColor: stats.openMedicationCount > 0 ? warn : accent,
      route: '/pflege/medikation',
    },
    {
      id: 'pflege-ws-kpi-wounds',
      label: 'Offene Wundfälle',
      value: stats.openWoundDocsCount,
      subValue: emptySubValue(stats.openWoundDocsCount, 'Keine offenen Wundfälle', (n) => `${n} offen`),
      icon: '🩹',
      accentColor: stats.openWoundDocsCount > 0 ? warn : accent,
      route: '/pflege/wunddokumentation?status=open',
    },
    {
      id: 'pflege-ws-kpi-handovers',
      label: 'Übergaben offen',
      value: stats.openHandoversCount,
      subValue: emptySubValue(stats.openHandoversCount, 'Keine offenen Übergaben', (n) => `${n} offen`),
      icon: '🔄',
      accentColor: stats.openHandoversCount > 0 ? warn : accent,
      route: '/pflege/uebergaben?status=open',
    },
    {
      id: 'pflege-ws-kpi-sis',
      label: 'SIS/Assessment offen',
      value: stats.openSisAssessmentCount,
      subValue: emptySubValue(stats.openSisAssessmentCount, 'Keine offenen Assessments', (n) => `${n} offen`),
      icon: '📊',
      accentColor: stats.openSisAssessmentCount > 0 ? warn : accent,
      route: '/pflege/sis?status=open',
    },
    {
      id: 'pflege-ws-kpi-reports',
      label: 'Unsignierte Pflegeberichte',
      value: stats.openReportsCount,
      subValue: emptySubValue(stats.openReportsCount, 'Keine unsignierten Pflegeberichte', () => 'Pflegeberichte mit Status unsigniert'),
      icon: '📄',
      accentColor: stats.openReportsCount > 0 ? warn : accent,
      route: '/pflege/berichte',
    },
  ].map((kpi) => stats.unavailableKpiIds?.includes(kpi.id) ? { ...kpi, value: '—', subValue: 'Nicht ermittelt', accentColor: accent } : kpi);
}

export const PFLEGE_HEADER_PRIMARY_ACTIONS: DashboardQuickAction[] = [
  {
    id: 'pflege-header-visit',
    label: 'Pflegeeinsatz planen',
    icon: '➕',
    route: '/pflege/planung/new',
    variant: 'primary',
  },
  {
    id: 'pflege-header-documentation',
    label: 'Pflegedokumentation',
    icon: '➕',
    route: '/pflege/dokumentation?create=1',
    variant: 'primary',
  },
];

export const PFLEGE_HEADER_SECONDARY_ACTIONS: DashboardQuickAction[] = [
  {
    id: 'pflege-header-plans',
    label: 'Pflegepläne öffnen',
    icon: '📋',
    route: '/pflege/plans',
    variant: 'secondary',
  },
  {
    id: 'pflege-header-vitals',
    label: 'Vitalwerte erfassen',
    icon: '❤️',
    route: '/pflege/vitalwerte/create',
    variant: 'secondary',
  },
  {
    id: 'pflege-header-handover',
    label: 'Übergabe schreiben',
    icon: '🔄',
    route: '/pflege/uebergaben?create=1',
    variant: 'secondary',
  },
];

export const PFLEGE_SIDEBAR_QUICK_ACTIONS: DashboardQuickAction[] = [
  { id: 'pflege-qa-visit', label: 'Pflegeeinsatz planen', icon: '📅', route: '/pflege/planung/new' },
  { id: 'pflege-qa-doc', label: 'Pflegedokumentation', icon: '📝', route: '/pflege/dokumentation?create=1' },
  { id: 'pflege-qa-vital', label: 'Vitalwert erfassen', icon: '❤️', route: '/pflege/vitalwerte/create' },
  { id: 'pflege-qa-measure', label: 'Maßnahme dokumentieren', icon: '✅', route: '/pflege/massnahmen?create=1' },
  { id: 'pflege-qa-handover', label: 'Übergabe schreiben', icon: '🔄', route: '/pflege/uebergaben?create=1' },
  { id: 'pflege-qa-plan', label: 'Pflegeplan erstellen', icon: '📋', route: '/pflege/plans/create' },
  { id: 'pflege-qa-wound', label: 'Wunddoku', icon: '🩹', route: '/pflege/wunddokumentation?create=1' },
  { id: 'pflege-qa-sis', label: 'SIS starten', icon: '📊', route: '/pflege/sis/new' },
];

export const PFLEGE_QUICK_ACCESS: DashboardQuickAction[] = [
  { id: 'pflege-qa-calendar', label: 'Kalender', icon: '📅', route: '/pflege/calendar' },
  { id: 'pflege-qa-plans', label: 'Pflegepläne', icon: '📋', route: '/pflege/plans' },
  { id: 'pflege-qa-docs', label: 'Dokumentation', icon: '📝', route: '/pflege/dokumentation' },
  { id: 'pflege-qa-vitals', label: 'Vitalwerte', icon: '❤️', route: '/pflege/vitalwerte' },
  { id: 'pflege-qa-medication', label: 'Medikation', icon: '💊', route: '/pflege/medikation' },
  { id: 'pflege-qa-wounds', label: 'Wunddoku', icon: '🩹', route: '/pflege/wunddokumentation' },
  { id: 'pflege-qa-sis', label: 'SIS / Assessment', icon: '📊', route: '/pflege/sis' },
  { id: 'pflege-qa-diagnoses', label: 'Diagnosen', icon: '🩺', route: '/pflege/diagnosen' },
  { id: 'pflege-qa-orders', label: 'Verordnungen', icon: '📃', route: '/pflege/verordnungen' },
  { id: 'pflege-qa-shifts', label: 'Dienstpläne', icon: '🗓️', route: '/pflege/dienstplaene' },
];

export function buildPflegeDashboardPriorities(stats: PflegeDashboardStats): PflegePriorityItem[] {
  const summaries = [
    { field: 'dueMeasuresCount', kpiId: 'pflege-ws-kpi-due-measures', id: 'priority-due-measures', label: 'Evaluationstermine erreicht',
      description: 'Aktive Maßnahmen mit einem hinterlegten Termin bis heute.', route: '/pflege/massnahmen?filter=due' },
    { field: 'openDocumentationCount', kpiId: 'pflege-ws-kpi-open-docs', id: 'priority-open-docs', label: 'Unsignierte Dokumentation',
      description: 'Einträge mit dem gespeicherten Status unsigniert.', route: '/pflege/dokumentation' },
    { field: 'openHandoversCount', kpiId: 'pflege-ws-kpi-handovers', id: 'priority-handovers', label: 'Übergaben offen',
      description: 'Übergaben mit dem gespeicherten Status offen.', route: '/pflege/uebergaben' },
    { field: 'openSisAssessmentCount', kpiId: 'pflege-ws-kpi-sis', id: 'priority-sis', label: 'SIS/Assessment offen',
      description: 'Entwürfe und Assessments in Bearbeitung oder fachlicher Prüfung.', route: '/pflege/sis' },
  ] as const;
  return summaries.flatMap(({ field, kpiId, ...summary }) => stats.unavailableKpiIds?.includes(kpiId) || stats[field] <= 0
    ? [] : [{ ...summary, severity: 'medium' as const, count: stats[field] }]);
}

function visibleCount(stats: PflegeDashboardStats, value: number, kpiId: string): number | undefined {
  return stats.unavailableKpiIds?.includes(kpiId) ? undefined : value;
}

export function buildPflegeDashboardSections(
  stats: PflegeDashboardStats,
  activePlans: CarePlanListItem[],
): PflegeDashboardSection[] {
  return [
    {
      id: 'visits',
      title: 'Pflegeeinsätze & Dienstplanung',
      subtitle: 'Heutige Einsätze, Schichten und Planung',
      links: [
        {
          id: 'visits-calendar',
          label: 'Kalender',
          description: 'Tages- und Wochenübersicht',
          route: '/pflege/calendar',
          count: visibleCount(stats, stats.visitsToday, 'pflege-ws-kpi-visits-today'),
          icon: '📅',
        },
        {
          id: 'visits-shifts',
          label: 'Dienstpläne',
          description: 'Schichtplanung und Einsätze',
          route: '/pflege/dienstplaene',
          icon: '🗓️',
        },
        {
          id: 'visits-planning',
          label: 'Pflegeeinsatz planen',
          description: 'Neuen Einsatz anlegen',
          route: '/pflege/planung/new',
          icon: '➕',
        },
      ],
    },
    {
      id: 'plans',
      title: 'Pflegepläne & Maßnahmen',
      subtitle: 'Aktive Pläne, Maßnahmen und Fälligkeiten',
      links: [
        {
          id: 'plans-list',
          label: 'Pflegepläne',
          description: 'Suche, Filter und Status',
          route: '/pflege/plans',
          count: visibleCount(stats, stats.activePlansCount, 'pflege-ws-kpi-active-plans'),
          icon: '📋',
        },
        {
          id: 'plans-measures',
          label: 'Maßnahmen',
          description: 'Fällige und geplante Maßnahmen',
          route: '/pflege/massnahmen',
          count: visibleCount(stats, stats.dueMeasuresCount, 'pflege-ws-kpi-due-measures'),
          icon: '✅',
        },
        {
          id: 'plans-create',
          label: 'Pflegeplan erstellen',
          description: 'Neuen Pflegeplan anlegen',
          route: '/pflege/plans/create',
          icon: '➕',
        },
      ],
    },
    {
      id: 'documentation',
      title: 'Dokumentation',
      subtitle: 'Pflegedokumentation und Nachweise',
      links: [
        {
          id: 'docs-list',
          label: 'Pflegedokumentation',
          description: 'Nachweise und Signaturen',
          route: '/pflege/dokumentation',
          count: visibleCount(stats, stats.openDocumentationCount, 'pflege-ws-kpi-open-docs'),
          icon: '📝',
        },
        {
          id: 'docs-create',
          label: 'Dokumentation erfassen',
          description: 'Neuen Pflegenachweis anlegen',
          route: '/pflege/dokumentation?create=1',
          icon: '➕',
        },
      ],
    },
    {
      id: 'vitals',
      title: 'Vitalwerte',
      subtitle: 'Messungen, Fälligkeiten und Warnungen',
      links: [
        {
          id: 'vitals-list',
          label: 'Vitalwerte',
          description: 'Alle Messungen und Verläufe',
          route: '/pflege/vitalwerte',
          count: visibleCount(stats, stats.dueVitalsCount, 'pflege-ws-kpi-due-vitals'),
          icon: '❤️',
        },
        {
          id: 'vitals-alerts',
          label: 'Auffällige Werte',
          description: 'Warnungen und Grenzwertüberschreitungen',
          route: '/pflege/vitalwerte?filter=alert',
          count: visibleCount(stats, stats.abnormalVitalsCount, 'pflege-ws-kpi-abnormal-vitals'),
          icon: '⚠️',
        },
        {
          id: 'vitals-create',
          label: 'Vitalwert erfassen',
          description: 'Neue Messung dokumentieren',
          route: '/pflege/vitalwerte/create',
          icon: '➕',
        },
      ],
    },
    {
      id: 'medication',
      title: 'Medikation',
      subtitle: 'Verordnungen und Einnahmezeiten',
      links: [
        {
          id: 'med-list',
          label: 'Medikation',
          description: 'Verordnungen und Pläne',
          route: '/pflege/medikation',
          count: visibleCount(stats, stats.openMedicationCount, 'pflege-ws-kpi-medication'),
          icon: '💊',
        },
        {
          id: 'med-create',
          label: 'Verordnung erfassen',
          description: 'Neue Medikation dokumentieren',
          route: '/pflege/medikation/new',
          icon: '➕',
        },
      ],
    },
    {
      id: 'wounds',
      title: 'Wunddokumentation',
      subtitle: 'Wundfälle und Verlauf',
      links: [
        {
          id: 'wound-list',
          label: 'Wunddokumentation',
          description: 'Offene und abgeschlossene Wundfälle',
          route: '/pflege/wunddokumentation',
          count: visibleCount(stats, stats.openWoundDocsCount, 'pflege-ws-kpi-wounds'),
          icon: '🩹',
        },
        {
          id: 'wound-create',
          label: 'Wunddoku starten',
          description: 'Neuen Wundfall anlegen',
          route: '/pflege/wunddokumentation?create=1',
          icon: '➕',
        },
      ],
    },
    {
      id: 'sis',
      title: 'SIS & Assessment',
      subtitle: 'Strukturierte Informationssammlung',
      links: [
        {
          id: 'sis-list',
          label: 'SIS / Assessment',
          description: 'Assessments und Prüffristen',
          route: '/pflege/sis',
          count: visibleCount(stats, stats.openSisAssessmentCount, 'pflege-ws-kpi-sis'),
          icon: '📊',
        },
        {
          id: 'sis-create',
          label: 'SIS starten',
          description: 'Neues Assessment beginnen',
          route: '/pflege/sis/new',
          icon: '➕',
        },
      ],
    },
    {
      id: 'reports',
      title: 'Berichte & Übergaben',
      subtitle: 'Berichte, Übergaben und Auswertungen',
      links: [
        {
          id: 'reports-list',
          label: 'Berichte',
          description: 'Pflegeberichte und Entwürfe',
          route: '/pflege/berichte',
          count: visibleCount(stats, stats.openReportsCount, 'pflege-ws-kpi-reports'),
          icon: '📄',
        },
        {
          id: 'reports-handovers',
          label: 'Übergaben',
          description: 'Schicht- und Teamübergaben',
          route: '/pflege/uebergaben',
          count: visibleCount(stats, stats.openHandoversCount, 'pflege-ws-kpi-handovers'),
          icon: '🔄',
        },
        {
          id: 'reports-analytics',
          label: 'Auswertungen',
          description: 'KPIs und Kennzahlen',
          route: '/pflege/auswertungen',
          icon: '📈',
        },
      ],
    },
    {
      id: 'clients',
      title: 'Zugeordnete Klient:innen',
      subtitle: 'Ihre Klient:innen im ambulanten Pflegedienst',
      links: [
        {
          id: 'clients-assigned',
          label: 'Zugeordnete Klient:innen',
          description: 'Liste und Pflegekontext',
          route: '/pflege/zugeordnete-klienten',
          count: visibleCount(stats, stats.assignedClientsCount, 'pflege-ws-kpi-client-assignment'),
          icon: '👥',
        },
        ...(activePlans.slice(0, 3).map((plan) => ({
          id: `client-plan-${plan.id}`,
          label: plan.clientName || plan.title,
          description: plan.title,
          route: `/pflege/plans/${plan.id}`,
          icon: '👤' as const,
        })) ?? []),
      ],
    },
  ];
}
