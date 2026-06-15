import type { ServiceResult } from '@/types';
import type { ClientBillingProfile, ClientContract } from '@/types/modules/client';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';

export async function fetchClientBilling(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<{ profile: ClientBillingProfile | null; contracts: ClientContract[] }>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().fetchBilling(tenantId, clientId);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
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
): Promise<ServiceResult<ClientBillingProfile>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().updateBillingProfile(tenantId, clientId, input);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    if (!full.billingProfile) return { ok: false, error: 'Kein Abrechnungsprofil vorhanden.' };

    const now = new Date().toISOString();
    const updated = { ...full.billingProfile, ...input, updatedAt: now };
    upsertDemoClientFullDetail({ ...full, billingProfile: updated, updatedAt: now });
    return { ok: true, data: updated };
  }, { delayMs: 250 });
}
