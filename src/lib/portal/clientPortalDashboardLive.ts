import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';

export type ClientPortalLiveMetrics = {
  upcomingAppointments: number;
  documents: number;
  openMessages: number;
};

const EMPTY_METRICS: ClientPortalLiveMetrics = {
  upcomingAppointments: 0,
  documents: 0,
  openMessages: 0,
};

/** Live KPI counts for client portal dashboard — RLS scopes rows to the portal actor. */
export async function fetchClientPortalLiveMetrics(
  tenantId: string,
): Promise<ClientPortalLiveMetrics> {
  const client = getSupabaseClient();
  if (!client) return EMPTY_METRICS;

  const now = new Date().toISOString();

  const [threadsResult, appointmentsResult] = await Promise.all([
    client
      .from('message_threads')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('thread_type', 'client'),
    client
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('starts_at', now)
      .in('status', ['aktiv', 'in_bearbeitung']),
  ]);

  if (threadsResult.error && !isMissingTableError(threadsResult.error)) {
    console.warn('[clientPortalDashboardLive] message_threads:', threadsResult.error.message);
  }
  if (appointmentsResult.error && !isMissingTableError(appointmentsResult.error)) {
    console.warn('[clientPortalDashboardLive] appointments:', appointmentsResult.error.message);
  }

  return {
    upcomingAppointments: appointmentsResult.error ? 0 : (appointmentsResult.count ?? 0),
    documents: 0,
    openMessages: threadsResult.error ? 0 : (threadsResult.count ?? 0),
  };
}
