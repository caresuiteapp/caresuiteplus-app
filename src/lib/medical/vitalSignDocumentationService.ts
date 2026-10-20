import type { RoleKey, ServiceResult } from '@/types';
import type { VitalSignDocumentationInput, VitalSignDocumentationRecord } from '@/types/medical';
import { MEDICAL_DOCUMENTATION_DISCLAIMER } from '@/types/medical';
import { assertMedicalFunctionAllowed } from '@/lib/medicalCatalog';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

const demoVitalRecords: VitalSignDocumentationRecord[] = [];

const VITAL_DOCUMENTATION_HINT =
  'Vitalzeichen dokumentiert — keine automatische Risikobewertung oder Behandlungsempfehlung.';

/** Vitalzeichen erfassen — reine Dokumentation. */
export async function recordVitalSignDocumentation(
  tenantId: string,
  input: VitalSignDocumentationInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<VitalSignDocumentationRecord>> {
  const denied = enforcePermission<VitalSignDocumentationRecord>(actorRoleKey, 'pflege.vitals.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (!input.valueText.trim()) {
    return { ok: false, error: 'Messwert ist erforderlich.' };
  }

  await new Promise((resolve) => setTimeout(resolve, 80));

  const record: VitalSignDocumentationRecord = {
    id: `vital-doc-${Date.now()}`,
    tenantId,
    clientId: input.clientId,
    signType: input.signType,
    valueText: input.valueText.trim(),
    unit: input.unit?.trim() ?? null,
    documentationHint: `${VITAL_DOCUMENTATION_HINT} ${MEDICAL_DOCUMENTATION_DISCLAIMER}`,
    measuredAt: new Date().toISOString(),
  };

  demoVitalRecords.push(record);
  return { ok: true, data: record };
}

export function getDemoVitalSignDocumentationRecords(
  tenantId: string,
): VitalSignDocumentationRecord[] {
  return demoVitalRecords.filter((record) => record.tenantId === tenantId);
}

/** Warnbereiche nur als dokumentarischer Hinweis — keine klinische Entscheidung. */
export function buildVitalDocumentationWarningHint(
  signType: VitalSignDocumentationInput['signType'],
  valueText: string,
): string {
  return (
    `Dokumentationshinweis (${signType}, Wert ${valueText}): ` +
    'Abweichung kann dokumentiert werden — keine automatische Risikobewertung. ' +
    MEDICAL_DOCUMENTATION_DISCLAIMER
  );
}

/** Automatische Risikobewertung als medizinische Entscheidung — blockiert. */
export function assessVitalSignRisk(): ServiceResult<never> {
  const blocked = assertMedicalFunctionAllowed('automatic_risk_assessment');
  if (!blocked.ok) {
    return { ok: false, error: blocked.reason };
  }
  return { ok: false, error: 'Unerwarteter Zustand.' };
}
