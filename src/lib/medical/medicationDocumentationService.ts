import type { RoleKey, ServiceResult } from '@/types';
import type { MedicationDocumentationHint, MedicationMasterDataRecord } from '@/types/medical';
import {
  MEDICAL_DOCUMENTATION_DISCLAIMER,
  MEDICAL_MEDICATION_HINT_PREFIX,
} from '@/types/medical';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

const demoMedicationRecords: MedicationMasterDataRecord[] = [];

export function buildMedicationDocumentationHint(drugName: string): MedicationDocumentationHint {
  return {
    kind: 'informative',
    noMedicalDecision: true,
    message: `${MEDICAL_MEDICATION_HINT_PREFIX} ${drugName} ist als Stammdatenreferenz erfasst. ${MEDICAL_DOCUMENTATION_DISCLAIMER}`,
  };
}

/** Medikation als Stammdatenübersicht dokumentieren — keine Verordnung. */
export async function documentMedicationAsMasterData(
  tenantId: string,
  input: {
    clientId: string;
    documentedName: string;
    dosageNote?: string;
  },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<MedicationMasterDataRecord>> {
  const denied = enforcePermission<MedicationMasterDataRecord>(actorRoleKey, 'pflege.plans.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!input.documentedName.trim()) {
    return { ok: false, error: 'Medikationsbezeichnung ist erforderlich.' };
  }

  await new Promise((resolve) => setTimeout(resolve, 80));

  const record: MedicationMasterDataRecord = {
    id: `med-doc-${Date.now()}`,
    tenantId,
    clientId: input.clientId,
    documentedName: input.documentedName.trim(),
    dosageNote: input.dosageNote?.trim() ?? null,
    sourceAttribution: 'master_data',
    hint: buildMedicationDocumentationHint(input.documentedName.trim()),
    recordedAt: new Date().toISOString(),
  };

  demoMedicationRecords.push(record);
  return { ok: true, data: record };
}

export function getDemoMedicationMasterDataRecords(tenantId: string): MedicationMasterDataRecord[] {
  return demoMedicationRecords.filter((record) => record.tenantId === tenantId);
}
