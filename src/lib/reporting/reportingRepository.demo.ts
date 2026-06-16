import type { ServiceResult } from '@/types';
import type { ReportingDateRange, ReportingMetricsRawBundle } from '@/types/reporting/metrics';
import { getDemoAssignmentListItems, isAssignmentToday } from '@/data/demo/assistAssignments';
import { demoClients } from '@/data/demo/clients';
import { demoEmployees } from '@/data/demo/employees';
import { demoInvoices } from '@/data/demo/invoices';
import { demoBudgets } from '@/data/demo/budgets';
import {
  DEMO_TABLE_AVAILABILITY,
  getDemoAssignmentDocStates,
  getDemoBillableItems,
  getDemoServiceRecords,
} from '@/data/demo/reportingMetricsDemo';
import { LIVE_MONITOR_STORE } from '@/lib/assist/liveMonitorStore';
import { isIsoInReportingRange } from '@/lib/reporting/reportingDateRangeUtils';

function inRange(iso: string, range: ReportingDateRange): boolean {
  return isIsoInReportingRange(iso, range);
}

function mapAssignmentStatus(status: string): 'planned' | 'started' | 'completed' | 'cancelled' {
  if (status === 'abgeschlossen') return 'completed';
  if (status === 'fehlerhaft' || status === 'archiviert') return 'cancelled';
  if (status === 'in_bearbeitung' || status === 'aktiv') return 'started';
  return 'planned';
}

export function buildDemoReportingMetricsBundle(
  tenantId: string,
  dateRange: ReportingDateRange,
): ReportingMetricsRawBundle {
  const assignments = getDemoAssignmentListItems().filter(
    (a) => a.tenantId === tenantId && inRange(a.scheduledStart, dateRange),
  );
  const allAssignments = getDemoAssignmentListItems().filter((a) => a.tenantId === tenantId);

  const docStates = getDemoAssignmentDocStates(tenantId);
  const serviceRecords = getDemoServiceRecords(tenantId).filter((r) =>
    inRange(`${r.serviceDate}T12:00:00.000Z`, dateRange),
  );
  const billableItems = getDemoBillableItems(tenantId);
  const preparedItems = billableItems.filter((b) => b.status === 'prepared');
  const blockedItems = billableItems.filter((b) => b.status === 'blocked');
  const invoicedItems = billableItems.filter((b) => b.status === 'invoiced');

  const tenantInvoices = demoInvoices.filter((i) => i.tenantId === tenantId);
  const openInvoices = tenantInvoices.filter(
    (i) => i.status === 'aktiv' || i.status === 'in_bearbeitung' || i.status === 'entwurf',
  );
  const today = new Date().toISOString().slice(0, 10);
  const overdue = tenantInvoices.filter((i) => i.dueDate < today && i.status !== 'abgeschlossen');

  const budgets = demoBudgets.filter((b) => b.tenantId === tenantId && b.status !== 'archiviert');
  const exceeded = budgets.filter((b) => b.allocatedCents > 0 && b.usedCents > b.allocatedCents);
  const warning = budgets.filter(
    (b) => b.allocatedCents > 0 && b.usedCents / b.allocatedCents >= 0.85 && b.usedCents <= b.allocatedCents,
  );
  const unused = budgets.filter((b) => b.usedCents === 0);

  const clients = demoClients.filter((c) => c.tenantId === tenantId);
  const employees = demoEmployees.filter((e) => e.tenantId === tenantId);

  const problems = LIVE_MONITOR_STORE.problemReports.filter((p) => p.tenantId === tenantId);
  const emergencies = LIVE_MONITOR_STORE.emergencyReports.filter((e) => e.tenantId === tenantId);
  const mgmtTasks = LIVE_MONITOR_STORE.managementTasks.filter(
    (t) => t.tenantId === tenantId && t.status === 'open',
  );

  const revenuePreparedCents = preparedItems.reduce((s, i) => s + i.amountCents, 0);
  const revenueInvoicedCents = tenantInvoices
    .filter((i) => i.status !== 'entwurf')
    .reduce((s, i) => s + i.amountCents, 0);

  const selfPayer = serviceRecords.filter((r) => r.payerType === 'self').reduce((s, r) => s + r.totalAmountCents, 0);
  const carrier = serviceRecords.filter((r) => r.payerType === 'carrier').reduce((s, r) => s + r.totalAmountCents, 0);

  const connectPrepared = 4;

  const completed = assignments.filter((a) => mapAssignmentStatus(a.status) === 'completed').length;
  const utilization =
    employees.filter((e) => e.status === 'aktiv').length > 0
      ? Math.round((assignments.length / Math.max(employees.filter((e) => e.status === 'aktiv').length, 1)) * 10)
      : null;

  return {
    tenantId,
    dateRange,
    tableAvailability: { ...DEMO_TABLE_AVAILABILITY },
    assignments: {
      total: assignments.length,
      planned: assignments.filter((a) => mapAssignmentStatus(a.status) === 'planned').length,
      started: assignments.filter((a) => mapAssignmentStatus(a.status) === 'started').length,
      completed,
      cancelled: assignments.filter((a) => mapAssignmentStatus(a.status) === 'cancelled').length,
      missed: allAssignments.filter((a) => a.status === 'fehlerhaft').length,
      openWithoutEmployee: allAssignments.filter((a) => !a.employeeId && a.status !== 'abgeschlossen').length,
      overrun: 0,
      onTimeStart: assignments.filter((a) => isAssignmentToday(a.scheduledStart) && a.status !== 'fehlerhaft').length,
    },
    documentation: {
      complete: docStates.filter((d) => d.documentationStatus === 'complete').length,
      missing: docStates.filter((d) => d.documentationStatus === 'missing').length,
      incomplete: docStates.filter((d) => d.documentationStatus === 'incomplete').length,
      corrections: docStates.filter((d) => d.hasCorrection).length,
    },
    signatures: {
      complete: docStates.filter((d) => d.signatureStatus === 'complete').length,
      missing: docStates.filter((d) => d.signatureStatus === 'missing').length,
      exception: docStates.filter((d) => d.signatureStatus === 'exception').length,
    },
    serviceRecords: {
      created: serviceRecords.length,
      signed: serviceRecords.filter((r) => r.status === 'signed' || r.status === 'billing_ready').length,
      reviewPending: serviceRecords.filter((r) => r.status === 'review_pending').length,
      approved: serviceRecords.filter((r) => r.status === 'approved').length,
      rejected: serviceRecords.filter((r) => r.status === 'rejected').length,
      corrected: serviceRecords.filter((r) => r.status === 'corrected').length,
      billingReady: serviceRecords.filter((r) => r.status === 'billing_ready').length,
    },
    billing: {
      billingReadyCents: revenuePreparedCents,
      draftCount: tenantInvoices.filter((i) => i.status === 'entwurf').length,
      invoicedCents: revenueInvoicedCents,
      openCents: openInvoices.reduce((s, i) => s + i.amountCents, 0),
      overdueCount: overdue.length,
      reminderCount: 0,
      blockerCount: blockedItems.length,
      nonBillableCount: billableItems.filter((b) => b.status === 'non_billable').length,
      selfPayerCents: selfPayer,
      carrierCents: carrier,
    },
    budget: {
      activeCount: budgets.filter((b) => b.status === 'aktiv' || b.status === 'in_bearbeitung').length,
      exceededCount: exceeded.length,
      warningCount: warning.length,
      unusedCount: unused.length,
      consumedCents: budgets.reduce((s, b) => s + b.usedCents, 0),
      availableCents: budgets.reduce((s, b) => s + Math.max(b.allocatedCents - b.usedCents, 0), 0),
    },
    employees: {
      activeCount: employees.filter((e) => e.status === 'aktiv').length,
      withOpenDocs: docStates.filter((d) => d.documentationStatus !== 'complete').length,
      withCorrections: docStates.filter((d) => d.hasCorrection).length,
      withDelays: 0,
      utilizationPercent: utilization,
    },
    clients: {
      active: clients.filter((c) => c.status === 'aktiv').length,
      newInPeriod: clients.filter((c) => inRange(c.updatedAt, dateRange) && c.status === 'entwurf').length,
      paused: clients.filter((c) => c.status === 'in_bearbeitung').length,
      archived: clients.filter((c) => c.status === 'abgeschlossen' || c.status === 'archiviert').length,
      openDocs: docStates.filter((d) => d.documentationStatus !== 'complete').length,
    },
    qualityRisk: {
      complaints: problems.filter((p) => p.reportType === 'callback_required').length,
      emergencies: emergencies.length,
      problems: problems.length,
      noShows: problems.filter((p) => p.reportType === 'no_show').length,
      repeatCorrections: docStates.filter((d) => d.hasCorrection).length,
      qmTasksOpen: mgmtTasks.length,
      criticalAssignments: allAssignments.filter((a) => a.status === 'fehlerhaft').length,
    },
    growth: {
      assignmentsTrend: assignments.length > 0 ? assignments.length : null,
      clientsTrend: clients.filter((c) => c.status === 'aktiv').length,
      revenuePreparedCents,
      revenueInvoicedCents,
      connectPrepared,
    },
  };
}

export async function fetchDemoReportingMetrics(
  tenantId: string,
  dateRange: ReportingDateRange,
): Promise<ServiceResult<ReportingMetricsRawBundle>> {
  await new Promise((r) => setTimeout(r, 120));
  return { ok: true, data: buildDemoReportingMetricsBundle(tenantId, dateRange) };
}
