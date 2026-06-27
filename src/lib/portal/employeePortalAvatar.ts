import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';
import { mapEmployeeAvatarUrl } from '@/lib/office/employeeAvatarService';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

export type EmployeePortalAvatarFields = {
  avatarUrl: string | null;
  updatedAt: string | null;
};

/** Live read of employee avatar_url — falls back to null when unavailable. */
export async function fetchEmployeePortalAvatar(
  tenantId: string,
  employeeId: string,
): Promise<EmployeePortalAvatarFields | null> {
  if (!tenantId.trim() || !employeeId.trim()) return null;

  if (getServiceMode() !== 'supabase') {
    return null;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await fromUnknownTable(supabase, 'employees')
    .select('avatar_url, updated_at')
    .eq('tenant_id', tenantId)
    .eq('id', employeeId)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[employeePortalAvatar] employees:', error.message);
    }
    return null;
  }

  if (!data) return null;

  const row = data as {
    avatar_url?: string | null;
    updated_at?: string | null;
  };

  const avatarUrl = mapEmployeeAvatarUrl(row.avatar_url ?? null);

  return {
    avatarUrl,
    updatedAt: row.updated_at?.trim() || avatarUrl || null,
  };
}
