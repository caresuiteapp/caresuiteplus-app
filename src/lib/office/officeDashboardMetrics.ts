import type { DashboardActivity, DashboardKpi, DashboardStatusCard } from '@/types/dashboard';
import type { WorkflowStatus } from '@/types/core/base';
import type { OfficeAuditEntry } from '@/lib/officeCore/auditLogService';
import {
  buildZentraleKpisFromMetrics,
  emptyBusinessDashboardMetrics,
  type BusinessDashboardMetrics,
} from '@/lib/dashboard/businessDashboardMetrics';
import { remoteStatusToWorkflow } from '@/lib/services/clients/clientStatusBridge';

export type OfficeDashboardMetrics = BusinessDashboardMetrics;

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
  return emptyBusinessDashboardMetrics();
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

export function getLocalWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function getThirtyDaysAgoIso(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}

export function buildOfficeKpisFromMetrics(metrics: OfficeDashboardMetrics): DashboardKpi[] {
  return buildZentraleKpisFromMetrics(metrics, 'office-kpi');
}

export function buildOfficeStatusCardsFromMetrics(
  metrics: OfficeDashboardMetrics,
): DashboardStatusCard[] {
  const cards: DashboardStatusCard[] = [];

  if (metrics.tableAvailability.invoices && metrics.draftInvoices > 0) {
    cards.push({
      id: 'office-sc-billing-prep',
      title: 'Abrechnung vorbereiten',
      description: 'Entwürfe und Nachweise prüfen — keine finale Rechnung',
      status: 'entwurf',
      count: metrics.draftInvoices,
    });
  }

  if (metrics.tableAvailability.clients && metrics.clientsInIntake > 0) {
    cards.push({
      id: 'office-sc-clients',
      title: 'Klient:innen in Aufnahme',
      description: 'Stammdaten und Modulzuordnung prüfen',
      status: 'in_bearbeitung',
      count: metrics.clientsInIntake,
      sensitivity: 'care',
    });
  }

  if (metrics.tableAvailability.invoices && metrics.openInvoices > 0) {
    cards.push({
      id: 'office-sc-open-billing',
      title: 'Offene Abrechnungsfälle',
      description: 'Fälle warten auf Prüfung oder Abschluss',
      status: 'aktiv',
      count: metrics.openInvoices,
    });
  }

  return cards;
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
