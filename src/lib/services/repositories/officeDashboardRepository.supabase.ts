import type { ServiceResult } from '@/types';
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
