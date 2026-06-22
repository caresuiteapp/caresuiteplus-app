import type { ServiceResult } from '@/types';
import type { RoleKey } from '@/types/core/auth';
import type { PermissionKey } from '@/types/permissions';
import { enforcePermission } from '@/lib/permissions';
import { TENANT_SETTINGS_PERMISSION } from './tenantSettingsRoute';

export const MODULE_HUB_SETTINGS_PERMISSION = 'business.modules.manage' as const;

/** Mandanten-Center oder Modul-Hub dürfen Leistungsbereiche steuern. */
export function canManageTenantModuleSettings(
  roleKey?: RoleKey | null,
): ServiceResult<void> | null {
  const tenantDenied = enforcePermission<void>(roleKey, TENANT_SETTINGS_PERMISSION);
  if (!tenantDenied) return null;

  const hubDenied = enforcePermission<void>(
    roleKey,
    MODULE_HUB_SETTINGS_PERMISSION as PermissionKey,
  );
  if (!hubDenied) return null;

  return tenantDenied;
}
