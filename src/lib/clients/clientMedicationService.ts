import type { ServiceResult } from '@/types';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, isDemoClientBackend } from './clientBackend';

export type ClientMedicationRecord = {
  id: string;
  clientId: string;
  name: string;
  activeSubstance?: string;
  form?: string;
  dosage?: string;
  unit?: string;
  scheduleSchema?: string;
  asNeeded?: boolean;
  startDate?: string;
  endDate?: string;
  doctor?: string;
  note?: string;
  status: string;
};

export async function fetchClientMedications(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientMedicationRecord[]>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return { ok: false, error: 'Live-Medikation: Repository erweitern.' };
    }
    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    const meds = (full as { medications?: ClientMedicationRecord[] }).medications ?? [];
    return { ok: true, data: meds };
  }, { delayMs: 200 });
}

export async function addClientMedication(
  tenantId: string,
  clientId: string,
  input: Omit<ClientMedicationRecord, 'id' | 'clientId' | 'status'>,
): Promise<ServiceResult<ClientMedicationRecord>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return { ok: false, error: 'Live-Medikation: Repository erweitern.' };
    }
    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const med: ClientMedicationRecord = {
      id: `med-${clientId}-${Date.now()}`,
      clientId,
      status: 'aktiv',
      ...input,
    };

    const existing = (full as { medications?: ClientMedicationRecord[] }).medications ?? [];
    upsertDemoClientFullDetail({
      ...full,
      medications: [med, ...existing],
      updatedAt: new Date().toISOString(),
    } as typeof full);

    return { ok: true, data: med };
  }, { delayMs: 250 });
}
