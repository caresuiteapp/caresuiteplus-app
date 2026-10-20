import type { RoleKey } from '@/types';
import type { PermissionDecision, PermissionKey } from '@/types/permissions';
import {
  getPermissionsForRole,
  PERMISSION_DENIED_MESSAGES,
  PERMISSION_LABELS,
} from '@/lib/permissions/staticRolePermissions';

export function hasPermission(
  roleKey: RoleKey | null | undefined,
  permission: PermissionKey,
): boolean {
  if (!roleKey) return false;
  return getPermissionsForRole(roleKey).includes(permission);
}

export function hasPermissionInList(
  permissions: readonly PermissionKey[],
  permission: PermissionKey,
): boolean {
  return permissions.includes(permission);
}

export function hasAnyPermissionInList(
  permissions: readonly PermissionKey[],
  keys: PermissionKey[],
): boolean {
  return keys.some((key) => permissions.includes(key));
}

export function hasAllPermissionsInList(
  permissions: readonly PermissionKey[],
  keys: PermissionKey[],
): boolean {
  return keys.every((key) => permissions.includes(key));
}

export function checkPermissionWithList(
  roleKey: RoleKey | null | undefined,
  permissions: readonly PermissionKey[],
  permission: PermissionKey,
): PermissionDecision {
  if (!roleKey) {
    return {
      allowed: false,
      reason: 'Sie sind nicht angemeldet. Bitte melden Sie sich an.',
    };
  }
  if (permissions.includes(permission)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason:
      PERMISSION_DENIED_MESSAGES[permission] ??
      `Die Berechtigung „${PERMISSION_LABELS[permission]}" ist für Ihre Rolle nicht freigegeben.`,
  };
}

export function hasAnyPermission(
  roleKey: RoleKey | null | undefined,
  permissions: PermissionKey[],
): boolean {
  return permissions.some((p) => hasPermission(roleKey, p));
}

export function hasAllPermissions(
  roleKey: RoleKey | null | undefined,
  permissions: PermissionKey[],
): boolean {
  return permissions.every((p) => hasPermission(roleKey, p));
}

export function checkPermission(
  roleKey: RoleKey | null | undefined,
  permission: PermissionKey,
): PermissionDecision {
  if (!roleKey) {
    return {
      allowed: false,
      reason: 'Sie sind nicht angemeldet. Bitte melden Sie sich an.',
    };
  }
  if (hasPermission(roleKey, permission)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason:
      PERMISSION_DENIED_MESSAGES[permission] ??
      `Die Berechtigung „${PERMISSION_LABELS[permission]}" ist für Ihre Rolle nicht freigegeben.`,
  };
}

export function permissionError(
  roleKey: RoleKey | null | undefined,
  permission: PermissionKey,
): string | null {
  const decision = checkPermission(roleKey, permission);
  return decision.allowed ? null : (decision.reason ?? 'Keine Berechtigung.');
}
