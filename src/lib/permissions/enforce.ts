import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types/core/auth';
import type { PermissionKey } from '@/types/permissions';
import { checkPermissionWithList, permissionError } from './check';

export type PermissionEnforcementContext = {
  effectivePermissions?: readonly PermissionKey[];
};

export function enforcePermission<T = never>(
  roleKey: RoleKey | null | undefined,
  permission: PermissionKey,
  context?: PermissionEnforcementContext,
): ServiceResult<T> | null {
  if (context?.effectivePermissions) {
    const decision = checkPermissionWithList(roleKey, context.effectivePermissions, permission);
    if (!decision.allowed) {
      return { ok: false, error: decision.reason ?? 'Keine Berechtigung.' };
    }
    return null;
  }

  const error = permissionError(roleKey, permission);
  if (error) {
    return { ok: false, error };
  }
  return null;
}
