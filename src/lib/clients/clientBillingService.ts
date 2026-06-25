import type { Profile, RoleKey, ServiceResult } from '@/types';
import type { ClientBillingProfile, ClientContract } from '@/types/modules/client';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { enforceWithActor } from '@/lib/permissions/actorPermissions';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';

export async function fetchClientBilling(
  tenantId: string,
  clientId: string,
  actorRoleKey?: RoleKey | null,
  actorProfile?: Profile | null,
): Promise<ServiceResult<{ profile: ClientBillingProfile | null; contracts: ClientContract[] }>> {
  return runService(async () => {
    const denied = await enforceWithActor(
      actorRoleKey,
      tenantId,
      actorProfile,
      'clients.billing_profile.view',
    );
    if (denied) return denied;

    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().fetchBilling(tenantId, clientId);
    }

    const tenantErr = assertDemoTenant(tenantId);
    if (tenantErr) return tenantErr;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    return {
      ok: true,
      data: { profile: full.billingProfile, contracts: full.contracts },
    };
  }, { delayMs: 200 });
}

export async function updateClientBillingProfile(
  tenantId: string,
  clientId: string,
  input: Partial<Omit<ClientBillingProfile, 'id' | 'tenantId' | 'clientId' | 'createdAt' | 'updatedAt'>>,
  actorRoleKey?: RoleKey | null,
  actorProfile?: Profile | null,
): Promise<ServiceResult<ClientBillingProfile>> {
  return runService(async () => {
    const denied = await enforceWithActor(
      actorRoleKey,
      tenantId,
      actorProfile,
      'clients.billing_profile.edit',
    );
    if (denied) return denied;

    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().updateBillingProfile(tenantId, clientId, input);
    }

    const tenantErr = assertDemoTenant(tenantId);
    if (tenantErr) return tenantErr;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    if (!full.billingProfile) return { ok: false, error: 'Kein Abrechnungsprofil vorhanden.' };

    const now = new Date().toISOString();
    const updated = { ...full.billingProfile, ...input, updatedAt: now };
    upsertDemoClientFullDetail({ ...full, billingProfile: updated, updatedAt: now });
    return { ok: true, data: updated };
  }, { delayMs: 250 });
}
