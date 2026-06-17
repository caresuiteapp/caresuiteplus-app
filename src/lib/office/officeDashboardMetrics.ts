import type { DashboardActivity, DashboardKpi } from '@/types/dashboard';
import type { WorkflowStatus } from '@/types/core/base';
import type { OfficeAuditEntry } from '@/lib/officeCore/auditLogService';
import { remoteStatusToWorkflow } from '@/lib/services/clients/clientStatusBridge';

export type OfficeDashboardMetrics = {
  activeClients: number;
  totalClients: number;
  clientsInIntake: number;
  activeEmployees: number;
  totalEmployees: number;
  openInvoices: number;
  draftInvoices: number;
  appointmentsToday: number;
  totalAppointments: number;
  tableAvailability: {
    clients: boolean;
    employees: boolean;
    invoices: boolean;
    appointments: boolean;
  };
};

export type ClientTimelineEventRow = {
  id: string;
  title: string;
  subtitle: string | null;
  icon: string;
  status: string;
  created_at: string;
  event_type: string;
};

const CLOSED_INVOICE_STATUSES = new Set(['paid', 'cancelled', 'written_off']);

export function emptyOfficeDashboardMetrics(): OfficeDashboardMetrics {
  return {
    activeClients: 0,
    totalClients: 0,
    clientsInIntake: 0,
    activeEmployees: 0,
    totalEmployees: 0,
    openInvoices: 0,
    draftInvoices: 0,
    appointmentsToday: 0,
    totalAppointments: 0,
    tableAvailability: {
      clients: false,
      employees: false,
      invoices: false,
      appointments: false,
    },
  };
}

export function isOpenInvoiceStatus(status: string): boolean {
  return !CLOSED_INVOICE_STATUSES.has(status);
}

export function getLocalDayBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function buildOfficeKpisFromMetrics(metrics: OfficeDashboardMetrics): DashboardKpi[] {
  const clientSubValue =
    metrics.totalClients > 0
      ? `${metrics.totalClients} gesamt`
      : metrics.tableAvailability.clients
        ? 'Noch keine Klient:innen'
        : 'Klient:innen nicht verfügbar';

  const employeeSubValue =
    metrics.totalEmployees > 0
      ? `${metrics.totalEmployees} im Team`
      : metrics.tableAvailability.employees
        ? 'Noch keine Mitarbeitende'
        : 'Mitarbeitende nicht verfügbar';

  const invoiceSubValue =
    metrics.openInvoices > 0 || metrics.draftInvoices > 0
      ? `${metrics.draftInvoices} Entwürfe`
      : metrics.tableAvailability.invoices
        ? 'Keine Rechnungen'
        : 'Rechnungen nicht verfügbar';

  const appointmentSubValue =
    metrics.appointmentsToday > 0
      ? `${metrics.totalAppointments} geplant`
      : metrics.tableAvailability.appointments
        ? 'Keine Termine'
        : 'Termine nicht verfügbar';

  return [
    {
      id: 'office-kpi-clients',
      label: 'Aktive Klient:innen',
      value: metrics.activeClients,
      subValue: clientSubValue,
      icon: '👥',
      accentColor: '#62F3FF',
      ...(metrics.clientsInIntake > 0
        ? { trend: 'up' as const, trendValue: `${metrics.clientsInIntake} in Aufnahme` }
        : {}),
    },
    {
      id: 'office-kpi-employees',
      label: 'Mitarbeitende',
      value: metrics.activeEmployees,
      subValue: employeeSubValue,
      icon: '👤',
      accentColor: '#FF9500',
    },
    {
      id: 'office-kpi-invoices',
      label: 'Offene Rechnungen',
      value: metrics.openInvoices,
      subValue: invoiceSubValue,
      icon: '🧾',
      accentColor: '#FFD166',
      trend: 'neutral',
    },
    {
      id: 'office-kpi-appointments',
      label: 'Termine heute',
      value: metrics.appointmentsToday,
      subValue: appointmentSubValue,
      icon: '📅',
      accentColor: '#7C5CFF',
    },
  ];
}

function mapAuditCategoryToType(category: string): DashboardActivity['type'] {
  switch (category) {
    case 'Klient':
      return 'client';
    case 'Dokument':
      return 'document';
    case 'Abrechnung':
      return 'invoice';
    case 'Modul':
      return 'employee';
    default:
      return 'system';
  }
}

export function mapAuditEntryToActivity(entry: OfficeAuditEntry): DashboardActivity {
  return {
    id: entry.id,
    icon: entry.icon,
    title: entry.action,
    subtitle: entry.detail,
    timestamp: entry.timestamp,
    type: mapAuditCategoryToType(entry.category),
  };
}

export function mapTimelineEventToActivity(row: ClientTimelineEventRow): DashboardActivity {
  const status = remoteStatusToWorkflow(row.status) as WorkflowStatus;
  return {
    id: `timeline:${row.id}`,
    icon: row.icon || '📋',
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    timestamp: row.created_at,
    status,
    type: row.event_type === 'dokument' ? 'document' : 'client',
  };
}

export function mergeDashboardActivities(
  auditEntries: OfficeAuditEntry[],
  timelineEvents: ClientTimelineEventRow[],
  limit = 10,
): DashboardActivity[] {
  const merged = [
    ...auditEntries.map(mapAuditEntryToActivity),
    ...timelineEvents.map(mapTimelineEventToActivity),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return merged.slice(0, limit);
}
