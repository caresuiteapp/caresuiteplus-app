import type { RoleKey } from '@/types/core/auth';
import type { EmployeePortalExecutionModule } from '@/types/modules/employeePortalExecution';
import { hasPermission } from '@/lib/permissions/check';

const MODULE_PERMISSIONS: Record<EmployeePortalExecutionModule, string[]> = {
  sis: ['pflege.plans.view'],
  vitals: ['pflege.vitals.view'],
  body_map: ['pflege.plans.view'],
  medication: ['pflege.plans.view'],
  care_report: ['assist.records.create'],
  photos: ['assist.records.create'],
};

export type TenantModuleFlags = Partial<Record<EmployeePortalExecutionModule, boolean>>;

const DEFAULT_TENANT_MODULES: TenantModuleFlags = {
  sis: true,
  vitals: true,
  body_map: false,
  medication: true,
  care_report: true,
  photos: true,
};

export function resolveEnabledExecutionModules(
  roleKey: RoleKey | null,
  tenantModules: TenantModuleFlags = DEFAULT_TENANT_MODULES,
): EmployeePortalExecutionModule[] {
  const modules = Object.keys(MODULE_PERMISSIONS) as EmployeePortalExecutionModule[];
  return modules.filter((module) => {
    if (!tenantModules[module]) return false;
    const required = MODULE_PERMISSIONS[module];
    return required.some((perm) => hasPermission(roleKey, perm as never));
  });
}

export function canCaptureGps(roleKey: RoleKey | null): boolean {
  return hasPermission(roleKey, 'geo.location.capture');
}

export function canUseLiveTracking(roleKey: RoleKey | null): boolean {
  return hasPermission(roleKey, 'geo.live_tracking');
}

export function canViewAccessHints(roleKey: RoleKey | null): boolean {
  return hasPermission(roleKey, 'office.clients.view_sensitive');
}

export function canViewEmergencyContact(roleKey: RoleKey | null): boolean {
  return hasPermission(roleKey, 'office.clients.view_sensitive');
}
