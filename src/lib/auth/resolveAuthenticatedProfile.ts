import type { ServiceResult } from '@/types';
import { withAuthBootstrapTimeout } from '@/lib/auth/authBootstrapTimeout';
import { getSupabaseClient } from '@/lib/supabase/client';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { isDeviceOffline } from '@/lib/offline/connectivity';

const IDENTITY_ERROR = 'Ihr angemeldetes Profil konnte nicht bestätigt werden. Bitte melden Sie sich erneut an.';

/** Resolve the real profiles foreign key, including older auth_user_id mappings. */
export async function resolveAuthenticatedProfileId(
  tenantId: string,
): Promise<ServiceResult<string>> {
  if (isDeviceOffline()) return { ok: false, error: 'Änderungen erfordern eine bestätigte Online-Verbindung.' };
  if (!tenantId.trim()) return { ok: false, error: IDENTITY_ERROR };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };

  try {
    return await withAuthBootstrapTimeout((async (): Promise<ServiceResult<string>> => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      const authUserId = auth.user?.id;
      if (authError || !authUserId) return { ok: false, error: IDENTITY_ERROR };

      const [profile, tenant] = await Promise.all([
        supabase.rpc('resolve_current_profile_id' as never) as unknown as PromiseLike<{ data: unknown; error: unknown }>,
        supabase.rpc('current_tenant_id'),
      ]);
      if (profile.error || tenant.error || tenant.data !== tenantId ||
          typeof profile.data !== 'string' || !profile.data.trim()) {
        return { ok: false, error: IDENTITY_ERROR };
      }

      // The compatibility RPC has no tenant predicate. Verify its actual row
      // instead of assuming auth.uid() or a portal access account is profiles.id.
      const { data: row, error } = await supabase.from('profiles')
        .select('id, tenant_id, auth_user_id')
        .eq('id', profile.data)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error || !row || row.id !== profile.data || row.tenant_id !== tenantId ||
          (row.id !== authUserId && row.auth_user_id !== authUserId)) {
        return { ok: false, error: IDENTITY_ERROR };
      }
      return { ok: true, data: row.id };
    })(), 'Profilzuordnung');
  } catch {
    return { ok: false, error: IDENTITY_ERROR };
  }
}
