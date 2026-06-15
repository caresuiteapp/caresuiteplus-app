import type { ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { getServiceMode } from '@/lib/services/mode';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import type { PortalSessionRecord } from './portalSessionStore';
import type { AccessCredentialsReveal, EmployeePortalAccount } from './auth.types';
import {
  findEmployeeAccountByUsername,
  getEmployeePortalAccounts,
  getPasswordHash,
  listEmployeeUsernames,
  saveEmployeePortalAccount,
  setPasswordHash,
} from './demoAccessStore';
import { recordLoginAuditEvent } from './loginAuditService';
import { hashSecret, verifySecret } from './passwordHash';
import {
  createTemporaryPasswordRecord,
  generateTemporaryPassword,
  validatePermanentPassword,
  verifyTemporaryPassword,
} from './temporaryPassword';
import { pickUniqueUsername } from './usernameGenerator';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const tempPasswordRecords = new Map<string, Awaited<ReturnType<typeof createTemporaryPasswordRecord>>>();

export async function generateEmployeeAccess(input: {
  tenantId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  companyName: string;
  createdBy: string | null;
}): Promise<ServiceResult<{ account: EmployeePortalAccount; credentials: AccessCredentialsReveal }>> {
  const username = pickUniqueUsername(
    input.companyName,
    input.firstName,
    input.lastName,
    listEmployeeUsernames(input.tenantId),
  );
  const oneTimePassword = generateTemporaryPassword();
  const tempRecord = await createTemporaryPasswordRecord(oneTimePassword);

  const account: EmployeePortalAccount = {
    id: createId('epa'),
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    username,
    status: 'pending_first_login',
    mustChangePassword: true,
    firstLoginCompleted: false,
    temporaryPasswordCreatedAt: tempRecord.createdAt,
    temporaryPasswordExpiresAt: tempRecord.expiresAt,
    lastLoginAt: null,
    createdBy: input.createdBy,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    blockedAt: null,
    blockedBy: null,
    blockedReason: null,
  };

  saveEmployeePortalAccount(account);
  tempPasswordRecords.set(account.id, tempRecord);
  await setPasswordHash(`employee:${account.id}`, tempRecord.hash);

  return {
    ok: true,
    data: {
      account,
      credentials: { username, oneTimePassword },
    },
  };
}

export async function loginEmployeePortal(
  username: string,
  password: string,
): Promise<
  ServiceResult<{
    account: EmployeePortalAccount;
    mustChangePassword: boolean;
    portalSession?: PortalSessionRecord;
  }>
> {
  if (getServiceMode() === 'supabase') {
    const login = await invokeEdgeFunction<{
      account: EmployeePortalAccount;
      mustChangePassword: boolean;
      sessionToken: string;
      expiresAt: string;
    }>('employee-portal-login', { username, password });

    if (!login.ok) {
      return { ok: false, error: login.error };
    }

    const portalSession: PortalSessionRecord = {
      sessionToken: login.data.sessionToken,
      tenantId: login.data.account.tenantId,
      loginType: 'employee_portal',
      roleKey: 'employee_portal',
      expiresAt: login.data.expiresAt,
      accountId: login.data.account.id,
      employeeId: login.data.account.employeeId,
    };

    return {
      ok: true,
      data: {
        account: login.data.account,
        mustChangePassword: login.data.mustChangePassword,
        portalSession,
      },
    };
  }

  const tenantId = DEMO_TENANT_ID;
  const account = findEmployeeAccountByUsername(tenantId, username.trim());

  if (!account || account.status === 'blocked' || account.status === 'archived') {
    await recordLoginAuditEvent({
      tenantId,
      loginType: 'employee_portal',
      accountId: account?.id ?? null,
      usernameOrCodeHint: username.trim(),
      success: false,
      failureReason: 'Zugang gesperrt oder unbekannt.',
    });
    return {
      ok: false,
      error: account?.status === 'blocked'
        ? 'Zugang gesperrt. Bitte wenden Sie sich an die Verwaltung.'
        : 'Benutzername oder Passwort ist falsch.',
    };
  }

  const hash = getPasswordHash(`employee:${account.id}`);
  const tempRecord = tempPasswordRecords.get(account.id) ?? {
    hash: hash ?? '',
    createdAt: account.temporaryPasswordCreatedAt ?? nowIso(),
    expiresAt: account.temporaryPasswordExpiresAt,
    consumedAt: account.firstLoginCompleted ? nowIso() : null,
  };

  const tempCheck = await verifyTemporaryPassword(password, tempRecord);
  const permanentValid = hash ? await verifySecret(password, hash) : false;

  if (!tempCheck.ok && !permanentValid) {
    await recordLoginAuditEvent({
      tenantId,
      loginType: 'employee_portal',
      accountId: account.id,
      usernameOrCodeHint: username.trim(),
      success: false,
      failureReason: tempCheck.ok ? null : tempCheck.reason,
    });
    return { ok: false, error: 'Benutzername oder Passwort ist falsch.' };
  }

  account.lastLoginAt = nowIso();
  saveEmployeePortalAccount(account);

  await recordLoginAuditEvent({
    tenantId,
    loginType: 'employee_portal',
    accountId: account.id,
    usernameOrCodeHint: username.trim(),
    success: true,
    failureReason: null,
  });

  return {
    ok: true,
    data: {
      account,
      mustChangePassword: account.mustChangePassword || !account.firstLoginCompleted,
    },
  };
}

export async function completeFirstLogin(input: {
  accountId: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ServiceResult<EmployeePortalAccount>> {
  const validationError = validatePermanentPassword(input.newPassword, input.confirmPassword);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const tenantId = DEMO_TENANT_ID;
  const account = findEmployeeAccountByUsername(tenantId, input.accountId) ??
    getEmployeeAccountById(tenantId, input.accountId);

  if (!account) {
    return { ok: false, error: 'Zugang nicht gefunden.' };
  }

  const hash = getPasswordHash(`employee:${account.id}`);
  const tempRecord = tempPasswordRecords.get(account.id);
  const tempCheck = tempRecord
    ? await verifyTemporaryPassword(input.currentPassword, tempRecord)
    : { ok: false, reason: 'Kein Einmalpasswort.' };

  const permanentValid = hash ? await verifySecret(input.currentPassword, hash) : false;
  if (!tempCheck.ok && !permanentValid) {
    return { ok: false, error: 'Aktuelles Passwort ist ungültig.' };
  }

  account.mustChangePassword = false;
  account.firstLoginCompleted = true;
  account.status = 'active';
  account.updatedAt = nowIso();
  account.temporaryPasswordExpiresAt = null;

  if (tempRecord) {
    tempRecord.consumedAt = nowIso();
    tempPasswordRecords.set(account.id, tempRecord);
  }

  await setPasswordHash(`employee:${account.id}`, await hashSecret(input.newPassword));
  saveEmployeePortalAccount(account);

  return { ok: true, data: account };
}

function getEmployeeAccountById(tenantId: string, accountId: string): EmployeePortalAccount | undefined {
  return getEmployeePortalAccounts(tenantId).find((entry) => entry.id === accountId);
}

export async function resetEmployeePassword(
  accountId: string,
  actorId: string | null,
): Promise<ServiceResult<AccessCredentialsReveal>> {
  const tenantId = DEMO_TENANT_ID;
  const account = getEmployeeAccountById(tenantId, accountId);
  if (!account) {
    return { ok: false, error: 'Zugang nicht gefunden.' };
  }

  const oneTimePassword = generateTemporaryPassword();
  const tempRecord = await createTemporaryPasswordRecord(oneTimePassword);

  account.mustChangePassword = true;
  account.firstLoginCompleted = false;
  account.status = 'password_reset_required';
  account.temporaryPasswordCreatedAt = tempRecord.createdAt;
  account.temporaryPasswordExpiresAt = tempRecord.expiresAt;
  account.updatedAt = nowIso();
  account.blockedAt = null;
  account.blockedBy = actorId;
  account.blockedReason = null;

  tempPasswordRecords.set(account.id, tempRecord);
  await setPasswordHash(`employee:${account.id}`, tempRecord.hash);
  saveEmployeePortalAccount(account);

  return {
    ok: true,
    data: {
      username: account.username,
      oneTimePassword,
    },
  };
}

export async function blockEmployeeAccess(
  accountId: string,
  actorId: string | null,
  reason: string,
): Promise<ServiceResult<EmployeePortalAccount>> {
  const account = getEmployeeAccountById(DEMO_TENANT_ID, accountId);
  if (!account) {
    return { ok: false, error: 'Zugang nicht gefunden.' };
  }

  account.status = 'blocked';
  account.blockedAt = nowIso();
  account.blockedBy = actorId;
  account.blockedReason = reason;
  account.updatedAt = nowIso();
  saveEmployeePortalAccount(account);
  return { ok: true, data: account };
}

export async function unblockEmployeeAccess(
  accountId: string,
): Promise<ServiceResult<EmployeePortalAccount>> {
  const account = getEmployeeAccountById(DEMO_TENANT_ID, accountId);
  if (!account) {
    return { ok: false, error: 'Zugang nicht gefunden.' };
  }

  account.status = account.firstLoginCompleted ? 'active' : 'pending_first_login';
  account.blockedAt = null;
  account.blockedBy = null;
  account.blockedReason = null;
  account.updatedAt = nowIso();
  saveEmployeePortalAccount(account);
  return { ok: true, data: account };
}
