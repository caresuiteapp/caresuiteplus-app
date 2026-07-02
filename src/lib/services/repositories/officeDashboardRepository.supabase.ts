import type { ServiceResult } from '@/types';
import type { BusinessDashboardMetrics } from '@/lib/dashboard/businessDashboardMetrics';
import { emptyBusinessDashboardMetrics } from '@/lib/dashboard/businessDashboardMetrics';
import type {
  ClientTimelineEventRow,
  OfficeDashboardMetrics,
} from '@/lib/office/officeDashboardMetrics';
import {
  emptyOfficeDashboardMetrics,
  getLocalDayBounds,
  getLocalWeekBounds,
  getThirtyDaysAgoIso,
  isOpenInvoiceStatus,
} from '@/lib/office/officeDashboardMetrics';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '../errors';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPostgrestQuery = any;

async function countByFilter(
  table: string,
  tenantId: string,
  applyFilter?: (query: AnyPostgrestQuery) => AnyPostgrestQuery,
): Promise<{ count: number; available: boolean }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { count: 0, available: false };

  let query: AnyPostgrestQuery = fromUnknownTable(supabase, table)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if (applyFilter) {
    query = applyFilter(query);
  }

  const { count, error } = await query;
  if (error) return { count: 0, available: false };
  return { count: count ?? 0, available: true };
}

async function fetchZentraleMetrics(tenantId: string): Promise<BusinessDashboardMetrics> {
  const supabase = getSupabaseClient();
  const metrics = emptyBusinessDashboardMetrics();
  if (!supabase) return metrics;

  const dayBounds = getLocalDayBounds();
  const weekBounds = getLocalWeekBounds();
  const thirtyDaysAgo = getThirtyDaysAgoIso();
  const todayDate = dayBounds.start.slice(0, 10);

  const [
    totalClients,
    activeClients,
    clientsInIntake,
    newClients30Days,
    totalEmployees,
    activeEmployees,
    assignmentsToday,
    openProductionTasks,
    overdueProductionTasks,
    totalModules,
    activeModules,
    activePortalUsers,
    documentsForReview,
    openPortalRequests,
    openServiceRecords,
    appointmentsThisWeek,
    appointmentsToday,
  ] = await Promise.all([
    countByFilter('clients', tenantId),
    countByFilter('clients', tenantId, (query) => query.eq('status', 'active')),
    countByFilter('clients', tenantId, (query) => query.eq('status', 'paused')),
    countByFilter('clients', tenantId, (query) => query.gte('created_at', thirtyDaysAgo)),
    countByFilter('employees', tenantId),
    countByFilter('employees', tenantId, (query) => query.eq('status', 'active')),
    countByFilter('assignments', tenantId, (query) =>
      query.gte('planned_start_at', dayBounds.start).lt('planned_start_at', dayBounds.end),
    ),
    countByFilter('production_tasks', tenantId, (query) =>
      query.or('is_completed.is.null,is_completed.eq.false'),
    ),
    countByFilter('production_tasks', tenantId, (query) =>
      query.or('is_completed.is.null,is_completed.eq.false').lt('due_date', todayDate),
    ),
    countByFilter('tenant_products', tenantId),
    countByFilter('tenant_products', tenantId, (query) =>
      query.in('status', ['active', 'trial']),
    ),
    countByFilter('client_portal_access', tenantId, (query) => query.eq('portal_enabled', true)),
    countByFilter('qm_documents', tenantId, (query) => query.eq('status', 'pending_review')),
    countByFilter('portal_requests', tenantId, (query) =>
      query.in('status', ['offen', 'in_bearbeitung']),
    ),
    countByFilter('service_records', tenantId, (query) => query.eq('status', 'review_pending')),
    countByFilter('appointments', tenantId, (query) =>
      query.gte('starts_at', weekBounds.start).lt('starts_at', weekBounds.end),
    ),
    countByFilter('appointments', tenantId, (query) =>
      query.gte('starts_at', dayBounds.start).lt('starts_at', dayBounds.end),
    ),
  ]);

  metrics.tableAvailability.clients = totalClients.available;
  metrics.tableAvailability.employees = totalEmployees.available;
  metrics.tableAvailability.assignments = assignmentsToday.available;
  metrics.tableAvailability.modules = totalModules.available;
  metrics.tableAvailability.portalUsers = activePortalUsers.available;
  metrics.tableAvailability.documents = documentsForReview.available;
  metrics.tableAvailability.portalRequests = openPortalRequests.available;
  metrics.tableAvailability.serviceRecords = openServiceRecords.available;
  metrics.tableAvailability.appointments = appointmentsThisWeek.available;

  if (totalClients.available) {
    metrics.totalClients = totalClients.count;
    metrics.activeClients = activeClients.available ? activeClients.count : 0;
    metrics.clientsInIntake = clientsInIntake.available ? clientsInIntake.count : 0;
    metrics.newClients30Days = newClients30Days.available ? newClients30Days.count : 0;
  }

  if (totalEmployees.available) {
    metrics.totalEmployees = totalEmployees.count;
    metrics.activeEmployees = activeEmployees.available ? activeEmployees.count : 0;
  }

  if (assignmentsToday.available) {
    metrics.assignmentsToday = assignmentsToday.count;
  }

  if (openProductionTasks.available) {
    metrics.tableAvailability.tasks = true;
    metrics.openTasks = openProductionTasks.count;
    metrics.overdueTasks = overdueProductionTasks.available ? overdueProductionTasks.count : 0;
  } else {
    const [openQmTasks, overdueQmTasks] = await Promise.all([
      countByFilter('qm_tasks', tenantId, (query) =>
        query.in('status', ['open', 'in_progress', 'overdue']),
      ),
      countByFilter('qm_tasks', tenantId, (query) => query.eq('status', 'overdue')),
    ]);

    if (openQmTasks.available) {
      metrics.tableAvailability.tasks = true;
      metrics.openTasks = openQmTasks.count;
      metrics.overdueTasks = overdueQmTasks.available ? overdueQmTasks.count : 0;
    }
  }

  if (totalModules.available) {
    metrics.totalModules = totalModules.count;
    metrics.activeModules = activeModules.available ? activeModules.count : 0;
  }

  if (activePortalUsers.available) {
    metrics.activePortalUsers = activePortalUsers.count;
  }

  if (documentsForReview.available) {
    metrics.documentsForReview = documentsForReview.count;
  } else {
    const clientDocuments = await countByFilter('client_documents', tenantId, (query) =>
      query.eq('status', 'pending_review'),
    );
    if (clientDocuments.available) {
      metrics.tableAvailability.documents = true;
      metrics.documentsForReview = clientDocuments.count;
    }
  }

  if (openPortalRequests.available) {
    metrics.openPortalRequests = openPortalRequests.count;
  }

  if (openServiceRecords.available) {
    metrics.openServiceRecords = openServiceRecords.count;
  }

  if (appointmentsThisWeek.available) {
    metrics.appointmentsThisWeek = appointmentsThisWeek.count;
  }

  if (appointmentsToday.available) {
    metrics.appointmentsToday = appointmentsToday.count;
  }

  const invoiceResult = await supabase.from('invoices').select('status').eq('tenant_id', tenantId);
  if (!invoiceResult.error) {
    metrics.tableAvailability.invoices = true;
    const rows = (invoiceResult.data ?? []) as { status: string }[];
    metrics.openInvoices = rows.filter((row) => isOpenInvoiceStatus(row.status)).length;
    metrics.draftInvoices = rows.filter((row) => row.status === 'draft').length;
  }

  const { data: messageThreads, error: messageError } = await fromUnknownTable(supabase, 'message_threads')
    .select('unread_count_business')
    .eq('tenant_id', tenantId);

  if (!messageError) {
    metrics.tableAvailability.messages = true;
    metrics.unreadMessages = ((messageThreads ?? []) as { unread_count_business: number | null }[]).reduce(
      (sum, row) => sum + Number(row.unread_count_business ?? 0),
      0,
    );
  }

  const { data: budgets, error: budgetError } = await fromUnknownTable(supabase, 'client_budgets')
    .select('total_amount_cents, used_amount_cents')
    .eq('tenant_id', tenantId);

  if (!budgetError) {
    metrics.tableAvailability.budgets = true;
    metrics.budgetWarnings = ((budgets ?? []) as {
      total_amount_cents: number | null;
      used_amount_cents: number | null;
    }[]).filter((row) => {
      const total = Number(row.total_amount_cents ?? 0);
      const used = Number(row.used_amount_cents ?? 0);
      return total > 0 && used / total >= 0.8;
    }).length;
  }

  try {
    const { countAssistExecutionProblems } = await import(
      '@/lib/assist/assistExecutionProblemInboxService'
    );
    metrics.executionBlockers = await countAssistExecutionProblems(tenantId);
  } catch {
    metrics.executionBlockers = 0;
  }

  return metrics;
}

/** WP223 — Live Supabase Repository (Office dashboard KPIs) */
export const officeDashboardSupabaseRepository = {
  wpNumber: 223 as const,

  async fetchMetrics(tenantId: string): Promise<ServiceResult<OfficeDashboardMetrics>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    return { ok: true, data: await fetchZentraleMetrics(tenantId) };
  },

  async fetchBusinessMetrics(tenantId: string): Promise<ServiceResult<BusinessDashboardMetrics>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    return { ok: true, data: await fetchZentraleMetrics(tenantId) };
  },

  async fetchRecentTimelineEvents(
    tenantId: string,
    limit = 20,
  ): Promise<ServiceResult<ClientTimelineEventRow[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const { data, error } = await fromUnknownTable(supabase, 'client_timeline_events')
      .select('id, title, subtitle, icon, status, created_at, event_type')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return {
      ok: true,
      data: (data ?? []) as ClientTimelineEventRow[],
    };
  },
};
