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
  const danger = '#EF4444';

  return [
    {
      id: 'pflege-ws-kpi-visits-today',
      label: 'Pflegeeinsätze heute',
      value: stats.visitsToday,
      subValue: emptySubValue(stats.visitsToday, 'Keine Einsätze heute', (n) => `${n} geplant`),
      icon: '📅',
      accentColor: accent,
      route: '/pflege/calendar?date=today',
    },
    {
      id: 'pflege-ws-kpi-running',
      label: 'Läuft gerade',
      value: stats.runningNow,
      subValue: emptySubValue(stats.runningNow, 'Kein laufender Einsatz', (n) => `${n} in Durchführung`),
      icon: '▶️',
      accentColor: stats.runningNow > 0 ? '#22C55E' : accent,
      route: '/pflege/dienstplaene?status=running',
    },
    {
      id: 'pflege-ws-kpi-active-plans',
      label: 'Aktive Pflegepläne',
      value: stats.activePlansCount,
      subValue:
        stats.totalPlans > 0
          ? `${stats.totalPlans} gesamt`
          : 'Noch keine Pflegepläne',
      icon: '📋',
      accentColor: accent,
      route: '/pflege/plans?status=aktiv',
    },
    {
      id: 'pflege-ws-kpi-due-measures',
      label: 'Maßnahmen fällig',
      value: stats.dueMeasuresCount,
      subValue: emptySubValue(stats.dueMeasuresCount, 'Keine fälligen Maßnahmen', (n) => `${n} offen`),
      icon: '✅',
      accentColor: stats.dueMeasuresCount > 0 ? warn : accent,
      route: '/pflege/massnahmen?filter=due',
    },
    {
      id: 'pflege-ws-kpi-open-docs',
      label: 'Dokumentation offen',
      value: stats.openDocumentationCount,
      subValue: emptySubValue(stats.openDocumentationCount, 'Alles dokumentiert', (n) => `${n} offen`),
      icon: '📝',
      accentColor: stats.openDocumentationCount > 0 ? warn : accent,
      route: '/pflege/dokumentation?status=open',
    },
    {
      id: 'pflege-ws-kpi-due-vitals',
      label: 'Vitalwerte fällig',
      value: stats.dueVitalsCount,
      subValue: emptySubValue(stats.dueVitalsCount, 'Keine fällig', (n) => `${n} Messung(en)`),
      icon: '❤️',
      accentColor: stats.dueVitalsCount > 0 ? warn : accent,
      route: '/pflege/vitalwerte?filter=due',
    },
    {
      id: 'pflege-ws-kpi-abnormal-vitals',
      label: 'Auffällige Vitalwerte',
      value: stats.abnormalVitalsCount,
      subValue: emptySubValue(stats.abnormalVitalsCount, 'Keine Auffälligkeiten', (n) => `${n} prüfen`),
      icon: '⚠️',
      accentColor: stats.abnormalVitalsCount > 0 ? danger : accent,
      route: '/pflege/vitalwerte?filter=alert',
    },
    {
      id: 'pflege-ws-kpi-medication',
      label: 'Medikation offen',
      value: stats.openMedicationCount,
      subValue: emptySubValue(stats.openMedicationCount, 'Keine offenen Verordnungen', (n) => `${n} offen`),
      icon: '💊',
      accentColor: stats.openMedicationCount > 0 ? warn : accent,
      route: '/pflege/medikation?status=open',
    },
    {
      id: 'pflege-ws-kpi-wounds',
      label: 'Wunddoku offen',
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
      label: 'Berichte offen',
      value: stats.openReportsCount,
      subValue: emptySubValue(stats.openReportsCount, 'Keine offenen Berichte', (n) => `${n} offen`),
      icon: '📄',
      accentColor: stats.openReportsCount > 0 ? warn : accent,
      route: '/pflege/berichte?status=open',
    },
  ];
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
  { id: 'pflege-qa-shifts', label: 'Dienstpläne', icon: '🗓️', route: '/pflege/dienstplaene' },
];

export function buildPflegeDashboardPriorities(stats: PflegeDashboardStats): PflegePriorityItem[] {
  const items: PflegePriorityItem[] = [];

  if (stats.abnormalVitalsCount > 0) {
    items.push({
      id: 'priority-abnormal-vitals',
      label: 'Auffällige Vitalwerte',
      description: `${stats.abnormalVitalsCount} Messung(en) mit Warnung — bitte prüfen.`,
      route: '/pflege/vitalwerte?filter=alert',
      severity: 'high',
      count: stats.abnormalVitalsCount,
    });
  }
  if (stats.dueMeasuresCount > 0) {
    items.push({
      id: 'priority-due-measures',
      label: 'Maßnahmen fällig',
      description: `${stats.dueMeasuresCount} Maßnahme(n) sind heute fällig.`,
      route: '/pflege/massnahmen?filter=due',
      severity: 'high',
      count: stats.dueMeasuresCount,
    });
  }
  if (stats.openDocumentationCount > 0) {
    items.push({
      id: 'priority-open-docs',
      label: 'Dokumentation offen',
      description: `${stats.openDocumentationCount} Pflegedokumentation(en) warten auf Abschluss.`,
      route: '/pflege/dokumentation?status=open',
      severity: 'medium',
      count: stats.openDocumentationCount,
    });
  }
  if (stats.openHandoversCount > 0) {
    items.push({
      id: 'priority-handovers',
      label: 'Übergaben offen',
      description: `${stats.openHandoversCount} Übergabe(n) sind noch nicht abgeschlossen.`,
      route: '/pflege/uebergaben?status=open',
      severity: 'medium',
      count: stats.openHandoversCount,
    });
  }
  if (stats.openSisAssessmentCount > 0) {
    items.push({
      id: 'priority-sis',
      label: 'SIS/Assessment offen',
      description: `${stats.openSisAssessmentCount} Assessment(s) stehen aus.`,
      route: '/pflege/sis?status=open',
      severity: 'medium',
      count: stats.openSisAssessmentCount,
    });
  }
  if (stats.dueVitalsCount > 0) {
    items.push({
      id: 'priority-due-vitals',
      label: 'Vitalwerte fällig',
      description: `${stats.dueVitalsCount} Vitalmessung(en) sind fällig.`,
      route: '/pflege/vitalwerte?filter=due',
      severity: 'low',
      count: stats.dueVitalsCount,
    });
  }

  return items;
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
          count: stats.visitsToday,
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
          count: stats.activePlansCount,
          icon: '📋',
        },
        {
          id: 'plans-measures',
          label: 'Maßnahmen',
          description: 'Fällige und geplante Maßnahmen',
          route: '/pflege/massnahmen',
          count: stats.dueMeasuresCount,
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
          count: stats.openDocumentationCount,
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
          count: stats.dueVitalsCount,
          icon: '❤️',
        },
        {
          id: 'vitals-alerts',
          label: 'Auffällige Werte',
          description: 'Warnungen und Grenzwertüberschreitungen',
          route: '/pflege/vitalwerte?filter=alert',
          count: stats.abnormalVitalsCount,
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
          count: stats.openMedicationCount,
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
      subtitle: 'Wundfälle, BodyMap und Verlauf',
      links: [
        {
          id: 'wound-list',
          label: 'Wunddokumentation',
          description: 'Offene und abgeschlossene Wundfälle',
          route: '/pflege/wunddokumentation',
          count: stats.openWoundDocsCount,
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
          count: stats.openSisAssessmentCount,
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
          count: stats.openReportsCount,
          icon: '📄',
        },
        {
          id: 'reports-handovers',
          label: 'Übergaben',
          description: 'Schicht- und Teamübergaben',
          route: '/pflege/uebergaben',
          count: stats.openHandoversCount,
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
          count: stats.assignedClientsCount || activePlans.length,
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
