import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { isDemoMode } from '@/lib/supabase/config';
import type {
  ClientPortalCode,
  EmployeePortalAccount,
  LoginAuditEvent,
  PortalAccessPermissions,
  RelativePortalCode,
  TenantUser,
  UserModulePermission,
} from './auth.types';

const tenantUsers = new Map<string, TenantUser[]>();
const employeeAccounts = new Map<string, EmployeePortalAccount[]>();
const clientPortalCodes = new Map<string, ClientPortalCode[]>();
const relativePortalCodes = new Map<string, RelativePortalCode[]>();
const portalPermissions = new Map<string, PortalAccessPermissions[]>();
const modulePermissions = new Map<string, UserModulePermission[]>();
const loginAuditEvents: LoginAuditEvent[] = [];

const passwordHashes = new Map<string, string>();
const portalCodeHashes = new Map<string, string>();

function tenantKey(tenantId: string): string {
  const trimmed = tenantId.trim();
  if (trimmed) return trimmed;
  if (isDemoMode()) return DEMO_TENANT_ID;
  return '__missing_tenant__';
}

export function listTenantUsernames(tenantId: string): string[] {
  return (tenantUsers.get(tenantKey(tenantId)) ?? []).map((entry) => entry.username);
}

export function listEmployeeUsernames(tenantId: string): string[] {
  return (employeeAccounts.get(tenantKey(tenantId)) ?? []).map((entry) => entry.username);
}

export function getTenantUsers(tenantId: string): TenantUser[] {
  return [...(tenantUsers.get(tenantKey(tenantId)) ?? [])];
}

export function getEmployeePortalAccounts(tenantId: string): EmployeePortalAccount[] {
  return [...(employeeAccounts.get(tenantKey(tenantId)) ?? [])];
}

export function listClientPortalUsernames(tenantId: string): string[] {
  return getClientPortalCodes(tenantId).map((entry) => entry.username);
}

export function findClientPortalCodeByUsername(
  tenantId: string,
  username: string,
): ClientPortalCode | undefined {
  return getClientPortalCodes(tenantId).find(
    (entry) => entry.username.toLowerCase() === username.trim().toLowerCase(),
  );
}

export function getClientPortalCodes(tenantId: string): ClientPortalCode[] {
  return [...(clientPortalCodes.get(tenantKey(tenantId)) ?? [])];
}

export function getRelativePortalCodes(tenantId: string): RelativePortalCode[] {
  return [...(relativePortalCodes.get(tenantKey(tenantId)) ?? [])];
}

export function getLoginAuditEvents(tenantId?: string): LoginAuditEvent[] {
  if (!tenantId) {
    return [...loginAuditEvents];
  }
  return loginAuditEvents.filter((entry) => entry.tenantId === tenantId);
}

export function saveTenantUser(user: TenantUser): void {
  const key = tenantKey(user.tenantId);
  const list = tenantUsers.get(key) ?? [];
  const index = list.findIndex((entry) => entry.id === user.id);
  if (index >= 0) {
    list[index] = user;
  } else {
    list.push(user);
  }
  tenantUsers.set(key, list);
}

export function saveEmployeePortalAccount(account: EmployeePortalAccount): void {
  const key = tenantKey(account.tenantId);
  const list = employeeAccounts.get(key) ?? [];
  const index = list.findIndex((entry) => entry.id === account.id);
  if (index >= 0) {
    list[index] = account;
  } else {
    list.push(account);
  }
  employeeAccounts.set(key, list);
}

export function saveClientPortalCode(code: ClientPortalCode): void {
  const key = tenantKey(code.tenantId);
  const list = clientPortalCodes.get(key) ?? [];
  const index = list.findIndex((entry) => entry.id === code.id);
  if (index >= 0) {
    list[index] = code;
  } else {
    list.push(code);
  }
  clientPortalCodes.set(key, list);
}

export function saveRelativePortalCode(code: RelativePortalCode): void {
  const key = tenantKey(code.tenantId);
  const list = relativePortalCodes.get(key) ?? [];
  const index = list.findIndex((entry) => entry.id === code.id);
  if (index >= 0) {
    list[index] = code;
  } else {
    list.push(code);
  }
  relativePortalCodes.set(key, list);
}

export function savePortalPermissions(entry: PortalAccessPermissions): void {
  const key = tenantKey(entry.tenantId);
  const list = portalPermissions.get(key) ?? [];
  const index = list.findIndex((item) => item.id === entry.id);
  if (index >= 0) {
    list[index] = entry;
  } else {
    list.push(entry);
  }
  portalPermissions.set(key, list);
}

export function getModulePermissionsStore(tenantId: string): UserModulePermission[] {
  return [...(modulePermissions.get(tenantKey(tenantId)) ?? [])];
}

export function saveModulePermission(entry: UserModulePermission): void {
  const key = tenantKey(entry.tenantId);
  const list = modulePermissions.get(key) ?? [];
  const index = list.findIndex((item) => item.id === entry.id);
  if (index >= 0) {
    list[index] = entry;
  } else {
    list.push(entry);
  }
  modulePermissions.set(key, list);
}

export function appendLoginAuditEvent(event: LoginAuditEvent): void {
  loginAuditEvents.unshift(event);
  if (loginAuditEvents.length > 500) {
    loginAuditEvents.length = 500;
  }
}

export function setPasswordHash(accountKey: string, hash: string): void {
  passwordHashes.set(accountKey, hash);
}

export function getPasswordHash(accountKey: string): string | undefined {
  return passwordHashes.get(accountKey);
}

export function setPortalCodeHash(codeId: string, hash: string): void {
  if (!hash) {
    portalCodeHashes.delete(codeId);
    return;
  }
  portalCodeHashes.set(codeId, hash);
}

export function getPortalCodeHash(codeId: string): string | undefined {
  return portalCodeHashes.get(codeId);
}

export function findTenantUserByUsername(
  tenantId: string,
  username: string,
): TenantUser | undefined {
  return getTenantUsers(tenantId).find(
    (entry) => entry.username.toLowerCase() === username.toLowerCase(),
  );
}

export function findEmployeeAccountByUsername(
  tenantId: string,
  username: string,
): EmployeePortalAccount | undefined {
  return getEmployeePortalAccounts(tenantId).find(
    (entry) => entry.username.toLowerCase() === username.toLowerCase(),
  );
}

export function resetDemoAccessStore(): void {
  tenantUsers.clear();
  employeeAccounts.clear();
  clientPortalCodes.clear();
  relativePortalCodes.clear();
  portalPermissions.clear();
  modulePermissions.clear();
  loginAuditEvents.length = 0;
  passwordHashes.clear();
  portalCodeHashes.clear();
}
