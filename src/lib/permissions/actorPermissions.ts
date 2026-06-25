import type { Profile, RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { getServiceMode } from '@/lib/services/mode';
import type { PermissionEnforcementContext } from './enforce';
import { enforcePermission } from './enforce';
import { resolveEffectivePermissions, resolveEffectivePermissionsSync } from './rbacService';
import { getPermissionsForRole } from './staticRolePermissions';

export async function getActorEffectivePermissions(
  profile: Profile | null | undefined,
  tenantId: string,
): Promise<PermissionKey[]> {
  const roleKey = profile?.roleKey ?? null;
  if (!roleKey) return [];

  const employeeId = profile?.employeeId ?? null;
  if (employeeId && tenantId) {
    if (getServiceMode() !== 'supabase') {
      return resolveEffectivePermissionsSync(tenantId, employeeId, roleKey).permissions;
    }
    const result = await resolveEffectivePermissions(tenantId, employeeId, roleKey);
    if (result.ok) return result.data.permissions;
  }

  return [...getPermissionsForRole(roleKey)];
}

export function getActorEffectivePermissionsSync(
  profile: Profile | null | undefined,
  tenantId: string,
): PermissionKey[] {
  const roleKey = profile?.roleKey ?? null;
  if (!roleKey) return [];

  const employeeId = profile?.employeeId ?? null;
  if (employeeId && tenantId) {
    return resolveEffectivePermissionsSync(tenantId, employeeId, roleKey).permissions;
  }

  return [...getPermissionsForRole(roleKey)];
}

export async function buildEnforcementContext(
  profile: Profile | null | undefined,
  tenantId: string,
): Promise<PermissionEnforcementContext> {
  return { effectivePermissions: await getActorEffectivePermissions(profile, tenantId) };
}

export function buildEnforcementContextSync(
  profile: Profile | null | undefined,
  tenantId: string,
): PermissionEnforcementContext {
  return { effectivePermissions: getActorEffectivePermissionsSync(profile, tenantId) };
}

export async function enforceWithActor<T = never>(
  roleKey: RoleKey | null | undefined,
  tenantId: string | undefined,
  profile: Profile | null | undefined,
  permission: PermissionKey,
): Promise<ServiceResult<T> | null> {
  if (profile?.employeeId && tenantId) {
    const ctx = await buildEnforcementContext(profile, tenantId);
    return enforcePermission(roleKey ?? profile.roleKey, permission, ctx);
  }
  return enforcePermission(roleKey, permission);
}

export function enforceWithActorSync<T = never>(
  roleKey: RoleKey | null | undefined,
  tenantId: string | undefined,
  profile: Profile | null | undefined,
  permission: PermissionKey,
): ServiceResult<T> | null {
  if (profile?.employeeId && tenantId) {
    const ctx = buildEnforcementContextSync(profile, tenantId);
    return enforcePermission(roleKey ?? profile.roleKey, permission, ctx);
  }
  return enforcePermission(roleKey, permission);
}
