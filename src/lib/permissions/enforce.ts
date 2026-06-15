import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types/core/auth';
import type { PermissionKey } from '@/types/permissions';
import { permissionError } from './check';

export function enforcePermission<T>(
  roleKey: RoleKey | null | undefined,
  permission: PermissionKey,
): ServiceResult<T> | null {
  const error = permissionError(roleKey, permission);
  if (error) {
    return { ok: false, error };
  }
  return null;
}
