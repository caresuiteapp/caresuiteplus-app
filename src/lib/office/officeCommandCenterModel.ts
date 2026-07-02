import type {
  DashboardSnapshot,
  DashboardStatusCard,
  OfficeCommandCenterReadMetrics,
} from '@/types/dashboard';
import type { OfficeDashboardMetrics } from '@/lib/office/officeDashboardMetrics';
import { getVisibleNavItemsForRole } from '@/components/healthos/navigation/resolveHealthOSNavigation';

export type OfficeCommandCenterMetric = {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  icon: string;
  route?: string;
  emptyHint?: string;
};

export type OfficeCommandCenterLink = {
  id: string;
  label: string;
  description?: string;
  route: string;
  count?: number;
  icon?: string;
};

export type OfficeCommandCenterBlockerRow = {
  id: string;
  label: string;
  count?: number;
  route?: string;
};

export type OfficeCommandCenterModel = {
  greetingLine: string;
  operationsToday: OfficeCommandCenterMetric[];
  qualityBlockers: OfficeCommandCenterBlockerRow[];
  budgetSummary: OfficeCommandCenterMetric[];
  workforceSummary: OfficeCommandCenterMetric[];
  proofDocuments: OfficeCommandCenterMetric[];
  quickAccess: OfficeCommandCenterLink[];
  statusCards: DashboardStatusCard[];
};

function statusCardRouteFromId(cardId: string): string {
  if (cardId.includes('clients') || cardId.includes('intake')) return '/office/clients?status=in_bearbeitung';
  if (cardId.includes('invoice') || cardId.includes('billing')) return '/office/billing-preparation';
  if (cardId.includes('modules')) return '/business/office/modules';
  return '/business/office/qm';
}

export function pickOfficeCommandCenterReadMetrics(
  metrics: OfficeDashboardMetrics,
): OfficeCommandCenterReadMetrics {
  return {
    assignmentsToday: metrics.assignmentsToday,
    appointmentsToday: metrics.appointmentsToday,
    executionBlockers: metrics.executionBlockers,
    budgetWarnings: metrics.budgetWarnings,
    openServiceRecords: metrics.openServiceRecords,
    documentsForReview: metrics.documentsForReview,
    draftInvoices: metrics.draftInvoices,
    openInvoices: metrics.openInvoices,
    activeEmployees: metrics.activeEmployees,
    openTasks: metrics.openTasks,
    overdueTasks: metrics.overdueTasks,
    tableAvailability: {
      assignments: metrics.tableAvailability.assignments,
      budgets: metrics.tableAvailability.budgets,
      serviceRecords: metrics.tableAvailability.serviceRecords,
      documents: metrics.tableAvailability.documents,
      invoices: metrics.tableAvailability.invoices,
      employees: metrics.tableAvailability.employees,
      appointments: metrics.tableAvailability.appointments,
    },
  };
}

function metricSubValue(
  available: boolean,
  label: string,
  emptyLabel: string,
  value: number,
): string {
  if (!available) return `${label} nicht verfügbar`;
  if (value === 0) return emptyLabel;
  return `${value} offen`;
}

function emptyReadMetrics(): OfficeCommandCenterReadMetrics {
  return {
    assignmentsToday: 0,
    appointmentsToday: 0,
    executionBlockers: 0,
    budgetWarnings: 0,
    openServiceRecords: 0,
    documentsForReview: 0,
    draftInvoices: 0,
    openInvoices: 0,
    activeEmployees: 0,
    openTasks: 0,
    overdueTasks: 0,
    tableAvailability: {
      assignments: false,
      budgets: false,
      serviceRecords: false,
      documents: false,
      invoices: false,
      employees: false,
      appointments: false,
    },
  };
}

export function buildOfficeCommandCenterModel(
  snapshot: DashboardSnapshot,
  displayName: string,
): OfficeCommandCenterModel {
  const metrics = snapshot.officeReadMetrics ?? emptyReadMetrics();
  const ta = metrics.tableAvailability;

  const operationsToday: OfficeCommandCenterMetric[] = [
    {
      id: 'ops-assignments-today',
      label: 'Einsätze heute',
      value: metrics.assignmentsToday,
      subValue: metricSubValue(ta.assignments, 'Einsätze', 'Keine Einsätze heute', metrics.assignmentsToday),
      icon: '📋',
      route: '/office/calendar',
    },
    {
      id: 'ops-appointments-today',
      label: 'Termine heute',
      value: metrics.appointmentsToday,
      subValue: metricSubValue(ta.appointments, 'Termine', 'Keine Termine heute', metrics.appointmentsToday),
      icon: '📅',
      route: '/office/appointments?date=today',
    },
    {
      id: 'ops-blocked',
      label: 'Blockierte Einsätze',
      value: metrics.executionBlockers,
      subValue:
        metrics.executionBlockers === 0
          ? 'Keine Blocker'
          : `${metrics.executionBlockers} Vorgang${metrics.executionBlockers === 1 ? '' : 'e'}`,
      icon: '⛔',
      route: '/business/office/qm',
    },
    {
      id: 'ops-open-docs',
      label: 'Offene Dokumentation',
      value: metrics.openServiceRecords,
      subValue: metricSubValue(
        ta.serviceRecords,
        'Nachweise',
        'Keine offene Dokumentation',
        metrics.openServiceRecords,
      ),
      icon: '📝',
      route: '/office/billing-preparation',
    },
    {
      id: 'ops-documents-review',
      label: 'Dokumente zur Prüfung',
      value: metrics.documentsForReview,
      subValue: metricSubValue(
        ta.documents,
        'Dokumente',
        'Keine Dokumente zur Prüfung',
        metrics.documentsForReview,
      ),
      icon: '📁',
      route: '/office/documents?status=pending',
    },
    {
      id: 'ops-proof-open',
      label: 'Offene Nachweise',
      value: metrics.openServiceRecords + metrics.draftInvoices,
      subValue:
        metrics.openServiceRecords + metrics.draftInvoices === 0
          ? 'Keine offenen Nachweise'
          : `${metrics.openServiceRecords} Nachweise · ${metrics.draftInvoices} Entwürfe`,
      icon: '🧾',
      route: '/office/billing-preparation',
    },
  ];

  const qualityBlockers: OfficeCommandCenterBlockerRow[] = [];
  if (metrics.executionBlockers > 0) {
    qualityBlockers.push({
      id: 'blocker-aggregate',
      label: 'Offene Einsatz-Blocker',
      count: metrics.executionBlockers,
      route: '/business/office/qm',
    });
  }
  for (const card of snapshot.statusCards) {
    if (card.id === 'office-sc-execution-blockers') continue;
    qualityBlockers.push({
      id: card.id,
      label: card.title,
      count: card.count,
      route: statusCardRouteFromId(card.id),
    });
  }

  const budgetSummary: OfficeCommandCenterMetric[] = [
    {
      id: 'budget-warnings',
      label: 'Budget-Warnungen',
      value: metrics.budgetWarnings,
      subValue: metricSubValue(
        ta.budgets,
        'Budgets',
        'Keine kritischen Budgets',
        metrics.budgetWarnings,
      ),
      icon: '💰',
      route: '/office/clients',
      emptyHint: 'Verbrauch über 80 % — Details in der Klient:innenakte',
    },
    {
      id: 'budget-open-invoices',
      label: 'Offene Abrechnungsfälle',
      value: metrics.openInvoices,
      subValue: metricSubValue(ta.invoices, 'Abrechnung', 'Keine offenen Fälle', metrics.openInvoices),
      icon: '🧾',
      route: '/office/billing-preparation',
    },
    {
      id: 'budget-drafts',
      label: 'Entwürfe zur Prüfung',
      value: metrics.draftInvoices,
      subValue: metricSubValue(ta.invoices, 'Entwürfe', 'Keine Entwürfe', metrics.draftInvoices),
      icon: '📋',
      route: '/office/billing-preparation',
    },
  ];

  const workforceSummary: OfficeCommandCenterMetric[] = [
    {
      id: 'wfm-active-staff',
      label: 'Aktive Mitarbeitende',
      value: metrics.activeEmployees,
      subValue: ta.employees
        ? `${metrics.activeEmployees} im Dienstplan sichtbar`
        : 'Mitarbeitende nicht verfügbar',
      icon: '👤',
      route: '/office/employees?status=aktiv',
    },
    {
      id: 'wfm-time-account',
      label: 'Zeitkonto / WFM',
      value: '—',
      subValue: 'Zusammenfassung unter Arbeitszeit öffnen',
      icon: '⏱️',
      route: '/business/office/time-tracking',
      emptyHint: 'Keine aggregierte WFM-Übersicht im Command Center',
    },
  ];

  const proofDocuments: OfficeCommandCenterMetric[] = [
    {
      id: 'proof-service-records',
      label: 'Nachweise in Prüfung',
      value: metrics.openServiceRecords,
      subValue: metricSubValue(ta.serviceRecords, 'Nachweise', 'Keine offenen Nachweise', metrics.openServiceRecords),
      icon: '📝',
      route: '/assist/nachweise',
    },
    {
      id: 'proof-documents',
      label: 'Dokumente zur Freigabe',
      value: metrics.documentsForReview,
      subValue: metricSubValue(
        ta.documents,
        'Dokumente',
        'Keine Dokumente warten auf Freigabe',
        metrics.documentsForReview,
      ),
      icon: '📄',
      route: '/office/documents?status=pending',
    },
    {
      id: 'proof-portal',
      label: 'Portal-Anfragen',
      value: snapshot.kpis.find((k) => k.id === 'office-ws-kpi-portal')?.value ?? 0,
      subValue: 'Freigaben und Sichtbarkeit im Klient:innenportal',
      icon: '🔐',
      route: '/business/office/access/client-portal',
    },
  ];

  const quickAccess: OfficeCommandCenterLink[] = getVisibleNavItemsForRole('office')
    .filter((item) => item.href)
    .map((item) => ({
      id: item.key,
      label: item.label,
      route: item.href!,
      icon: item.icon,
    }));

  return {
    greetingLine: `${snapshot.greeting}, ${displayName}`,
    operationsToday,
    qualityBlockers,
    budgetSummary,
    workforceSummary,
    proofDocuments,
    quickAccess,
    statusCards: snapshot.statusCards,
  };
}
