import type {
  PdlCockpitSnapshot,
  PdlOpenTask,
  PdlRisk,
  ReportDetail,
  ReportListItem,
} from '@/types/reporting';
import type { DashboardKpi } from '@/types/dashboard';
import { DEMO_TENANT_ID } from './tenant';

export const REPORTING_DEMO_TENANT = DEMO_TENANT_ID;

const BASE = '2026-06-12T08:00:00.000Z';

const PDL_KPIS: DashboardKpi[] = [
  {
    id: 'pdl-kpi-coverage',
    label: 'Einsatzabdeckung',
    value: '94%',
    subValue: 'Diese Woche',
    icon: '📅',
    accentColor: '#62F3FF',
    trend: 'up',
    trendValue: '+3%',
  },
  {
    id: 'pdl-kpi-open-tasks',
    label: 'Offene PDL-Aufgaben',
    value: 7,
    subValue: '2 überfällig',
    icon: '📋',
    accentColor: '#FF9500',
    trend: 'down',
    trendValue: '-2',
  },
  {
    id: 'pdl-kpi-quality',
    label: 'Qualitätsindikatoren',
    value: '4,6',
    subValue: 'Ø Bewertung',
    icon: '⭐',
    accentColor: '#34C759',
    trend: 'neutral',
  },
  {
    id: 'pdl-kpi-risks',
    label: 'Aktive Risiken',
    value: 3,
    subValue: '1 kritisch',
    icon: '⚠️',
    accentColor: '#FF3B30',
    trend: 'neutral',
  },
];

const OPEN_TASKS: PdlOpenTask[] = [
  {
    id: 'task-001',
    title: 'Pflegeplan-Review Klient:in Hoffmann',
    priority: 'high',
    dueDate: '2026-06-13',
    assignee: 'Dr. Anna Krüger',
  },
  {
    id: 'task-002',
    title: 'Einsatzlücke Freitag Nachmittag',
    priority: 'high',
    dueDate: '2026-06-14',
    assignee: 'Markus Vogel',
  },
  {
    id: 'task-003',
    title: 'Qualitätsaudit Q2 vorbereiten',
    priority: 'medium',
    dueDate: '2026-06-20',
    assignee: 'Sabine Muster',
  },
];

const RISKS: PdlRisk[] = [
  {
    id: 'risk-001',
    label: 'Unterbesetzung Assist-Team',
    severity: 'critical',
    hint: '2 offene Schichten in KW 24',
  },
  {
    id: 'risk-002',
    label: 'Überfällige Dokumentation',
    severity: 'warning',
    hint: '5 Nachweise > 48h offen',
  },
  {
    id: 'risk-003',
    label: 'Budgetwarnung Entlastung',
    severity: 'info',
    hint: 'Klient:in Wagner bei 85% Auslastung',
  },
];

/** WP511 — Demo-Daten Reporting */
export const demoReportList: ReportListItem[] = [
  {
    id: 'report-001',
    tenantId: DEMO_TENANT_ID,
    title: 'PDL-Wochenbericht KW 24',
    category: 'pdl',
    period: '2026-06-09 – 2026-06-15',
    status: 'aktiv',
    updatedAt: BASE,
  },
  {
    id: 'report-002',
    tenantId: DEMO_TENANT_ID,
    title: 'Qualitätskennzahlen Mai',
    category: 'quality',
    period: 'Mai 2026',
    status: 'abgeschlossen',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'report-003',
    tenantId: DEMO_TENANT_ID,
    title: 'Abrechnungsübersicht Q2',
    category: 'finance',
    period: 'Q2 2026',
    status: 'in_bearbeitung',
    updatedAt: BASE,
  },
];

export function getDemoPdlCockpit(): PdlCockpitSnapshot {
  return {
    tenantId: DEMO_TENANT_ID,
    kpis: PDL_KPIS,
    openTasks: OPEN_TASKS,
    risks: RISKS,
    generatedAt: BASE,
  };
}

export function getDemoReportDetail(id: string): ReportDetail | null {
  const item = demoReportList.find((r) => r.id === id);
  if (!item) return null;
  return {
    ...item,
    summary:
      'Demo-Bericht mit aggregierten KPIs aus Einsatzplanung, Qualität und Abrechnung. Daten stammen aus dem Mandanten-Store.',
    kpiSnapshot: PDL_KPIS.slice(0, 2),
  };
}
