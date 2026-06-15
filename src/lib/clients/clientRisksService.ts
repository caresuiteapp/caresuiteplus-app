import type { ServiceResult } from '@/types';
import type { ClientEmergencyPlan, ClientRisk } from '@/types/modules/client';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';

export async function fetchClientRisks(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<{ risks: ClientRisk[]; emergencyPlan: ClientEmergencyPlan | null }>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().fetchRisks(tenantId, clientId);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    return {
      ok: true,
      data: { risks: full.risks, emergencyPlan: full.emergencyPlan },
    };
  }, { delayMs: 200 });
}

export async function addClientRisk(
  tenantId: string,
  clientId: string,
  input: Omit<ClientRisk, 'id' | 'tenantId' | 'clientId' | 'createdAt' | 'updatedAt'>,
): Promise<ServiceResult<ClientRisk>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().createRisk(tenantId, clientId, input);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const now = new Date().toISOString();
    const risk: ClientRisk = {
      id: `risk-${clientId}-${Date.now()}`,
      tenantId,
      clientId,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    upsertDemoClientFullDetail({ ...full, risks: [...full.risks, risk], updatedAt: now });
    return { ok: true, data: risk };
  }, { delayMs: 250 });
}
