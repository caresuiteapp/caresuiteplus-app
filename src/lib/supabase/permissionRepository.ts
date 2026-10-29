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

  // Role keys are unique per tenant, not globally. A visible system definition
  // must not make an equally named tenant role an ambiguous maybeSingle read.
  let roleRow: { id: string } | null = null;
  if (tenantId) {
    const own = await client.from('roles').select('id').eq('key', roleKey).eq('tenant_id', tenantId).maybeSingle();
    if (own.error) return [];
    roleRow = own.data;
  }
  if (!roleRow) {
    const system = await client.from('roles').select('id').eq('key', roleKey).is('tenant_id', null).maybeSingle();
    if (system.error) return [];
    roleRow = system.data;
  }
  let permissions: PermissionKey[] = [];
  if (roleRow?.id) {
    const { data: globalPerms, error: globalError } = await client
      .from('role_permissions')
      .select('permission_key,can_view,can_update,tenant_id')
      .eq('role_id', roleRow.id);
    if (globalError) return [];
    permissions = (globalPerms ?? []).flatMap(row => {
      if (row.tenant_id && row.tenant_id !== tenantId) return [];
      const grants = [row.permission_key as PermissionKey];
      // Match the server's established legacy assignment module flags.
      // Explicit tenant role lists below still replace this complete result.
      if (row.permission_key === 'assignments') {
        if (row.can_view === true) grants.push('assist.assignments.view');
        if (row.can_update === true) grants.push('assist.assignments.manage');
      }
      return grants;
    });
  }

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
