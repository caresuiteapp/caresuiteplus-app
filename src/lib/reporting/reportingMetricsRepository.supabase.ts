import type { ServiceResult } from '@/types';
import type { ReportingDateRange, ReportingMetricsRawBundle } from '@/types/reporting/metrics';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { invoiceSupabaseRepository } from '@/lib/services/repositories/invoiceRepository.supabase';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function emptyBundle(tenantId: string, dateRange: ReportingDateRange): ReportingMetricsRawBundle {
  return {
    tenantId,
    dateRange,
    tableAvailability: {
      assignments: false,
      assignment_tasks: false,
      assignment_status_events: false,
      assignment_documentation: false,
      assignment_signatures: false,
      service_records: false,
      billable_items: false,
      invoice_drafts: false,
      invoices: false,
      payments: false,
      client_budgets: false,
      budget_transactions: false,
      management_tasks: false,
      problem_reports: false,
      emergency_reports: false,
      clients: false,
      employees: false,
      messages: false,
      generated_documents: false,
      connect_integrations: false,
    },
    assignments: {
      total: 0,
      planned: 0,
      started: 0,
      completed: 0,
      cancelled: 0,
      missed: 0,
      openWithoutEmployee: 0,
      overrun: 0,
      onTimeStart: 0,
    },
    documentation: { complete: 0, missing: 0, incomplete: 0, corrections: 0 },
    signatures: { complete: 0, missing: 0, exception: 0 },
    serviceRecords: {
      created: 0,
      signed: 0,
      reviewPending: 0,
      approved: 0,
      rejected: 0,
      corrected: 0,
      billingReady: 0,
    },
    billing: {
      billingReadyCents: 0,
      draftCount: 0,
      invoicedCents: 0,
      openCents: 0,
      overdueCount: 0,
      reminderCount: 0,
      blockerCount: 0,
      nonBillableCount: 0,
      selfPayerCents: 0,
      carrierCents: 0,
    },
    budget: {
      activeCount: 0,
      exceededCount: 0,
      warningCount: 0,
      unusedCount: 0,
      consumedCents: 0,
      availableCents: 0,
    },
    employees: {
      activeCount: 0,
      withOpenDocs: 0,
      withCorrections: 0,
      withDelays: 0,
      utilizationPercent: null,
    },
    clients: { active: 0, newInPeriod: 0, paused: 0, archived: 0, openDocs: 0 },
    qualityRisk: {
      complaints: 0,
      emergencies: 0,
      problems: 0,
      noShows: 0,
      repeatCorrections: 0,
      qmTasksOpen: 0,
      criticalAssignments: 0,
    },
    growth: {
      assignmentsTrend: null,
      clientsTrend: null,
      revenuePreparedCents: 0,
      revenueInvoicedCents: 0,
      connectPrepared: 0,
    },
  };
}

async function countTable(
  table: string,
  tenantId: string,
  dateColumn?: string,
  range?: ReportingDateRange,
): Promise<{ count: number; available: boolean }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { count: 0, available: false };

  let query = fromUnknownTable(supabase, table)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if (dateColumn && range) {
    query = query.gte(dateColumn, range.from).lte(dateColumn, range.to);
  }

  const { count, error } = await query;
  if (error) return { count: 0, available: false };
  return { count: count ?? 0, available: true };
}

/** Prompt 70 — Live metrics from real Supabase tables; missing tables stay prepared */
export const reportingMetricsSupabaseRepository = {
  async fetchMetrics(
    tenantId: string,
    dateRange: ReportingDateRange,
  ): Promise<ServiceResult<ReportingMetricsRawBundle>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const bundle = emptyBundle(tenantId, dateRange);

    const assignmentCounts = await countTable('assignments', tenantId, 'planned_start_at', dateRange);
    if (assignmentCounts.available) {
      bundle.tableAvailability.assignments = true;
      bundle.assignments.total = assignmentCounts.count;

      const { count: noEmployee } = await fromUnknownTable(supabase, 'assignments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('employee_id', null);
      bundle.assignments.openWithoutEmployee = noEmployee ?? 0;
    }

    const serviceRecordCounts = await countTable('service_records', tenantId, 'service_date', dateRange);
    if (serviceRecordCounts.available) {
      bundle.tableAvailability.service_records = true;
      bundle.serviceRecords.created = serviceRecordCounts.count;

      const { data: srRows } = await fromUnknownTable(supabase, 'service_records')
        .select('status, total_amount')
        .eq('tenant_id', tenantId);
      if (srRows) {
        const rows = srRows as { status: string; total_amount: number | null }[];
        bundle.serviceRecords.billingReady = rows.filter((r) => r.status === 'billing_ready').length;
        bundle.serviceRecords.reviewPending = rows.filter((r) => r.status === 'review_pending').length;
        bundle.billing.billingReadyCents = Math.round(
          rows
            .filter((r) => r.status === 'billing_ready')
            .reduce((s, r) => s + (r.total_amount ?? 0) * 100, 0),
        );
        bundle.growth.revenuePreparedCents = bundle.billing.billingReadyCents;
      }
    }

    const invoiceResult = await invoiceSupabaseRepository.list(tenantId);
    if (invoiceResult.ok) {
      bundle.tableAvailability.invoices = true;
      const closed = new Set(['paid', 'cancelled', 'written_off']);
      const open = invoiceResult.data.filter((i) => !closed.has(i.status));
      bundle.billing.openCents = Math.round(
        open.reduce((s, i) => s + (i.total_amount ?? 0) * 100, 0),
      );
      bundle.billing.invoicedCents = Math.round(
        invoiceResult.data
          .filter((i) => i.status !== 'draft')
          .reduce((s, i) => s + (i.total_amount ?? 0) * 100, 0),
      );
      bundle.growth.revenueInvoicedCents = bundle.billing.invoicedCents;
      bundle.billing.draftCount = invoiceResult.data.filter((i) => i.status === 'draft').length;
      const today = new Date().toISOString().slice(0, 10);
      bundle.billing.overdueCount = invoiceResult.data.filter(
        (i) => i.due_date && i.due_date < today && !closed.has(i.status),
      ).length;
    }

    const budgetCounts = await countTable('client_budgets', tenantId);
    if (budgetCounts.available) {
      bundle.tableAvailability.client_budgets = true;
      bundle.budget.activeCount = budgetCounts.count;
    }

    const clientCounts = await countTable('clients', tenantId);
    if (clientCounts.available) {
      bundle.tableAvailability.clients = true;
      bundle.clients.active = clientCounts.count;
    }

    const employeeCounts = await countTable('employees', tenantId);
    if (employeeCounts.available) {
      bundle.tableAvailability.employees = true;
      bundle.employees.activeCount = employeeCounts.count;
    }

    const problemCounts = await countTable('problem_reports', tenantId, 'created_at', dateRange);
    if (problemCounts.available) {
      bundle.tableAvailability.problem_reports = true;
      bundle.qualityRisk.problems = problemCounts.count;
    }

    const emergencyCounts = await countTable('emergency_reports', tenantId, 'created_at', dateRange);
    if (emergencyCounts.available) {
      bundle.tableAvailability.emergency_reports = true;
      bundle.qualityRisk.emergencies = emergencyCounts.count;
    }

    const taskCounts = await countTable('management_tasks', tenantId, 'created_at', dateRange);
    if (taskCounts.available) {
      bundle.tableAvailability.management_tasks = true;
      bundle.qualityRisk.qmTasksOpen = taskCounts.count;
    }

    // Tables without migration — explicitly unavailable
    bundle.tableAvailability.billable_items = false;
    bundle.tableAvailability.invoice_drafts = false;
    bundle.tableAvailability.assignment_documentation = false;
    bundle.tableAvailability.assignment_signatures = false;
    bundle.tableAvailability.payments = false;
    bundle.tableAvailability.generated_documents = false;

    return { ok: true, data: bundle };
  },
};

export type ReportingMetricsRepository = typeof reportingMetricsSupabaseRepository;
