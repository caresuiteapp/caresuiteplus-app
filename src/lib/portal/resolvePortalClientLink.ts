import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  isClientPortalScopeId,
  resolveClientPortalLinkRow,
} from './clientPortalActorScope';

/** Reads client_id for the signed-in auth user — fallback when session lacks clientId. */
export async function fetchPortalClientIdForAuthUser(
  tenantId: string,
): Promise<string | null> {
  if (!isClientPortalScopeId(tenantId)) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user?.id) return null;

  const { data, error } = await fromUnknownTable(supabase, 'client_portal_access')
    .select('id, tenant_id, client_id')
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

  const access = data as {
    id?: string | null;
    tenant_id?: string | null;
    client_id?: string | null;
  } | null;
  const clientId = resolveClientPortalLinkRow(tenantId, access);
  if (clientId) return clientId;

  const { data: relativeData, error: relativeError } = await fromUnknownTable(
    supabase,
    'relative_portal_codes',
  )
    .select('id, tenant_id, client_id')
    .eq('tenant_id', tenantId)
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  if (relativeError) {
    if (!isMissingTableError(relativeError)) {
      console.warn('[resolvePortalClientLink] relative_portal_codes:', relativeError.message);
    }
    return null;
  }

  const relative = relativeData as {
    id?: string | null;
    tenant_id?: string | null;
    client_id?: string | null;
  } | null;
  return resolveClientPortalLinkRow(tenantId, relative);
}

/** Reads client_id for a portal access row — RLS scopes to the signed-in portal actor. */
export async function fetchPortalClientIdByAccessAccount(
  tenantId: string,
  portalAccountId: string,
): Promise<string | null> {
  if (!isClientPortalScopeId(tenantId) || !isClientPortalScopeId(portalAccountId)) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await fromUnknownTable(supabase, 'client_portal_access')
    .select('id, tenant_id, client_id')
    .eq('tenant_id', tenantId)
    .eq('id', portalAccountId)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[resolvePortalClientLink] client_portal_access:', error.message);
    }
    return null;
  }

  const access = data as {
    id?: string | null;
    tenant_id?: string | null;
    client_id?: string | null;
  } | null;
  const clientId = resolveClientPortalLinkRow(tenantId, access, portalAccountId);
  if (clientId) return clientId;

  return fetchPortalClientIdForAuthUser(tenantId);
}
