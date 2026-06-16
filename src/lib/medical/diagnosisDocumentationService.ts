import type { RoleKey, ServiceResult } from '@/types';
import type { PhysicianStatementDiagnosisInput, PhysicianStatementDiagnosisRecord } from '@/types/medical';
import { MEDICAL_DOCUMENTATION_DISCLAIMER } from '@/types/medical';
import { assertMedicalFunctionAllowed } from '@/lib/medicalCatalog';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

const demoDiagnosisRecords: PhysicianStatementDiagnosisRecord[] = [];

/** Diagnose als ärztliche Angabe dokumentieren — keine Systemdiagnose. */
export async function documentDiagnosisAsPhysicianStatement(
  tenantId: string,
  input: PhysicianStatementDiagnosisInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<PhysicianStatementDiagnosisRecord>> {
  const denied = enforcePermission<PhysicianStatementDiagnosisRecord>(
    actorRoleKey,
    'pflege.plans.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!input.disclaimerAcknowledged) {
    return {
      ok: false,
      error: `Pflicht-Hinweis bestätigen: ${MEDICAL_DOCUMENTATION_DISCLAIMER}`,
    };
  }

  if (!input.physicianStatementText.trim()) {
    return { ok: false, error: 'Ärztliche Angabe darf nicht leer sein.' };
  }

  if (!input.icdCode.trim() || !input.icdTitle.trim()) {
    return { ok: false, error: 'ICD-Code und Bezeichnung sind erforderlich.' };
  }

  await new Promise((resolve) => setTimeout(resolve, 100));

  const record: PhysicianStatementDiagnosisRecord = {
    id: `diag-doc-${Date.now()}`,
    tenantId,
    clientId: input.clientId,
    icdCode: input.icdCode.trim(),
    icdTitle: input.icdTitle.trim(),
    content: input.physicianStatementText.trim(),
    isPhysicianStatement: true,
    recordedAt: new Date().toISOString(),
  };

  demoDiagnosisRecords.push(record);
  return { ok: true, data: record };
}

export function getDemoPhysicianStatementRecords(tenantId: string): PhysicianStatementDiagnosisRecord[] {
  return demoDiagnosisRecords.filter((record) => record.tenantId === tenantId);
}

/** Keine Therapieempfehlung — explizit blockiert. */
export function getTherapyRecommendation(): ServiceResult<never> {
  const blocked = assertMedicalFunctionAllowed('therapy_recommendation');
  if (!blocked.ok) {
    return { ok: false, error: blocked.reason };
  }
  return { ok: false, error: 'Unerwarteter Zustand.' };
}

/** Keine Medikationsentscheidung — explizit blockiert. */
export function getMedicationDecision(): ServiceResult<never> {
  const blocked = assertMedicalFunctionAllowed('medication_decision');
  if (!blocked.ok) {
    return { ok: false, error: blocked.reason };
  }
  return { ok: false, error: 'Unerwarteter Zustand.' };
}
