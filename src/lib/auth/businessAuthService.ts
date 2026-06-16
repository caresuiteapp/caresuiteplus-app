import type { Session } from '@supabase/supabase-js';
import type { ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { activateRegistrationModules } from '@/lib/billing/moduleActivationService';
import { hydrateTenantModulesFromSupabase } from '@/lib/modules/moduleAccessService';
import { getServiceMode } from '@/lib/services/mode';
import { signInWithPassword } from '@/lib/supabase/authService';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import type {
  AccessCredentialsReveal,
  BusinessRegistrationInput,
  TenantUser,
} from './auth.types';
import {
  findTenantUserByUsername,
  getPasswordHash,
  getTenantUsers,
  listTenantUsernames,
  saveTenantUser,
  setPasswordHash,
} from './demoAccessStore';
import { recordLoginAuditEvent } from './loginAuditService';
import { hashSecret, verifySecret } from './passwordHash';
import { generateTemporaryPassword } from './temporaryPassword';
import { pickUniqueUsername } from './usernameGenerator';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function registerBusinessTenant(
  input: BusinessRegistrationInput,
): Promise<ServiceResult<{ tenantId: string; owner: TenantUser; credentials?: AccessCredentialsReveal }>> {
  if (getServiceMode() === 'supabase') {
    const registration = await invokeEdgeFunction<{
      tenantId: string;
      owner: {
        id: string;
        tenantId: string;
        username: string;
        roleKey: TenantUser['roleKey'];
        email: string;
        displayName: string;
      };
      credentials: { username: string };
    }>('register-business-tenant', { ...input });

    if (!registration.ok) {
      return { ok: false, error: registration.error };
    }

    const signIn = await signInWithPassword(input.adminEmail.trim(), input.adminPassword);
    if (!signIn.ok) {
      return {
        ok: false,
        error: `Mandant angelegt, Anmeldung fehlgeschlagen: ${signIn.error}`,
      };
    }

    await hydrateTenantModulesFromSupabase(registration.data.tenantId);

    const owner: TenantUser = {
      id: registration.data.owner.id,
      tenantId: registration.data.owner.tenantId,
      authUserId: signIn.data.user.id,
      employeeId: null,
      displayName: registration.data.owner.displayName,
      firstName: input.adminFirstName.trim(),
      lastName: input.adminLastName.trim(),
      email: registration.data.owner.email,
      username: registration.data.owner.username,
      roleKey: registration.data.owner.roleKey,
      status: 'active',
      mustChangePassword: false,
      firstLoginCompleted: true,
      lastLoginAt: nowIso(),
      lastPasswordChangeAt: nowIso(),
      createdBy: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      archivedAt: null,
    };

    return {
      ok: true,
      data: {
        tenantId: registration.data.tenantId,
        owner,
        credentials: registration.data.credentials,
      },
    };
  }

  const tenantId = DEMO_TENANT_ID;
  const username = pickUniqueUsername(
    input.companyName,
    input.adminFirstName,
    input.adminLastName,
    listTenantUsernames(tenantId),
  );

  const owner: TenantUser = {
    id: createId('tu'),
    tenantId,
    authUserId: null,
    employeeId: null,
    displayName: `${input.adminFirstName.trim()} ${input.adminLastName.trim()}`,
    firstName: input.adminFirstName.trim(),
    lastName: input.adminLastName.trim(),
    email: input.adminEmail.trim().toLowerCase(),
    username,
    roleKey: 'owner',
    status: 'active',
    mustChangePassword: false,
    firstLoginCompleted: true,
    lastLoginAt: null,
    lastPasswordChangeAt: nowIso(),
    createdBy: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    archivedAt: null,
  };

  saveTenantUser(owner);
  await setPasswordHash(`tenant-user:${owner.id}`, await hashSecret(input.adminPassword));
  activateRegistrationModules(tenantId, input.selectedModules);

  return {
    ok: true,
    data: {
      tenantId,
      owner,
      credentials: {
        username,
      },
    },
  };
}

export async function loginBusinessUser(
  identifier: string,
  password: string,
): Promise<
  ServiceResult<{
    tenantUser?: TenantUser;
    loginType: 'business';
    mustChangePassword: boolean;
    supabaseSession?: Session;
  }>
> {
  const normalized = identifier.trim().toLowerCase();

  if (getServiceMode() === 'supabase') {
    const sessionResult = await signInWithPassword(identifier.trim(), password);
    if (!sessionResult.ok) {
      await recordLoginAuditEvent({
        tenantId: null,
        loginType: 'business',
        accountId: null,
        usernameOrCodeHint: normalized,
        success: false,
        failureReason: sessionResult.error,
      });
      return { ok: false, error: sessionResult.error };
    }

    await recordLoginAuditEvent({
      tenantId: null,
      loginType: 'business',
      accountId: sessionResult.data.user.id,
      usernameOrCodeHint: normalized,
      success: true,
      failureReason: null,
    });

    return {
      ok: true,
      data: {
        loginType: 'business',
        mustChangePassword: false,
        supabaseSession: sessionResult.data,
      },
    };
  }

  const tenantId = DEMO_TENANT_ID;
  const tenantUser =
    findTenantUserByUsername(tenantId, normalized) ??
    getTenantUsersFallbackByEmail(tenantId, normalized);

  if (!tenantUser || tenantUser.status === 'blocked' || tenantUser.status === 'archived') {
    await recordLoginAuditEvent({
      tenantId,
      loginType: 'business',
      accountId: tenantUser?.id ?? null,
      usernameOrCodeHint: normalized,
      success: false,
      failureReason: 'Zugang gesperrt oder unbekannt.',
    });
    return {
      ok: false,
      error: tenantUser?.status === 'blocked'
        ? 'Zugang gesperrt. Bitte wenden Sie sich an die Verwaltung.'
        : 'Benutzername, E-Mail oder Passwort ist falsch.',
    };
  }

  const hash = getPasswordHash(`tenant-user:${tenantUser.id}`);
  if (!hash || !(await verifySecret(password, hash))) {
    await recordLoginAuditEvent({
      tenantId,
      loginType: 'business',
      accountId: tenantUser.id,
      usernameOrCodeHint: normalized,
      success: false,
      failureReason: 'Ungültiges Passwort.',
    });
    return { ok: false, error: 'Benutzername, E-Mail oder Passwort ist falsch.' };
  }

  tenantUser.lastLoginAt = nowIso();
  saveTenantUser(tenantUser);

  await recordLoginAuditEvent({
    tenantId,
    loginType: 'business',
    accountId: tenantUser.id,
    usernameOrCodeHint: normalized,
    success: true,
    failureReason: null,
  });

  return {
    ok: true,
    data: {
      tenantUser,
      loginType: 'business',
      mustChangePassword: tenantUser.mustChangePassword,
    },
  };
}

function getTenantUsersFallbackByEmail(tenantId: string, email: string): TenantUser | undefined {
  return getTenantUsers(tenantId).find((entry) => entry.email.toLowerCase() === email);
}

export async function generateInternalUserAccess(input: {
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  roleKey: TenantUser['roleKey'];
  createdBy: string | null;
}): Promise<ServiceResult<{ user: TenantUser; credentials: AccessCredentialsReveal }>> {
  const username = pickUniqueUsername(
    input.companyName,
    input.firstName,
    input.lastName,
    listTenantUsernames(input.tenantId),
  );
  const oneTimePassword = generateTemporaryPassword();

  const user: TenantUser = {
    id: createId('tu'),
    tenantId: input.tenantId,
    authUserId: null,
    employeeId: null,
    displayName: `${input.firstName.trim()} ${input.lastName.trim()}`,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    username,
    roleKey: input.roleKey,
    status: 'pending_first_login',
    mustChangePassword: true,
    firstLoginCompleted: false,
    lastLoginAt: null,
    lastPasswordChangeAt: null,
    createdBy: input.createdBy,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    archivedAt: null,
  };

  saveTenantUser(user);
  await setPasswordHash(`tenant-user:${user.id}`, await hashSecret(oneTimePassword));

  return {
    ok: true,
    data: {
      user,
      credentials: {
        username,
        oneTimePassword,
      },
    },
  };
}
