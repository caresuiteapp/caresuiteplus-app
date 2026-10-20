import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { enforcePermission } from '@/lib/permissions';

export const INVENTORY_VIEW: PermissionKey = 'inventory.view';
export const INVENTORY_MANAGE_ITEMS: PermissionKey = 'inventory.manage_items';
export const INVENTORY_ISSUE: PermissionKey = 'inventory.issue';
export const INVENTORY_RETURN_MANAGE: PermissionKey = 'inventory.return_manage';
export const INVENTORY_AUDIT_VIEW: PermissionKey = 'inventory.audit_view';
export const INVENTORY_REPORT_DAMAGE: PermissionKey = 'inventory.report_damage';
export const INVENTORY_OFFBOARDING: PermissionKey = 'inventory.offboarding';
export const PORTAL_EMPLOYEE_INVENTORY_VIEW: PermissionKey = 'portal.employee.inventory.view';

export function enforceInventoryPermission<T>(
  actorRoleKey: RoleKey | null | undefined,
  permission: PermissionKey,
): ServiceResult<T> | null {
  return enforcePermission<T>(actorRoleKey, permission);
}
