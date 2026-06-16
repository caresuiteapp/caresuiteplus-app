import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import type { RoleKey, ServiceResult } from '@/types';
import type {
  AccessCredentialsReveal,
  ClientPortalCode,
  EmployeePortalAccount,
  InternalRoleKey,
  LoginAuditEvent,
  RelativePortalCode,
  TenantUser,
  UserModulePermission,
} from './auth.types';
import { generateClientPortalCode } from './clientPortalAuthService';
import {
  getClientPortalCodes,
  getEmployeePortalAccounts,
  getLoginAuditEvents,
  getRelativePortalCodes,
  getTenantUsers,
  saveModulePermission,
  saveRelativePortalCode,
  setPortalCodeHash,
} from './demoAccessStore';
import { hashPortalCode, pickUniquePortalCode } from './portalCodeGenerator';
import {
  blockEmployeeAccess,
  generateEmployeeAccess,
  resetEmployeePassword,
  unblockEmployeeAccess,
} from './employeePortalAuthService';
import { generateInternalUserAccess } from './businessAuthService';
import { getModulePermissionsForUser } from './accessManagementHelpers';
import {
  getAccessDashboardStats,
  getDefaultModulePermissionsForRole,
  type AccessDashboardStats,
} from './permissionService';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

export { getAccessDashboardStats };
export type { AccessDashboardStats };

export type RolePermissionProfile = {
  role: InternalRoleKey;
  label: string;
  permissions: UserModulePermission[];
};

const INTERNAL_ROLES: InternalRoleKey[] = [
  'owner',
  'management',
  'pdl',
  'administration',
  'billing',
  'quality_management',
  'team_lead',
  'dispatcher',
  'employee',
  'readonly',
];

async function accessDemoDelay(ms = 180): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchAccessDashboardStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AccessDashboardStats>> {
  const denied = enforcePermission<AccessDashboardStats>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  await accessDemoDelay();
  return { ok: true, data: getAccessDashboardStats(tenantId) };
}

export async function fetchRolePermissionProfiles(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<RolePermissionProfile[]>> {
  const denied = enforcePermission<RolePermissionProfile[]>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  await accessDemoDelay();
  return {
    ok: true,
    data: INTERNAL_ROLES.map((role) => ({
      role,
      label: role.replace(/_/g, ' '),
      permissions: getDefaultModulePermissionsForRole(role),
    })),
  };
}

export function listInternalUsers(tenantId: string = DEMO_TENANT_ID): TenantUser[] {
  return getTenantUsers(tenantId);
}

export function listEmployeePortalAccounts(tenantId: string = DEMO_TENANT_ID): EmployeePortalAccount[] {
  return getEmployeePortalAccounts(tenantId);
}

export function listClientPortalCodes(tenantId: string = DEMO_TENANT_ID): ClientPortalCode[] {
  return getClientPortalCodes(tenantId);
}

export function listRelativePortalCodes(tenantId: string = DEMO_TENANT_ID): RelativePortalCode[] {
  return getRelativePortalCodes(tenantId);
}

export function listAccessAuditEvents(tenantId: string = DEMO_TENANT_ID): LoginAuditEvent[] {
  return getLoginAuditEvents(tenantId);
}

export async function createInternalUser(input: {
  tenantId?: string;
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  roleKey: TenantUser['roleKey'];
  createdBy?: string | null;
}): Promise<ServiceResult<{ user: TenantUser; credentials: AccessCredentialsReveal }>> {
  return generateInternalUserAccess({
    tenantId: input.tenantId ?? DEMO_TENANT_ID,
    companyName: input.companyName,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    roleKey: input.roleKey,
    createdBy: input.createdBy ?? null,
  });
}

export async function createEmployeePortalAccount(input: {
  tenantId?: string;
  companyName: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  createdBy?: string | null;
}): Promise<ServiceResult<{ account: EmployeePortalAccount; credentials: AccessCredentialsReveal }>> {
  return generateEmployeeAccess({
    tenantId: input.tenantId ?? DEMO_TENANT_ID,
    companyName: input.companyName,
    employeeId: input.employeeId,
    firstName: input.firstName,
    lastName: input.lastName,
    createdBy: input.createdBy ?? null,
  });
}

export async function createClientPortalAccess(input: {
  tenantId?: string;
  clientId: string;
  firstName: string;
  lastName: string;
  createdBy?: string | null;
  expiresAt?: string | null;
}) {
  return generateClientPortalCode({
    tenantId: input.tenantId ?? DEMO_TENANT_ID,
    clientId: input.clientId,
    firstName: input.firstName,
    lastName: input.lastName,
    createdBy: input.createdBy ?? null,
    expiresAt: input.expiresAt ?? null,
  });
}

function createPortalCodeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createRelativePortalAccess(input: {
  tenantId?: string;
  clientId: string;
  relativeContactId: string;
  createdBy?: string | null;
  expiresAt?: string | null;
}): Promise<ServiceResult<{ code: RelativePortalCode; credentials: AccessCredentialsReveal }>> {
  const tenantId = input.tenantId ?? DEMO_TENANT_ID;
  const plainCode = pickUniquePortalCode([]);
  const now = new Date().toISOString();
  const code: RelativePortalCode = {
    id: createPortalCodeId('rpc'),
    tenantId,
    clientId: input.clientId,
    relativeContactId: input.relativeContactId,
    status: 'active',
    expiresAt: input.expiresAt ?? null,
    lastUsedAt: null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
    blockedAt: null,
    blockedBy: null,
    blockedReason: null,
    regeneratedAt: null,
  };

  saveRelativePortalCode(code);
  await setPortalCodeHash(code.id, await hashPortalCode(plainCode));

  return {
    ok: true,
    data: {
      code,
      credentials: {
        portalCode: plainCode,
        expiresAt: code.expiresAt,
      },
    },
  };
}

export async function resetEmployeePortalPassword(accountId: string, actorId: string | null) {
  return resetEmployeePassword(accountId, actorId);
}

export async function blockEmployeePortalAccount(
  accountId: string,
  actorId: string | null,
  reason: string,
) {
  return blockEmployeeAccess(accountId, actorId, reason);
}

export async function unblockEmployeePortalAccount(accountId: string) {
  return unblockEmployeeAccess(accountId);
}

export function setUserModulePermissions(
  tenantId: string,
  tenantUserId: string,
  permissions: Omit<UserModulePermission, 'id' | 'tenantId' | 'tenantUserId' | 'createdAt' | 'updatedAt'>[],
): UserModulePermission[] {
  const now = new Date().toISOString();
  return permissions.map((entry, index) => {
    const saved: UserModulePermission = {
      id: `ump-${tenantUserId}-${index}`,
      tenantId,
      tenantUserId,
      moduleKey: entry.moduleKey,
      canView: entry.canView,
      canCreate: entry.canCreate,
      canEdit: entry.canEdit,
      canArchive: entry.canArchive,
      canExport: entry.canExport,
      canManageSettings: entry.canManageSettings,
      createdAt: now,
      updatedAt: now,
    };
    saveModulePermission(saved);
    return saved;
  });
}

export function getUserModulePermissions(
  tenantId: string,
  tenantUserId: string,
): UserModulePermission[] {
  return getModulePermissionsForUser(tenantId, tenantUserId);
}
