import type { ServiceResult } from '@/types';
import type { AssistDashboardData, PortalNextAppointment } from '@/types/portal/assist';
import { fetchClientPortalLiveMetrics } from '@/lib/portal/clientPortalDashboardLive';
import { listPortalActivities } from '@/lib/portal/assist/portalActivityService';
import { fetchPortalBudgetSnapshot } from '@/lib/portal/assist/portalBudgetService';
import { listPortalRequests } from '@/lib/portal/assist/portalRequestService';
import { isFeatureVisible } from '@/lib/portal/engine/portalVisibility';
import type { PortalContext } from '@/lib/portal/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';

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

const PLANNED_BEGLEITUNG_STATUSES = ['geplant', 'bestaetigt'] as const;

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

async function fetchNextAppointment(
  tenantId: string,
  clientId: string,
): Promise<PortalNextAppointment | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('assignments')
    .select('id, title, planned_start_at, planned_end_at, status, location')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .gte('planned_start_at', now)
    .in('status', [...UPCOMING_ASSIGNMENT_STATUSES])
    .order('planned_start_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error && !isMissingTableError(error)) {
      console.warn('[portalAssistDashboard] next appointment:', error.message);
    }
    return null;
  }

  const row = data as Record<string, unknown>;
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? 'Assist-Termin'),
    startsAt: String(row.planned_start_at ?? ''),
    endsAt: row.planned_end_at ? String(row.planned_end_at) : null,
    location: row.location ? String(row.location) : null,
    status: String(row.status ?? ''),
  };
}

async function countBegleitungen(
  tenantId: string,
  clientId: string,
  tripsReleased: boolean,
): Promise<number | null> {
  if (!tripsReleased) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const now = new Date().toISOString();
  const { count, error } = await supabase
    .from('assignments')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .gte('planned_start_at', now)
    .in('status', [...PLANNED_BEGLEITUNG_STATUSES]);

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[portalAssistDashboard] begleitungen:', error.message);
    }
    return 0;
  }
  return count ?? 0;
}

async function countOpenRequests(tenantId: string, clientId: string): Promise<number> {
  const result = await listPortalRequests(tenantId, clientId, {
    status: ['offen', 'in_bearbeitung'],
  });
  return result.ok ? result.data.length : 0;
}

async function countSignatures(tenantId: string, clientId: string): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) return 0;

  const { count, error } = await fromUnknownTable(supabase, 'client_documents')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('portal_visible', true)
    .eq('signature_required', true)
    .is('signed_at', null);

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[portalAssistDashboard] signatures:', error.message);
    }
    return 0;
  }
  return count ?? 0;
}

/** Aggregate live Assist overview data — no demo fallback. */
export async function fetchAssistDashboardData(
  context: Pick<
    PortalContext,
    'tenantId' | 'clientId' | 'portalRole' | 'visibleFeatures' | 'widgetMetrics'
  >,
): Promise<ServiceResult<AssistDashboardData>> {
  return runService(async () => {
    const { tenantId, clientId } = context;
    const tripsReleased = isFeatureVisible('assist', 'trips', context.portalRole);

    const [
      metrics,
      nextAppointment,
      begleitungen,
      openRequestCount,
      signatures,
      activitiesResult,
      requestsResult,
      budgetResult,
    ] = await Promise.all([
      fetchClientPortalLiveMetrics(tenantId, clientId),
      fetchNextAppointment(tenantId, clientId),
      countBegleitungen(tenantId, clientId, tripsReleased),
      countOpenRequests(tenantId, clientId),
      countSignatures(tenantId, clientId),
      listPortalActivities(tenantId, clientId, 8),
      listPortalRequests(tenantId, clientId, {
        status: ['offen', 'in_bearbeitung'],
        limit: 5,
      }),
      fetchPortalBudgetSnapshot(tenantId, clientId),
    ]);

    const budget = budgetResult.ok ? budgetResult.data : null;
    const budgetReleased = isFeatureVisible('assist', 'budget', context.portalRole);

    return {
      ok: true,
      data: {
        nextAppointment,
        kpis: {
          appointments: metrics.upcomingAppointments,
          messages: metrics.openMessages,
          documents: metrics.documents,
          proofs: 0,
          signatures,
          budgetAvailable: budgetReleased && budget !== null,
          openRequests: openRequestCount,
          activities: activitiesResult.ok ? activitiesResult.data.length : 0,
          begleitungen,
        },
        activities: activitiesResult.ok ? activitiesResult.data : [],
        budget: budgetReleased ? budget : null,
        openRequests: requestsResult.ok ? requestsResult.data : [],
      },
    };
  });
}
