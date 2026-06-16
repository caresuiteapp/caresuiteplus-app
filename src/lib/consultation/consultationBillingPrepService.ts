import type { RoleKey, ServiceResult } from '@/types';
import type { ConsultationBillingPrepReport } from '@/types/modules/consultation';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getConsultationCaseById, updateConsultationCaseStatus } from './consultationCaseService';
import {
  hasFinalizedProtocolForCase,
  hasSignedProtocolForCase,
} from './consultationProtocolService';
import { appendConsultationAuditEvent, getConsultationStore } from './consultationStore';
import { createConsultationBillingPrepReport } from './consultationValidationService';

export function prepareConsultationBilling(input: {
  tenantId: string;
  caseId: string;
  costCarrierProfileId?: string | null;
  durationMinutes?: number | null;
  actorRoleKey?: RoleKey | null;
}): ServiceResult<ConsultationBillingPrepReport> {
  const denied = enforcePermission<ConsultationBillingPrepReport>(input.actorRoleKey, 'beratung.access');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const caseResult = getConsultationCaseById(input.tenantId, input.caseId, input.actorRoleKey);
  if (!caseResult.ok) return caseResult;

  const consultationCase = caseResult.data;
  const assessment = getConsultationStore(input.tenantId).assessments.find(
    (a) => a.caseId === input.caseId,
  );

  const report = createConsultationBillingPrepReport({
    tenantId: input.tenantId,
    caseId: input.caseId,
    clientId: consultationCase.clientId,
    careGrade: assessment?.careGrade ?? null,
    hasFinalizedProtocol: hasFinalizedProtocolForCase(input.tenantId, input.caseId),
    hasSignature: hasSignedProtocolForCase(input.tenantId, input.caseId),
    occasionKey: consultationCase.occasionKey,
    durationMinutes: input.durationMinutes ?? null,
    costCarrierProfileId: input.costCarrierProfileId ?? null,
  });

  appendConsultationAuditEvent(input.tenantId, {
    caseId: input.caseId,
    eventType: report.passed ? 'billing_prep_ready' : 'billing_prep_blocked',
    summary: report.passed
      ? 'Abrechnungsvorbereitung erfolgreich.'
      : `Abrechnung blockiert: ${report.blockedReason}`,
    actorProfileId: null,
    oldStatus: consultationCase.status,
    newStatus: report.passed ? 'billing_ready' : consultationCase.status,
    metadata: { validationRunId: report.validationRunId },
  });

  if (report.passed) {
    const statusResult = updateConsultationCaseStatus({
      tenantId: input.tenantId,
      caseId: input.caseId,
      newStatus: 'billing_ready',
      actorRoleKey: input.actorRoleKey,
      hasSignature: true,
    });
    if (statusResult.ok) {
      const store = getConsultationStore(input.tenantId);
      const idx = store.cases.findIndex((c) => c.id === input.caseId);
      if (idx >= 0) {
        store.cases[idx] = {
          ...store.cases[idx],
          billingPreparedAt: new Date().toISOString(),
        };
      }
    }
  }

  return { ok: true, data: report };
}
