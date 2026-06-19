import { OFFICE_NAV_AREAS, type OfficeNavArea } from '@/lib/navigation/officeNavigation';
import type { OfficeDashboardMetrics } from '@/lib/office/officeDashboardMetrics';

export type OfficeAreaShortcut = OfficeNavArea & {
  /** Alias for dashboard list rows that expect `title`. */
  title: string;
  /** Alias for dashboard list rows that expect `route`. */
  route: string;
  count?: number;
};

export function buildOfficeAreaShortcuts(
  counts: Partial<Record<string, number>>,
): OfficeAreaShortcut[] {
  return OFFICE_NAV_AREAS.map((area) => ({
    ...area,
    title: area.label,
    route: area.href,
    count: counts[area.id],
  }));
}

export function buildOfficeAreaShortcutsFromMetrics(
  metrics: OfficeDashboardMetrics,
): OfficeAreaShortcut[] {
  const counts: Partial<Record<string, number>> = {};

  if (metrics.tableAvailability.clients) {
    counts.clients = metrics.totalClients;
  }
  if (metrics.tableAvailability.employees) {
    counts.employees = metrics.totalEmployees;
  }
  if (metrics.tableAvailability.invoices) {
    counts.invoices = metrics.totalInvoices;
  }
  if (metrics.tableAvailability.appointments) {
    counts.appointments = metrics.totalAppointments;
  }

  return buildOfficeAreaShortcuts(counts);
}
