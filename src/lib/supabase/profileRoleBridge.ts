import type { RoleKey, ServiceResult } from '@/types';
import { mapLegacyRoleKeyToRoleKey, WORKSPACE_ROLE_DEFINITIONS } from '@/lib/permissions/workspaceRoles';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';

type ProfileRoleRow = {
  role_id: string | null;
  roles: { key: string } | null;
};

/** Preferred legacy `roles.key` when multiple workspace roles map to the same CS+ RoleKey. */
const PREFERRED_DB_ROLE_KEYS: Partial<Record<RoleKey, string>> = {
  business_admin: 'admin',
  business_manager: 'management',
  billing: 'billing',
  dispatch: 'planning',
  employee_portal: 'employee',
  caregiver: 'employee',
  nurse: 'employee',
  counselor: 'office',
  akademie_admin: 'management',
};

/** Maps CS+ RoleKey to legacy `roles.key` used in live Supabase. */
export function mapRoleKeyToDbRoleKey(roleKey: RoleKey): string {
  const preferred = PREFERRED_DB_ROLE_KEYS[roleKey];
  if (preferred) return preferred;

  const direct = WORKSPACE_ROLE_DEFINITIONS.find((def) => def.mapsToRoleKey === roleKey);
  if (direct) return direct.canonicalKey;

  const csPlusKeys: RoleKey[] = [
    'business_admin',
    'business_manager',
    'billing',
    'dispatch',
    'nurse',
    'caregiver',
    'counselor',
    'akademie_admin',
    'employee_portal',
    'client_portal',
    'family_portal',
  ];
  if (csPlusKeys.includes(roleKey)) return roleKey;

  return 'employee';
}

export async function fetchProfileRoleKey(
  tenantId: string,
  profileId: string,
): Promise<RoleKey | null> {
  if (getServiceMode() !== 'supabase') return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('role_id, roles(key)')
    .eq('tenant_id', tenantId)
    .eq('id', profileId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as ProfileRoleRow;
  const fromJoin = mapLegacyRoleKeyToRoleKey(row.roles?.key ?? null);
  if (fromJoin) return fromJoin;

  if (!row.role_id) return null;

  const { data: roleRow, error: roleError } = await supabase
    .from('roles')
    .select('key')
    .eq('id', row.role_id)
    .maybeSingle();

  if (roleError || !roleRow?.key) return null;
  return mapLegacyRoleKeyToRoleKey(roleRow.key);
}

export async function updateProfileRoleKey(
  tenantId: string,
  profileId: string,
  roleKey: RoleKey,
): Promise<ServiceResult<void>> {
  if (getServiceMode() !== 'supabase') {
    return { ok: true, data: undefined };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  }

  const dbRoleKey = mapRoleKeyToDbRoleKey(roleKey);
  const { data: roleRow, error: roleLookupError } = await supabase
    .from('roles')
    .select('id')
    .eq('key', dbRoleKey)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (roleLookupError) {
    return { ok: false, error: toGermanSupabaseError(roleLookupError) };
  }

  if (!roleRow?.id) {
    return { ok: true, data: undefined };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role_id: roleRow.id, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', profileId);

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: undefined };
}
