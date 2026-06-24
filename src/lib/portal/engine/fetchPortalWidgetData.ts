import type { PortalLiveMetrics, PortalModuleKey, PortalWidgetMetrics } from '@/lib/portal/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

const UPCOMING_APPOINTMENT_STATUSES = ['aktiv', 'in_bearbeitung'] as const;

const UPCOMING_ASSIGNMENT_STATUSES = [
  'geplant',
  'bestaetigt',
  'unterwegs',
  'angekommen',
  'gestartet',
  'pausiert',
  'beendet',
  'dokumentation_offen',
  'unterschrift_offen',
] as const;

const PLANNED_ASSIGNMENT_STATUSES = ['geplant', 'bestaetigt'] as const;

const ACTIVE_CASE_STATUSES = ['aktiv', 'in_bearbeitung', 'entwurf'] as const;

async function safeCount(
  label: string,
  query: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  const { count, error } = await query;
  if (error) {
    if (!isMissingTableError(error)) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: string }).message ?? error)
          : String(error);
      console.warn(`[fetchPortalWidgetData] ${label}:`, message);
    }
    return 0;
  }
  return count ?? 0;
}

export type FetchPortalWidgetDataInput = {
  tenantId: string;
  clientId: string;
  activeModuleKeys: PortalModuleKey[];
  metrics: PortalLiveMetrics;
};

/** Live widget KPI counts — only queries tables for active modules; no demo fallback. */
export async function fetchPortalWidgetData(
  input: FetchPortalWidgetDataInput,
): Promise<PortalWidgetMetrics> {
  const { tenantId, clientId, activeModuleKeys, metrics } = input;
  const modules = new Set(activeModuleKeys);
  const now = new Date().toISOString();

  const result: PortalWidgetMetrics = {
    messages_kpi: metrics.openMessages,
    documents_kpi: metrics.documents,
    appointments_kpi: metrics.upcomingAppointments,
  };

  const client = getSupabaseClient();
  if (!client || !clientId.trim()) return result;

  const tasks: Promise<void>[] = [];

  if (modules.has('assist')) {
    tasks.push(
      safeCount(
        'assist_next_visit',
        fromUnknownTable(client, 'assignments')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('client_id', clientId)
          .gte('planned_start_at', now)
          .in('status', [...UPCOMING_ASSIGNMENT_STATUSES]),
      ).then((count) => {
        result.assist_next_visit = count;
      }),
      safeCount(
        'assist_trips',
        fromUnknownTable(client, 'assignments')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('client_id', clientId)
          .gte('planned_start_at', now)
          .in('status', [...PLANNED_ASSIGNMENT_STATUSES]),
      ).then((count) => {
        result.assist_trips = count;
      }),
      safeCount(
        'assist_requests',
        fromUnknownTable(client, 'portal_requests')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('client_id', clientId)
          .in('status', ['offen', 'in_bearbeitung']),
      ).then((count) => {
        result.assist_requests = count;
      }),
      safeCount(
        'assist_activities',
        fromUnknownTable(client, 'portal_activities')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('client_id', clientId),
      ).then((count) => {
        result.assist_activities = count;
      }),
    );
  }

  if (modules.has('pflege')) {
    tasks.push(
      safeCount(
        'pflege_care_plan',
        fromUnknownTable(client, 'care_plans')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('client_id', clientId)
          .eq('status', 'aktiv'),
      ).then((count) => {
        result.pflege_care_plan = count;
      }),
      safeCount(
        'pflege_vitals',
        fromUnknownTable(client, 'vital_signs')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('client_id', clientId),
      ).then((count) => {
        result.pflege_vitals = count;
      }),
      safeCount(
        'pflege_medications',
        fromUnknownTable(client, 'medications')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('client_id', clientId)
          .eq('status', 'aktiv'),
      ).then((count) => {
        result.pflege_medications = count;
      }),
    );
  }

  if (modules.has('stationaer')) {
    tasks.push(
      safeCount(
        'stationaer_meals',
        fromUnknownTable(client, 'stationaer_meal_plans')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('client_id', clientId),
      ).then((count) => {
        result.stationaer_meals = count;
      }),
      safeCount(
        'stationaer_activities',
        fromUnknownTable(client, 'stationaer_activities')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('client_id', clientId)
          .gte('starts_at', now),
      ).then((count) => {
        result.stationaer_activities = count;
      }),
    );
  }

  if (modules.has('beratung')) {
    tasks.push(
      safeCount(
        'beratung_next_session',
        fromUnknownTable(client, 'appointments')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('starts_at', now)
          .in('status', [...UPCOMING_APPOINTMENT_STATUSES]),
      ).then((count) => {
        result.beratung_next_session = count;
      }),
      safeCount(
        'beratung_cases',
        fromUnknownTable(client, 'appointments')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('status', [...ACTIVE_CASE_STATUSES]),
      ).then((count) => {
        result.beratung_cases = count;
      }),
    );
  }

  await Promise.all(tasks);
  return result;
}
