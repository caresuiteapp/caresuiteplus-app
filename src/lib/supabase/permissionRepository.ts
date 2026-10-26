import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { getPermissionsForRole } from '@/lib/permissions/staticRolePermissions';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';

const cache = new Map<string, { permissions: readonly PermissionKey[]; expiresAt: number }>();
let generation = 0;

function cacheKey(tenantId: string | null, roleKey: RoleKey, identity: string): string {
  return JSON.stringify([tenantId, roleKey, identity]);
}

export async function fetchRuntimePermissions(
  roleKey: RoleKey,
  tenantId: string | null,
  identity?: string,
): Promise<readonly PermissionKey[]> {
  if (getServiceMode() !== 'supabase') {
    return getPermissionsForRole(roleKey);
  }

  // Callers without an authenticated identity never reuse another actor's result.
  const key = identity ? cacheKey(tenantId, roleKey, identity) : null;
  const requestGeneration = generation;
  const cached = key ? cache.get(key) : null;
  if (cached && cached.expiresAt > Date.now()) return cached.permissions;
  const remember = (permissions: readonly PermissionKey[]) => {
    if (key && generation === requestGeneration) cache.set(key, { permissions, expiresAt: Date.now() + 30_000 });
    return permissions;
  };

  const client = getSupabaseClient();
  if (!client) {
    return [];
  }

  const { data: roleRow, error: roleError } = await client.from('roles').select('id').eq('key', roleKey).maybeSingle();
  if (roleError) return [];
  if (!roleRow?.id) {
    const fallback = getPermissionsForRole(roleKey);
    return remember(fallback);
  }

  const { data: globalPerms, error: globalError } = await client
    .from('role_permissions')
    .select('permission_key')
    .eq('role_id', roleRow.id);

  if (globalError) return [];
  let permissions = (globalPerms ?? []).map(
    (row) => row.permission_key as PermissionKey,
  );

  if (tenantId) {
    const { data: tenantPerms, error: tenantError } = await client
      .from('role_permission_sets')
      .select('permission_key')
      .eq('tenant_id', tenantId)
      .eq('role_key', roleKey);

    if (tenantError) return [];
    if (tenantPerms?.length) {
      permissions = tenantPerms.map((row) => row.permission_key as PermissionKey);
    }
  }

  const unique = Array.from(new Set(permissions)) as PermissionKey[];
  const resolved = unique.length > 0 ? unique : getPermissionsForRole(roleKey);
  return remember(resolved);
}

export function clearRuntimePermissionCache(): void {
  cache.clear();
  generation += 1;
}

export function getCachedRuntimePermissions(
  roleKey: RoleKey | null | undefined,
  tenantId: string | null,
  identity?: string,
): readonly PermissionKey[] {
  if (!roleKey) return [];
  if (getServiceMode() !== 'supabase') return getPermissionsForRole(roleKey);
  const cached = identity ? cache.get(cacheKey(tenantId, roleKey, identity)) : null;
  return cached && cached.expiresAt > Date.now() ? cached.permissions : [];
}
