import { getModulePermissionsStore } from './accessStore';
import type { UserModulePermission } from './auth.types';

export function getModulePermissionsForUser(
  tenantId: string,
  tenantUserId: string,
): UserModulePermission[] {
  return getModulePermissionsStore(tenantId).filter((entry) => entry.tenantUserId === tenantUserId);
}
