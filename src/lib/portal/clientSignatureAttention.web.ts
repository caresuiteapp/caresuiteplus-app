import { fetchAllPortalRows } from './fetchAllPortalRows.web';
import type { RoleKey, ServiceResult } from '@/types';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { fetchPortalCsDocumentRequests } from '@/lib/documents/csTemplates';

export type ClientSignatureItem = {
  id: string;
  kind: 'proof' | 'document';
  title: string;
  route: string;
};
export async function fetchClientPendingProofs(
  tenantId: string,
  clientId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<ClientSignatureItem[]>> {
  if (!tenantId || !clientId || !['client_portal', 'family_portal'].includes(roleKey ?? ''))
    return { ok: false, error: 'Bitte melden Sie sich im Klientenportal an.' };
  if (getServiceMode() !== 'supabase') return { ok: true, data: [] };
  const client = getSupabaseClient();
  if (!client)
    return { ok: false, error: 'Ihre offenen Unterschriften konnten nicht geladen werden.' };
  const result = await fetchAllPortalRows<Record<string, unknown> & { id: string }>((from, to) =>
    fromUnknownTable(client, 'assist_visit_proofs')
      .select('id, proof_number, assist_visits!inner(client_id, tenant_id)', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('assist_visits.tenant_id', tenantId)
      .eq('assist_visits.client_id', clientId)
      .neq('assist_visits.planning_status', 'draft')
      .not('assist_visits.canonical_status', 'in', '(cancelled,no_show)')
      .eq('portal_visible', true)
      .eq('portal_release_status', 'pending_client_signature')
      .order('id', { ascending: true })
      .range(from, to),
  );
  if (!result.ok) return result;
  return { ok: true, data: result.data.map((row) => ({
    id: String(row.id),
    kind: 'proof' as const,
    title: row.proof_number ? `Leistungsnachweis ${String(row.proof_number)}` : 'Leistungsnachweis',
    route: `/portal/client/documents/${String(row.id)}`,
  })) };
}
export async function fetchClientPendingDocuments(
  tenantId: string,
  clientId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<ClientSignatureItem[]>> {
  const result = await fetchPortalCsDocumentRequests({
    tenantId,
    clientId,
    roleKey,
    includeCompleted: false,
    summaryOnly: true,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    data: result.data
      .filter((item) =>
        item.pendingSignatureRoles.some((role) => role === 'client' || role === 'representative'),
      )
      .map((item) => ({
        id: item.id,
        kind: 'document',
        title: item.title,
        route: `/portal/client/documents/signatures/${item.id}`,
      })),
  };
}
export function signatureAttentionKey(item: ClientSignatureItem): string {
  return `${item.kind}:${item.id}`;
}
