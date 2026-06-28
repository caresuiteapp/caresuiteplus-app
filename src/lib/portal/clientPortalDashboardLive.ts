import {
  PORTAL_CLIENT_DOCUMENT_STATUSES,
  PORTAL_INTERNAL_SENSITIVITIES,
  PORTAL_PROOFS_CATEGORY,
} from '@/lib/clients/clientDocumentPortalVisibility';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

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

/** Live KPI counts for client portal dashboard — RLS scopes rows to the portal actor. */
export async function fetchClientPortalLiveMetrics(
  tenantId: string,
  clientId?: string,
): Promise<ClientPortalLiveMetrics> {
  const client = getSupabaseClient();
  if (!client) return EMPTY_METRICS;

  const now = new Date().toISOString();

  let threadsQuery = client
    .from('message_threads')
    .select('portal_unread_count')
    .eq('tenant_id', tenantId)
    .eq('thread_type', 'client');

  if (clientId?.trim()) {
    threadsQuery = threadsQuery.eq('client_id', clientId);
  }

  let assignmentsQuery = fromUnknownTable(client, 'assignments')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('planned_start_at', now)
    .in('status', [...UPCOMING_ASSIGNMENT_STATUSES]);

  if (clientId?.trim()) {
    assignmentsQuery = assignmentsQuery.eq('client_id', clientId);
  }

  const documentsQuery = clientId?.trim()
    ? fromUnknownTable(client, 'client_documents')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .eq('portal_visible', true)
        .in('status', [...PORTAL_CLIENT_DOCUMENT_STATUSES])
        .not('sensitivity', 'in', `(${PORTAL_INTERNAL_SENSITIVITIES.join(',')})`)
        .neq('category', PORTAL_PROOFS_CATEGORY)
    : null;

  const [threadsResult, assignmentsResult, documentsResult] = await Promise.all([
    threadsQuery,
    assignmentsQuery,
    documentsQuery ?? Promise.resolve({ count: 0, error: null }),
  ]);

  if (threadsResult.error && !isMissingTableError(threadsResult.error)) {
    console.warn('[clientPortalDashboardLive] message_threads:', threadsResult.error.message);
  }
  if (assignmentsResult.error && !isMissingTableError(assignmentsResult.error)) {
    console.warn('[clientPortalDashboardLive] assignments:', assignmentsResult.error.message);
  }
  if (documentsResult.error && !isMissingTableError(documentsResult.error)) {
    console.warn('[clientPortalDashboardLive] client_documents:', documentsResult.error.message);
  }

  const openMessages = threadsResult.error
    ? 0
    : ((threadsResult.data ?? []) as { portal_unread_count?: number | null }[]).reduce(
        (sum, row) => sum + Number(row.portal_unread_count ?? 0),
        0,
      );

  return {
    upcomingAppointments: assignmentsResult.error ? 0 : (assignmentsResult.count ?? 0),
    documents: documentsResult.error ? 0 : (documentsResult.count ?? 0),
    openMessages,
  };
}
