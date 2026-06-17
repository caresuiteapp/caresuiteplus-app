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
  isOpenInvoiceStatus,
} from '@/lib/office/officeDashboardMetrics';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '../errors';

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

async function countByFilter(
  table: string,
  tenantId: string,
  applyFilter?: (query: ReturnType<typeof fromUnknownTable>) => ReturnType<typeof fromUnknownTable>,
): Promise<{ count: number; available: boolean }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { count: 0, available: false };

  let query = fromUnknownTable(supabase, table)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if (applyFilter) {
    query = applyFilter(query);
  }

  const { count, error } = await query;
  if (error) return { count: 0, available: false };
  return { count: count ?? 0, available: true };
}

/** WP223 — Live Supabase Repository (Office dashboard KPIs) */
export const officeDashboardSupabaseRepository = {
  wpNumber: 223 as const,

  async fetchMetrics(tenantId: string): Promise<ServiceResult<OfficeDashboardMetrics>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const metrics = emptyOfficeDashboardMetrics();
    const dayBounds = getLocalDayBounds();

    const [
      totalClients,
      activeClients,
      clientsInIntake,
      totalEmployees,
      activeEmployees,
      totalAppointments,
      appointmentsToday,
    ] = await Promise.all([
      countByFilter('clients', tenantId),
      countByFilter('clients', tenantId, (query) => query.eq('status', 'active')),
      countByFilter('clients', tenantId, (query) => query.eq('status', 'paused')),
      countByFilter('employees', tenantId),
      countByFilter('employees', tenantId, (query) => query.eq('status', 'active')),
      countByFilter('appointments', tenantId),
      countByFilter('appointments', tenantId, (query) =>
        query.gte('starts_at', dayBounds.start).lt('starts_at', dayBounds.end),
      ),
    ]);

    metrics.tableAvailability.clients = totalClients.available;
    metrics.tableAvailability.employees = totalEmployees.available;
    metrics.tableAvailability.appointments = totalAppointments.available;

    if (totalClients.available) {
      metrics.totalClients = totalClients.count;
      metrics.activeClients = activeClients.available ? activeClients.count : 0;
      metrics.clientsInIntake = clientsInIntake.available ? clientsInIntake.count : 0;
    }

    if (totalEmployees.available) {
      metrics.totalEmployees = totalEmployees.count;
      metrics.activeEmployees = activeEmployees.available ? activeEmployees.count : 0;
    }

    if (totalAppointments.available) {
      metrics.totalAppointments = totalAppointments.count;
      metrics.appointmentsToday = appointmentsToday.available ? appointmentsToday.count : 0;
    }

    const invoiceResult = await supabase
      .from('invoices')
      .select('status')
      .eq('tenant_id', tenantId);

    if (!invoiceResult.error) {
      metrics.tableAvailability.invoices = true;
      const rows = (invoiceResult.data ?? []) as { status: string }[];
      metrics.openInvoices = rows.filter((row) => isOpenInvoiceStatus(row.status)).length;
      metrics.draftInvoices = rows.filter((row) => row.status === 'draft').length;
    }

    return { ok: true, data: metrics };
  },

  async fetchBusinessMetrics(tenantId: string): Promise<ServiceResult<BusinessDashboardMetrics>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();

    const metrics = emptyBusinessDashboardMetrics();
    const dayBounds = getLocalDayBounds();
    const todayDate = dayBounds.start.slice(0, 10);

    const [
      totalClients,
      activeClients,
      assignmentsToday,
      openAssignmentsToday,
      openProductionTasks,
      overdueProductionTasks,
      totalModules,
      activeModules,
    ] = await Promise.all([
      countByFilter('clients', tenantId),
      countByFilter('clients', tenantId, (query) => query.eq('status', 'active')),
      countByFilter('assignments', tenantId, (query) =>
        query.gte('planned_start_at', dayBounds.start).lt('planned_start_at', dayBounds.end),
      ),
      countByFilter('assignments', tenantId, (query) =>
        query
          .gte('planned_start_at', dayBounds.start)
          .lt('planned_start_at', dayBounds.end)
          .not('status', 'in', '(completed,cancelled,no_show)'),
      ),
      countByFilter('production_tasks', tenantId, (query) =>
        query.or('is_completed.is.null,is_completed.eq.false'),
      ),
      countByFilter('production_tasks', tenantId, (query) =>
        query
          .or('is_completed.is.null,is_completed.eq.false')
          .lt('due_date', todayDate),
      ),
      countByFilter('tenant_products', tenantId),
      countByFilter('tenant_products', tenantId, (query) =>
        query.in('status', ['active', 'trial']),
      ),
    ]);

    metrics.tableAvailability.clients = totalClients.available;
    metrics.tableAvailability.assignments = assignmentsToday.available;

    if (totalClients.available) {
      metrics.totalClients = totalClients.count;
      metrics.activeClients = activeClients.available ? activeClients.count : 0;
    }

    if (assignmentsToday.available) {
      metrics.assignmentsToday = assignmentsToday.count;
      metrics.openAssignmentsToday = openAssignmentsToday.available ? openAssignmentsToday.count : 0;
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

    metrics.tableAvailability.modules = totalModules.available;
    if (totalModules.available) {
      metrics.totalModules = totalModules.count;
      metrics.activeModules = activeModules.available ? activeModules.count : 0;
    }

    return { ok: true, data: metrics };
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
