import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

function readClientId(data: { client_id?: string | null } | null): string | null {
  const clientId = data?.client_id;
  return clientId?.trim() || null;
}

/** Reads client_id for the signed-in auth user — fallback when session lacks clientId. */
export async function fetchPortalClientIdForAuthUser(
  tenantId: string,
): Promise<string | null> {
  if (!tenantId.trim()) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user?.id) return null;

  const { data, error } = await fromUnknownTable(supabase, 'client_portal_access')
    .select('client_id')
    .eq('tenant_id', tenantId)
    .eq('auth_user_id', authData.user.id)
    .eq('portal_enabled', true)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[resolvePortalClientLink] client_portal_access by auth_user:', error.message);
    }
    return null;
  }

  return readClientId(data as { client_id?: string | null } | null);
}

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

  const clientId = readClientId(data as { client_id?: string | null } | null);
  if (clientId) return clientId;

  return fetchPortalClientIdForAuthUser(tenantId);
}
