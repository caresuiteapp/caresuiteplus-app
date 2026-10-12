import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { withAuthBootstrapTimeout } from '@/lib/auth/authBootstrapTimeout';
import { isDeviceOffline } from '@/lib/offline/connectivity';

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
export type PortalEmployeeLinkResolution =
  | { status: 'verified'; employeeId: string; authUserId: string }
  | { status: 'denied' | 'unavailable' };

export async function resolvePortalEmployeeLinkForAuthUser(
  tenantId: string,
): Promise<PortalEmployeeLinkResolution> {
  if (!tenantId.trim() || isDeviceOffline()) return { status: 'unavailable' };

  const supabase = getSupabaseClient();
  if (!supabase) return { status: 'unavailable' };
  try {
    return await withAuthBootstrapTimeout((async (): Promise<PortalEmployeeLinkResolution> => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user?.id) return { status: 'unavailable' };
      // These existing server functions resolve the authenticated account,
      // status and canonical employee link, including the verified profile
      // fallback for legacy caregiver/nurse logins without a portal account.
      // Cached caller ids are not proof of ownership or reassignment.
      const [tenant, employee] = await Promise.all([
        supabase.rpc('current_tenant_id'),
        supabase.rpc('resolve_current_employee_id'),
      ]);
      if (tenant.error || employee.error) return { status: 'unavailable' };
      if (tenant.data !== tenantId || typeof employee.data !== 'string' || !employee.data.trim()) {
        return { status: 'denied' };
      }
      return { status: 'verified', employeeId: employee.data.trim(), authUserId: data.user.id };
    })(), 'Mitarbeitenden-Zuordnung');
  } catch {
    return { status: 'unavailable' };
  }
}

export async function fetchPortalEmployeeIdForAuthUser(tenantId: string): Promise<string | null> {
  const result = await resolvePortalEmployeeLinkForAuthUser(tenantId);
  return result.status === 'verified' ? result.employeeId : null;
}

/** Restores employee_id from the validated portal account stored in the session. */
export async function fetchPortalEmployeeIdByAccessAccount(
  tenantId: string,
  portalAccountId: string,
): Promise<string | null> {
  if (!tenantId.trim() || !portalAccountId.trim()) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    return await withAuthBootstrapTimeout((async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user?.id) return null;
      return readEmployeeLink(tenantId, { accountId: portalAccountId, authUserId: data.user.id });
    })(), 'Mitarbeitenden-Zuordnung');
  } catch {
    return null;
  }
}
