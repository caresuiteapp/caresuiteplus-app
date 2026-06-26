import type { ServiceResult } from '@/types';
import type { AssistDashboardData, PortalNextAppointment } from '@/types/portal/assist';
import { fetchClientPortalLiveMetrics } from '@/lib/portal/clientPortalDashboardLive';
import { listPortalActivities } from '@/lib/portal/assist/portalActivityService';
import { fetchPortalBudgetSnapshot } from '@/lib/portal/assist/portalBudgetService';
import { listPortalRequests } from '@/lib/portal/assist/portalRequestService';
import { countOpenPortalServiceProofs } from '@/lib/portal/assist/portalServiceProofService';
import {
  canAccessPortalFeature,
  resolveApplicablePortalBudgetTypes,
} from '@/lib/portal/engine/portalFeatureAccess';
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

async function fetchUpcomingAppointments(
  tenantId: string,
  clientId: string,
  limit = 8,
): Promise<PortalNextAppointment[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const now = new Date().toISOString();

  const { data, error } = await fromUnknownTable(supabase, 'assignments')
    .select('id, title, planned_start_at, planned_end_at, status, location')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .gte('planned_start_at', now)
    .in('status', [...UPCOMING_ASSIGNMENT_STATUSES])
    .order('planned_start_at', { ascending: true })
    .limit(limit);

  if (error || !data) {
    if (error && !isMissingTableError(error)) {
      console.warn('[portalAssistDashboard] upcoming appointments:', error.message);
    }
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id ?? ''),
    title: String(row.title ?? 'Assist-Einsatz'),
    startsAt: String(row.planned_start_at ?? ''),
    endsAt: row.planned_end_at ? String(row.planned_end_at) : null,
    location: row.location ? String(row.location) : null,
    status: String(row.status ?? ''),
  }));
}

async function fetchPortalClientContactPhone(
  tenantId: string,
  clientId: string,
): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('clients')
    .select('primary_contact_phone, phone')
    .eq('tenant_id', tenantId)
    .eq('id', clientId)
    .maybeSingle();

  if (error || !data) {
    if (error && !isMissingTableError(error)) {
      console.warn('[portalAssistDashboard] client phone:', error.message);
    }
    return null;
  }

  const row = data as { primary_contact_phone?: string | null; phone?: string | null };
  const phone = row.primary_contact_phone ?? row.phone ?? null;
  return phone?.trim() || null;
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
  const { count, error } = await fromUnknownTable(supabase, 'assignments')
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
    | 'tenantId'
    | 'clientId'
    | 'portalRole'
    | 'visibleFeatures'
    | 'widgetMetrics'
    | 'activeModuleKeys'
    | 'visibilityRules'
    | 'careProfile'
  >,
): Promise<ServiceResult<AssistDashboardData>> {
  return runService(async () => {
    const { tenantId, clientId } = context;
    const tripsReleased = canAccessPortalFeature(context, 'assist', 'trips');
    const budgetReleased = canAccessPortalFeature(context, 'assist', 'budget');
    const proofsReleased = canAccessPortalFeature(context, 'assist', 'nachweise');
    const applicableBudgetTypes = budgetReleased
      ? resolveApplicablePortalBudgetTypes(context.careProfile)
      : [];

    const [
      metrics,
      upcomingAppointments,
      contactPhone,
      begleitungen,
      openRequestCount,
      signatures,
      openProofs,
      activitiesResult,
      requestsResult,
      budgetResult,
    ] = await Promise.all([
      fetchClientPortalLiveMetrics(tenantId, clientId),
      fetchUpcomingAppointments(tenantId, clientId),
      fetchPortalClientContactPhone(tenantId, clientId),
      countBegleitungen(tenantId, clientId, tripsReleased),
      countOpenRequests(tenantId, clientId),
      countSignatures(tenantId, clientId),
      proofsReleased ? countOpenPortalServiceProofs(tenantId, clientId) : Promise.resolve(0),
      listPortalActivities(tenantId, clientId, 8),
      listPortalRequests(tenantId, clientId, {
        status: ['offen', 'in_bearbeitung'],
        limit: 5,
      }),
      budgetReleased && applicableBudgetTypes.length > 0
        ? fetchPortalBudgetSnapshot(tenantId, clientId, applicableBudgetTypes)
        : Promise.resolve({ ok: true as const, data: null }),
    ]);

    const budget = budgetResult.ok ? budgetResult.data : null;
    const nextAppointment = upcomingAppointments[0] ?? null;

    return {
      ok: true,
      data: {
        nextAppointment,
        upcomingAppointments,
        contactPhone,
        kpis: {
          appointments: metrics.upcomingAppointments,
          messages: metrics.openMessages,
          documents: metrics.documents,
          proofs: proofsReleased ? openProofs : 0,
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
