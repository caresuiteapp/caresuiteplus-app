import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { getPermissionsForRole } from '@/lib/permissions/staticRolePermissions';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';

const cache = new Map<string, readonly PermissionKey[]>();

function cacheKey(tenantId: string | null, roleKey: RoleKey): string {
  return `${tenantId ?? 'global'}:${roleKey}`;
}

export async function fetchRuntimePermissions(
  roleKey: RoleKey,
  tenantId: string | null,
): Promise<readonly PermissionKey[]> {
  if (getServiceMode() !== 'supabase') {
    return getPermissionsForRole(roleKey);
  }

  const key = cacheKey(tenantId, roleKey);
  const cached = cache.get(key);
  if (cached) return cached;

  const client = getSupabaseClient();
  if (!client) {
    return getPermissionsForRole(roleKey);
  }

  const { data: roleRow } = await client.from('roles').select('id').eq('key', roleKey).maybeSingle();
  if (!roleRow?.id) {
    const fallback = getPermissionsForRole(roleKey);
    cache.set(key, fallback);
    return fallback;
  }

  const { data: globalPerms, error: globalError } = await client
    .from('role_permissions')
    .select('permission_key')
    .eq('role_id', roleRow.id);

  let permissions = (globalError ? [] : (globalPerms ?? [])).map(
    (row) => row.permission_key as PermissionKey,
  );

  if (tenantId) {
    const { data: tenantPerms } = await client
      .from('role_permission_sets')
      .select('permission_key')
      .eq('tenant_id', tenantId)
      .eq('role_key', roleKey);

    if (tenantPerms?.length) {
      permissions = tenantPerms.map((row) => row.permission_key as PermissionKey);
    }
  }

  const unique = Array.from(new Set(permissions)) as PermissionKey[];
  const resolved = unique.length > 0 ? unique : getPermissionsForRole(roleKey);
  cache.set(key, resolved);
  return resolved;
}

export function clearRuntimePermissionCache(): void {
  cache.clear();
}

export function getCachedRuntimePermissions(
  roleKey: RoleKey | null | undefined,
  tenantId: string | null,
): readonly PermissionKey[] {
  if (!roleKey) return [];
  const cached = cache.get(cacheKey(tenantId, roleKey));
  if (cached) return cached;
  return getPermissionsForRole(roleKey);
}
