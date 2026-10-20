import type { RoleKey } from '@/types';
import type { PermissionKey } from '@/types/permissions';

export const BROADCAST_CREATE_PERMISSION: PermissionKey = 'messages.broadcast.create';

/** Rollen mit impliziter Broadcast-Berechtigung (Geschäftsführung, Verwaltung, Leitung). */
export const BROADCAST_ALLOWED_ROLE_KEYS: ReadonlySet<RoleKey> = new Set([
  'business_admin',
  'business_manager',
  'billing',
  'dispatch',
]);

export function canCreateBroadcast(
  roleKey: RoleKey | null | undefined,
  permissions: readonly PermissionKey[],
): boolean {
  if (!roleKey) return false;
  if (permissions.includes(BROADCAST_CREATE_PERMISSION)) return true;
  return BROADCAST_ALLOWED_ROLE_KEYS.has(roleKey);
}
