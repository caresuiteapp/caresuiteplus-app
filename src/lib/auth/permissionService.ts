import type { InternalRoleKey, UserModulePermission } from './auth.types';
import { getPermissionsForRole } from '@/lib/permissions/staticRolePermissions';
import type { PermissionKey } from '@/types/permissions';
import { getTenantUsers, getEmployeePortalAccounts, getClientPortalCodes, getRelativePortalCodes, getLoginAuditEvents } from './accessStore';

export type AccessDashboardStats = {
  internalUsers: number;
  employeeAccounts: number;
  activePortalCodes: number;
  blockedAccesses: number;
  pendingFirstLogins: number;
  recentLogins: number;
};

export function getAccessDashboardStats(tenantId: string): AccessDashboardStats {
  const internalUsers = getTenantUsers(tenantId);
  const employeeAccounts = getEmployeePortalAccounts(tenantId);
  const portalCodes = [...getClientPortalCodes(tenantId), ...getRelativePortalCodes(tenantId)];

  const blockedAccesses =
    internalUsers.filter((entry) => entry.status === 'blocked').length +
    employeeAccounts.filter((entry) => entry.status === 'blocked').length +
    portalCodes.filter((entry) => entry.status === 'blocked').length;

  const pendingFirstLogins =
    internalUsers.filter((entry) => !entry.firstLoginCompleted).length +
    employeeAccounts.filter((entry) => !entry.firstLoginCompleted).length;

  const recentLogins = getLoginAuditEvents(tenantId).filter((entry) => entry.success).length;

  return {
    internalUsers: internalUsers.length,
    employeeAccounts: employeeAccounts.length,
    activePortalCodes: portalCodes.filter((entry) => entry.status === 'active').length,
    blockedAccesses,
    pendingFirstLogins,
    recentLogins,
  };
}

const ROLE_MODULE_DEFAULTS: Record<InternalRoleKey, Partial<Record<UserModulePermission['moduleKey'], Partial<UserModulePermission>>>> = {
  owner: {},
  management: {},
  pdl: {
    office: { canView: true },
    pflege: { canView: true, canEdit: true },
    assist: { canView: true },
    qm: { canView: true, canEdit: true },
  },
  administration: {
    office: { canView: true, canEdit: true },
  },
  billing: {
    office: { canView: true },
    settings: { canView: false, canManageSettings: false },
  },
  quality_management: {
    office: { canView: true },
    qm: { canView: true, canEdit: true },
  },
  team_lead: {
    office: { canView: true },
    assist: { canView: true, canEdit: true },
  },
  dispatcher: {
    office: { canView: true },
    assist: { canView: true, canEdit: true },
  },
  employee: {},
  readonly: {
    office: { canView: true },
  },
};

export function getDefaultModulePermissionsForRole(roleKey: InternalRoleKey): UserModulePermission[] {
  const defaults = ROLE_MODULE_DEFAULTS[roleKey] ?? {};
  const now = new Date().toISOString();

  return Object.entries(defaults).map(([moduleKey, permissions]) => ({
    id: `ump-${roleKey}-${moduleKey}`,
    tenantId: 'demo',
    tenantUserId: 'template',
    moduleKey: moduleKey as UserModulePermission['moduleKey'],
    canView: permissions.canView ?? false,
    canCreate: permissions.canCreate ?? false,
    canEdit: permissions.canEdit ?? false,
    canArchive: permissions.canArchive ?? false,
    canExport: permissions.canExport ?? false,
    canManageSettings: permissions.canManageSettings ?? false,
    createdAt: now,
    updatedAt: now,
  }));
}

export function roleHasPermission(roleKey: InternalRoleKey, permission: PermissionKey): boolean {
  const mappedRole =
    roleKey === 'owner' || roleKey === 'management'
      ? 'business_admin'
      : roleKey === 'billing'
        ? 'billing'
        : roleKey === 'employee'
          ? 'employee_portal'
          : 'business_manager';

  return getPermissionsForRole(mappedRole).includes(permission);
}

export function billingCanViewInvoices(roleKey: InternalRoleKey): boolean {
  return roleKey === 'billing' || roleKey === 'owner' || roleKey === 'management';
}

export function pdlCanViewCareDocumentation(roleKey: InternalRoleKey): boolean {
  return roleKey === 'pdl' || roleKey === 'owner' || roleKey === 'management';
}

export function employeeCanViewOnlyOwnAssignments(roleKey: InternalRoleKey): boolean {
  return roleKey === 'employee';
}
