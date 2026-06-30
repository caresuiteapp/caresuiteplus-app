import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

/** Reads client_id for a portal access row — RLS scopes to the signed-in portal actor. */
export async function fetchPortalClientIdByAccessAccount(
  tenantId: string,
  portalAccountId: string,
): Promise<string | null> {
  if (!tenantId.trim() || !portalAccountId.trim()) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await fromUnknownTable(supabase, 'client_portal_access')
    .select('client_id')
    .eq('tenant_id', tenantId)
    .eq('id', portalAccountId)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[resolvePortalClientLink] client_portal_access:', error.message);
    }
    return null;
  }

  const clientId = (data as { client_id?: string | null } | null)?.client_id;
  return clientId?.trim() || null;
}
