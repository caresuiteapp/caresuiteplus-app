import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

function readEmployeeId(data: { employee_id?: string | null } | null): string | null {
  return data?.employee_id?.trim() || null;
}

async function readEmployeeLink(
  tenantId: string,
  filters: { accountId?: string; authUserId?: string },
): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  let query = fromUnknownTable(supabase, 'employee_portal_accounts')
    .select('employee_id')
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'pending_first_login']);

  if (filters.accountId) query = query.eq('id', filters.accountId);
  if (filters.authUserId) query = query.eq('auth_user_id', filters.authUserId);

  const { data, error } = await query.maybeSingle();
  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[resolvePortalEmployeeLink] employee_portal_accounts:', error.message);
    }
    return null;
  }

  return readEmployeeId(data as { employee_id?: string | null } | null);
}

/** Restores employee_id for portal sessions created before it was cached locally. */
export async function fetchPortalEmployeeIdForAuthUser(
  tenantId: string,
): Promise<string | null> {
  if (!tenantId.trim()) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) return null;

  return readEmployeeLink(tenantId, { authUserId: data.user.id });
}

/** Restores employee_id from the validated portal account stored in the session. */
export async function fetchPortalEmployeeIdByAccessAccount(
  tenantId: string,
  portalAccountId: string,
): Promise<string | null> {
  if (!tenantId.trim() || !portalAccountId.trim()) return null;
  return readEmployeeLink(tenantId, { accountId: portalAccountId });
}
