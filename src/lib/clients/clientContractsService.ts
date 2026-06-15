import type { ServiceResult } from '@/types';
import type { ClientContract } from '@/types/modules/client';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, isDemoClientBackend } from './clientBackend';

export async function fetchClientContracts(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientContract[]>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return { ok: false, error: 'Live-Verträge: Repository erweitern.' };
    }
    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    return { ok: true, data: full.contracts ?? [] };
  }, { delayMs: 200 });
}

export async function createContractFromTemplate(
  tenantId: string,
  clientId: string,
  contractType: string,
): Promise<ServiceResult<ClientContract>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return { ok: false, error: 'Live-Verträge: Repository erweitern.' };
    }
    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const now = new Date().toISOString();
    const contract: ClientContract = {
      id: `contract-${clientId}-${Date.now()}`,
      tenantId,
      clientId,
      contractNumber: `V-${Date.now().toString().slice(-6)}`,
      contractStart: now.slice(0, 10),
      contractEnd: null,
      serviceType: 'betreuung',
      hourlyRateCents: full.billingProfile?.hourlyRateCents ?? 3800,
      weeklyHours: null,
      status: 'aktiv',
      signedAt: null,
      documentId: null,
      notes: `Aus Vorlage: ${contractType}`,
      createdAt: now,
      updatedAt: now,
    };

    upsertDemoClientFullDetail({
      ...full,
      contracts: [contract, ...(full.contracts ?? [])],
      updatedAt: now,
    });

    return { ok: true, data: contract };
  }, { delayMs: 300 });
}
