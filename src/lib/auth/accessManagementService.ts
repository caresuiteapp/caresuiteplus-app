import {
  fetchAccessDashboardStatsFromSupabase,
  fetchEmployeePortalAccountsFromSupabase,
  fetchLoginAuditEventsFromSupabase,
  fetchTenantUsersFromSupabase,
} from '@/lib/access/accessManagementLiveRepository';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import type { RoleKey, ServiceResult } from '@/types';
import { getServiceMode } from '@/lib/services/mode';
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
} from './accessStore';
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
import { INTERNAL_ROLE_LABELS } from '@/lib/auth/internalRoleLabels';
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
  if (getServiceMode() === 'supabase') {
    return fetchAccessDashboardStatsFromSupabase(tenantId);
  }
  await accessDemoDelay();
  return { ok: true, data: getAccessDashboardStats(tenantId) };
}

export async function fetchInternalUsersList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantUser[]>> {
  const denied = enforcePermission<TenantUser[]>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() === 'supabase') {
    return fetchTenantUsersFromSupabase(tenantId);
  }
  await accessDemoDelay();
  return { ok: true, data: listInternalUsers(tenantId) };
}

export async function fetchEmployeePortalAccountsList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<EmployeePortalAccount[]>> {
  const denied = enforcePermission<EmployeePortalAccount[]>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() === 'supabase') {
    return fetchEmployeePortalAccountsFromSupabase(tenantId);
  }
  await accessDemoDelay();
  return { ok: true, data: listEmployeePortalAccounts(tenantId) };
}

export async function fetchAccessAuditEventsList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<LoginAuditEvent[]>> {
  const denied = enforcePermission<LoginAuditEvent[]>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (getServiceMode() === 'supabase') {
    return fetchLoginAuditEventsFromSupabase(tenantId);
  }
  await accessDemoDelay();
  return { ok: true, data: listAccessAuditEvents(tenantId) };
}

export async function fetchInternalUserById(
  tenantId: string,
  userId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TenantUser | null>> {
  const denied = enforcePermission<TenantUser | null>(actorRoleKey, 'office.access' as never);
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const { fetchTenantUserById } = await import('@/lib/access/accessManagementLiveRepository');
    return fetchTenantUserById(tenantId, userId);
  }

  await accessDemoDelay();
  const user = listInternalUsers(tenantId).find((entry) => entry.id === userId) ?? null;
  return { ok: true, data: user };
}

export async function fetchEmployeePortalAccountById(
  tenantId: string,
  accountId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<EmployeePortalAccount | null>> {
  const denied = enforcePermission<EmployeePortalAccount | null>(
    actorRoleKey,
    'office.access' as never,
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const { fetchEmployeePortalAccountById: fetchLive } = await import(
      '@/lib/access/accessManagementLiveRepository'
    );
    return fetchLive(tenantId, accountId);
  }

  await accessDemoDelay();
  const account =
    listEmployeePortalAccounts(tenantId).find((entry) => entry.id === accountId) ?? null;
  return { ok: true, data: account };
}

export async function fetchEmployeePortalAccountByEmployeeId(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<EmployeePortalAccount | null>> {
  const denied = enforcePermission<EmployeePortalAccount | null>(
    actorRoleKey,
    'office.access' as never,
  );
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const { fetchEmployeePortalAccountByEmployeeId: fetchLive } = await import(
      '@/lib/access/accessManagementLiveRepository'
    );
    return fetchLive(tenantId, employeeId);
  }

  await accessDemoDelay();
  const account =
    listEmployeePortalAccounts(tenantId).find((entry) => entry.employeeId === employeeId) ?? null;
  return { ok: true, data: account };
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
      label: INTERNAL_ROLE_LABELS[role],
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
  firstName?: string;
  lastName?: string;
  createdBy?: string | null;
  expiresAt?: string | null;
}) {
  return generateClientPortalCode({
    tenantId: input.tenantId ?? DEMO_TENANT_ID,
    clientId: input.clientId,
    firstName: input.firstName ?? 'Klient',
    lastName: input.lastName ?? 'X',
    createdBy: input.createdBy ?? null,
    expiresAt: input.expiresAt ?? null,
  });
}


export async function createRelativePortalAccess(input: {
  tenantId?: string;
  clientId: string;
  relativeContactId: string;
  createdBy?: string | null;
  expiresAt?: string | null;
}): Promise<ServiceResult<{ code: RelativePortalCode; credentials: AccessCredentialsReveal }>> {
  const { setupRelativePortalAccess } = await import('@/lib/access/relativePortalAccessService');
  return setupRelativePortalAccess({
    tenantId: input.tenantId ?? DEMO_TENANT_ID,
    clientId: input.clientId,
    relativeContactId: input.relativeContactId,
    createdBy: input.createdBy ?? null,
    expiresAt: input.expiresAt ?? null,
  });
}

export async function resetEmployeePortalPassword(
  accountId: string,
  actorId: string | null,
  tenantId: string,
) {
  return resetEmployeePassword(accountId, actorId, tenantId);
}

export async function blockEmployeePortalAccount(
  accountId: string,
  actorId: string | null,
  reason: string,
  tenantId: string,
) {
  return blockEmployeeAccess(accountId, actorId, reason, tenantId);
}

export async function unblockEmployeePortalAccount(accountId: string, tenantId: string) {
  return unblockEmployeeAccess(accountId, tenantId);
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
