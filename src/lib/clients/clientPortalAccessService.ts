import type { RoleKey, ServiceResult } from '@/types';
import type {
  ClientPortalAccess,
  ClientPortalCredentialsReveal,
} from '@/types/modules/client';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import {
  hashPortalCode,
  pickUniquePortalCode,
} from '@/lib/auth/portalCodeGenerator';
import {
  pickUniqueClientPortalUsername,
} from '@/lib/auth/clientPortalUsernameGenerator';
import {
  listClientPortalUsernames,
  saveClientPortalCode,
  setPortalCodeHash,
} from '@/lib/auth/accessStore';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

export async function fetchClientPortalAccess(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientPortalAccess[]>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().fetchPortalAccess(tenantId, clientId);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    return { ok: true, data: full.portalAccess };
  }, { delayMs: 200 });
}

async function listExistingPortalUsernames(tenantId: string): Promise<string[]> {
  if (!isDemoClientBackend()) {
    return getClientExtendedRepository().listPortalUsernames(tenantId);
  }
  return listClientPortalUsernames(tenantId);
}

export async function setupClientPortalAccess(input: {
  tenantId: string;
  clientId: string;
  firstName: string;
  lastName: string;
  actorRoleKey: RoleKey | null | undefined;
}): Promise<ServiceResult<{ access: ClientPortalAccess; credentials: ClientPortalCredentialsReveal }>> {
  return runService(async () => {
    const permissionDenied = enforcePermission<{ access: ClientPortalAccess; credentials: ClientPortalCredentialsReveal }>(
      input.actorRoleKey,
      'office.access' as never,
    );
    if (permissionDenied) return permissionDenied;
    const tenantBlock = guardServiceTenant(input.tenantId);
    if (tenantBlock) return tenantBlock;
    const username = pickUniqueClientPortalUsername(
      input.firstName,
      input.lastName,
      await listExistingPortalUsernames(input.tenantId),
    );
    const accessCode = pickUniquePortalCode([]);
    const codeHash = await hashPortalCode(accessCode);
    const now = new Date().toISOString();

    if (!isDemoClientBackend()) {
      const result = await getClientExtendedRepository().setupPortalAccess({
        tenantId: input.tenantId,
        clientId: input.clientId,
        username,
        codeHash,
      });
      if (!result.ok) return result;
      return {
        ok: true,
        data: {
          access: result.data,
          credentials: { username, accessCode },
        },
      };
    }

    const denied = assertDemoTenant(input.tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(input.clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const accessId = `portal-${input.clientId}`;
    const access: ClientPortalAccess = {
      id: accessId,
      tenantId: input.tenantId,
      clientId: input.clientId,
      contactId: null,
      email: null,
      portalUsername: username,
      portalEnabled: true,
      status: 'aktiv',
      lastLoginAt: null,
      invitedAt: null,
      codeCreatedAt: now,
      codeRotatedAt: null,
      modulesEnabled: ['appointments', 'messages', 'documents'],
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    };

    saveClientPortalCode({
      id: accessId,
      tenantId: input.tenantId,
      clientId: input.clientId,
      username,
      status: 'active',
      expiresAt: null,
      lastUsedAt: null,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
      blockedAt: null,
      blockedBy: null,
      blockedReason: null,
      regeneratedAt: null,
    });
    await setPortalCodeHash(accessId, codeHash);

    upsertDemoClientFullDetail({
      ...full,
      portalAccess: [access],
      updatedAt: now,
    });

    return {
      ok: true,
      data: {
        access,
        credentials: { username, accessCode },
      },
    };
  }, { delayMs: 300 });
}

export async function regenerateClientPortalAccessCode(input: {
  tenantId: string;
  clientId: string;
  accessId: string;
  actorRoleKey: RoleKey | null | undefined;
}): Promise<ServiceResult<{ access: ClientPortalAccess; credentials: ClientPortalCredentialsReveal }>> {
  return runService(async () => {
    const permissionDenied = enforcePermission<{ access: ClientPortalAccess; credentials: ClientPortalCredentialsReveal }>(
      input.actorRoleKey,
      'office.access' as never,
    );
    if (permissionDenied) return permissionDenied;
    const tenantBlock = guardServiceTenant(input.tenantId);
    if (tenantBlock) return tenantBlock;
    const accessCode = pickUniquePortalCode([]);
    const codeHash = await hashPortalCode(accessCode);
    const now = new Date().toISOString();

    if (!isDemoClientBackend()) {
      const result = await getClientExtendedRepository().regeneratePortalAccessCode({
        tenantId: input.tenantId,
        clientId: input.clientId,
        accessId: input.accessId,
        codeHash,
      });
      if (!result.ok) return result;
      return {
        ok: true,
        data: {
          access: result.data,
          credentials: {
            username: result.data.portalUsername ?? '',
            accessCode,
          },
        },
      };
    }

    const denied = assertDemoTenant(input.tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(input.clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const existing = full.portalAccess.find((entry) => entry.id === input.accessId);
    if (!existing?.portalUsername) {
      return { ok: false, error: 'Portal-Zugang ist nicht eingerichtet.' };
    }

    await setPortalCodeHash(input.accessId, codeHash);

    const access: ClientPortalAccess = {
      ...existing,
      portalEnabled: true,
      status: 'aktiv',
      codeRotatedAt: now,
      updatedAt: now,
    };

    upsertDemoClientFullDetail({
      ...full,
      portalAccess: full.portalAccess.map((entry) => (entry.id === access.id ? access : entry)),
      updatedAt: now,
    });

    return {
      ok: true,
      data: {
        access,
        credentials: {
          username: existing.portalUsername,
          accessCode,
        },
      },
    };
  }, { delayMs: 300 });
}

/** @deprecated Use setupClientPortalAccess instead */
export async function invitePortalAccess(
  tenantId: string,
  clientId: string,
  email: string,
  contactId?: string,
): Promise<ServiceResult<ClientPortalAccess>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().invitePortalAccess(tenantId, clientId, email, contactId);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const now = new Date().toISOString();
    const access: ClientPortalAccess = {
      id: `portal-${clientId}-${Date.now()}`,
      tenantId,
      clientId,
      contactId: contactId ?? null,
      email,
      portalUsername: null,
      portalEnabled: false,
      status: 'nicht_eingerichtet',
      lastLoginAt: null,
      invitedAt: now,
      codeCreatedAt: null,
      codeRotatedAt: null,
      modulesEnabled: ['appointments', 'messages', 'documents'],
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    };
    upsertDemoClientFullDetail({ ...full, portalAccess: [...full.portalAccess, access], updatedAt: now });
    return { ok: true, data: access };
  }, { delayMs: 300 });
}
