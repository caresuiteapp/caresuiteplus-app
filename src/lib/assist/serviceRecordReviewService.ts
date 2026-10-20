import type { RoleKey, ServiceResult } from '@/types';
import type { ServiceRecord } from '@/types/modules/assignmentCompletion';
import type { QmReviewDecision, QmServiceRecordReview } from '@/types/modules/qmCockpit';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { createManagementTask } from './managementTaskService';
import { getServiceRecord } from './correctionRequestService';
import { requestCorrection } from './correctionRequestService';
import {
  QM_COCKPIT_STORE,
  appendQmAuditEvent,
  filterQmByTenant,
  nextQmReviewId,
} from './qmCockpitStore';

function nowIso(): string {
  return new Date().toISOString();
}

export type ReviewServiceRecordInput = {
  tenantId: string;
  serviceRecordId: string;
  reviewerId: string;
  decision: QmReviewDecision;
  internalNote?: string;
  actorRoleKey?: RoleKey | null;
  correctionReason?: string;
  assignedToEmployeeId?: string;
};

function updateServiceRecordStatus(record: ServiceRecord, decision: QmReviewDecision): boolean {
  switch (decision) {
    case 'approved':
      record.status = 'billing_ready';
      record.lockedAt = nowIso();
      return true;
    case 'rejected':
      record.status = 'rejected';
      return false;
    case 'correction_requested':
      record.status = 'corrected';
      return false;
    default:
      return false;
  }
}

export function reviewServiceRecord(input: ReviewServiceRecordInput): ServiceResult<QmServiceRecordReview> {
  const denied = enforcePermission<QmServiceRecordReview>(input.actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const record = getServiceRecord(input.tenantId, input.serviceRecordId);
  if (!record) return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };

  const billingReady = updateServiceRecordStatus(record, input.decision);
  record.updatedAt = nowIso();

  const review: QmServiceRecordReview = {
    id: nextQmReviewId(),
    tenantId: input.tenantId,
    serviceRecordId: record.id,
    assignmentId: record.assignmentId,
    reviewerId: input.reviewerId,
    decision: input.decision,
    internalNote: input.internalNote ?? '',
    reviewedAt: nowIso(),
    billingReady,
  };

  QM_COCKPIT_STORE.qmServiceRecordReviews.push(review);

  appendQmAuditEvent({
    tenantId: input.tenantId,
    action: 'service_record.reviewed',
    entityType: 'service_record_review',
    entityId: review.id,
    assignmentId: record.assignmentId,
    actorId: input.reviewerId,
    summary: `Freigabeentscheidung: ${input.decision}`,
    metadata: {
      decision: input.decision,
      billingReady: String(billingReady),
    },
  });

  if (input.decision === 'correction_requested') {
    if (!input.correctionReason?.trim() || !input.assignedToEmployeeId?.trim()) {
      return { ok: false, error: 'Korrektur erfordert Begründung und zugewiesene:n Mitarbeitende:n.' };
    }
    const correction = requestCorrection({
      tenantId: input.tenantId,
      assignmentId: record.assignmentId,
      serviceRecordId: record.id,
      requestedBy: input.reviewerId,
      assignedToEmployeeId: input.assignedToEmployeeId,
      affectedArea: 'service_proof',
      reason: input.correctionReason,
      requiredResponse: 'Korrigierten Leistungsnachweis einreichen',
      actorRoleKey: input.actorRoleKey,
    });
    if (!correction.ok) return correction;
  }

  if (billingReady) {
    createManagementTask({
      tenantId: input.tenantId,
      taskType: 'billing_release',
      assignmentId: record.assignmentId,
      clientId: record.clientId,
      employeeId: record.employeeId,
      relatedEntityType: 'service_record',
      relatedEntityId: record.id,
      priority: 'normal',
      description: 'Leistungsnachweis freigegeben — abrechnungsbereit',
    });
  }

  if (input.decision === 'rejected') {
    createManagementTask({
      tenantId: input.tenantId,
      taskType: 'review_service_record',
      assignmentId: record.assignmentId,
      clientId: record.clientId,
      employeeId: record.employeeId,
      relatedEntityType: 'service_record',
      relatedEntityId: record.id,
      priority: 'high',
      description: input.internalNote || 'Leistungsnachweis abgelehnt',
    });
  }

  return { ok: true, data: review };
}

export function approveSignatureException(input: {
  tenantId: string;
  exceptionId: string;
  reviewerId: string;
  internalNote?: string;
  actorRoleKey?: RoleKey | null;
}): ServiceResult<{ approved: true }> {
  const denied = enforcePermission<{ approved: true }>(input.actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const exception = QM_COCKPIT_STORE.signatureExceptions.find(
    (e) => e.id === input.exceptionId && e.tenantId === input.tenantId,
  );
  if (!exception) return { ok: false, error: 'Signatur-Ausnahme nicht gefunden.' };

  exception.status = 'approved';
  exception.reviewedBy = input.reviewerId;
  exception.resolvedAt = nowIso();

  appendQmAuditEvent({
    tenantId: input.tenantId,
    action: 'signature_exception.approved',
    entityType: 'signature_exception',
    entityId: exception.id,
    assignmentId: exception.assignmentId,
    actorId: input.reviewerId,
    summary: input.internalNote || 'Signatur-Ausnahme freigegeben',
  });

  return { ok: true, data: { approved: true } };
}

export function listServiceRecordReviews(tenantId: string, serviceRecordId?: string): QmServiceRecordReview[] {
  if (!tenantId?.trim()) return [];
  return filterQmByTenant(QM_COCKPIT_STORE.qmServiceRecordReviews, tenantId).filter(
    (r) => !serviceRecordId || r.serviceRecordId === serviceRecordId,
  );
}

export function registerSignatureException(input: {
  tenantId: string;
  assignmentId: string;
  reason: string;
  requestedBy: string;
}): ServiceResult<{ id: string }> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const exception = {
    id: `sig-exc-${QM_COCKPIT_STORE.signatureExceptions.length + 1}`,
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    reason: input.reason,
    requestedBy: input.requestedBy,
    reviewedBy: null,
    status: 'pending' as const,
    createdAt: nowIso(),
    resolvedAt: null,
  };

  QM_COCKPIT_STORE.signatureExceptions.push(exception);

  createManagementTask({
    tenantId: input.tenantId,
    taskType: 'review_exception',
    assignmentId: input.assignmentId,
    relatedEntityType: 'signature',
    relatedEntityId: exception.id,
    priority: 'high',
    description: input.reason,
  });

  return { ok: true, data: { id: exception.id } };
}
