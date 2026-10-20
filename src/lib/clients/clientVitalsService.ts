import type { ServiceResult } from '@/types';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, isDemoClientBackend } from './clientBackend';

export type ClientVitalRecord = {
  id: string;
  clientId: string;
  vitalType: string;
  value: string;
  unit?: string;
  recordedAt: string;
  note?: string;
};

export async function fetchClientVitals(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientVitalRecord[]>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return { ok: false, error: 'Live-Vitalwerte: Repository erweitern.' };
    }
    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    const vitals = (full as { vitals?: ClientVitalRecord[] }).vitals ?? [];
    return { ok: true, data: vitals };
  }, { delayMs: 200 });
}

export async function addClientVital(
  tenantId: string,
  clientId: string,
  input: Omit<ClientVitalRecord, 'id' | 'clientId' | 'recordedAt'>,
): Promise<ServiceResult<ClientVitalRecord>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return { ok: false, error: 'Live-Vitalwerte: Repository erweitern.' };
    }
    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const vital: ClientVitalRecord = {
      id: `vital-${clientId}-${Date.now()}`,
      clientId,
      recordedAt: new Date().toISOString(),
      ...input,
    };

    const existing = (full as { vitals?: ClientVitalRecord[] }).vitals ?? [];
    upsertDemoClientFullDetail({
      ...full,
      vitals: [vital, ...existing],
      updatedAt: new Date().toISOString(),
    } as typeof full);

    return { ok: true, data: vital };
  }, { delayMs: 250 });
}
