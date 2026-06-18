import type { ServiceResult } from '@/types';
import type { ClientPortalAccess } from '@/types/modules/client';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';

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
      status: 'eingeladen',
      lastLoginAt: null,
      invitedAt: now,
      modulesEnabled: ['appointments', 'messages', 'documents'],
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    };
    upsertDemoClientFullDetail({ ...full, portalAccess: [...full.portalAccess, access], updatedAt: now });
    return { ok: true, data: access };
  }, { delayMs: 300 });
}
