import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type {
  AssignmentCompletionCheck,
  AssignmentDocumentation,
  AssignmentSignature,
  AssignmentSignatureType,
  BillingPreparationBatch,
  BillingReadyItem,
  CompletionAuditEvent,
  CompletionChainStatus,
  CompletionMonitorArea,
  CompletionMonitorItem,
  CorrectionRequest,
  DocumentArchiveEntry,
  ServiceRecord,
  ServiceRecordReview,
  ServiceRecordReviewDecision,
  ServiceRecordStatus,
  SignatureException,
} from '@/types/modules/assignmentCompletion';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import {
  getAssignmentWorkflow,
  listAssignmentWorkflows,
} from './assignmentWorkflowService';

type CompletionStore = {
  documentation: Map<string, AssignmentDocumentation>;
  checks: Map<string, AssignmentCompletionCheck>;
  signatures: Map<string, AssignmentSignature>;
  exceptions: Map<string, SignatureException>;
  serviceRecords: Map<string, ServiceRecord>;
  reviews: Map<string, ServiceRecordReview>;
  billingItems: Map<string, BillingReadyItem>;
  billingBatches: Map<string, BillingPreparationBatch>;
  corrections: Map<string, CorrectionRequest>;
  archives: Map<string, DocumentArchiveEntry>;
  auditEvents: CompletionAuditEvent[];
  chainStatus: Map<string, CompletionChainStatus>;
};

const STORE: CompletionStore = {
  documentation: new Map(),
  checks: new Map(),
  signatures: new Map(),
  exceptions: new Map(),
  serviceRecords: new Map(),
  reviews: new Map(),
  billingItems: new Map(),
  billingBatches: new Map(),
  corrections: new Map(),
  archives: new Map(),
  auditEvents: [],
  chainStatus: new Map(),
};

let docCounter = 0;
let checkCounter = 0;
let sigCounter = 0;
let excCounter = 0;
let recordCounter = 0;
let reviewCounter = 0;
let billingCounter = 0;
let batchCounter = 0;
let correctionCounter = 0;
let archiveCounter = 0;
let auditCounter = 0;

const ADMIN = 'business_admin' as RoleKey;

function audit(input: Omit<CompletionAuditEvent, 'id' | 'createdAt'>): CompletionAuditEvent {
  auditCounter += 1;
  const event: CompletionAuditEvent = {
    id: `comp-audit-${auditCounter}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  STORE.auditEvents.push(event);
  return event;
}

function setChainStatus(assignmentId: string, status: CompletionChainStatus): void {
  STORE.chainStatus.set(assignmentId, status);
}

export function getCompletionChainStatus(assignmentId: string): CompletionChainStatus | undefined {
  return STORE.chainStatus.get(assignmentId);
}

function patchAssignmentStatus(
  tenantId: string,
  assignmentId: string,
  status: AssignmentStatus,
): void {
  const wf = getAssignmentWorkflow(tenantId, assignmentId);
  if (!wf) return;
  wf.status = status;
  if (status === 'beendet') wf.canonicalStatus = 'finished';
  if (status === 'dokumentation_offen') wf.canonicalStatus = 'documentation_pending';
  if (status === 'unterschrift_offen') wf.canonicalStatus = 'signature_pending';
  if (status === 'abgeschlossen') {
    wf.canonicalStatus = 'completed';
    wf.completedAt = new Date().toISOString();
  }
}

export function finishAssignmentWithChecks(input: {
  tenantId: string;
  assignmentId: string;
  actualStartAt: string;
  actualEndAt: string;
  tasksHandled: boolean;
  actorRoleKey?: RoleKey | null;
  actorId?: string | null;
}): ServiceResult<{ check: AssignmentCompletionCheck; nextStatus: CompletionChainStatus }> {
  const denied = enforcePermission<{ check: AssignmentCompletionCheck; nextStatus: CompletionChainStatus }>(
    input.actorRoleKey,
    'assist.execution.manage',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const assignment = getAssignmentWorkflow(input.tenantId, input.assignmentId);
  if (!assignment) return { ok: false, error: 'Einsatz nicht gefunden.' };
  if (assignment.lockedAt) return { ok: false, error: 'Gesperrter Einsatz kann nicht beendet werden.' };

  assignment.actualStartAt = input.actualStartAt;
  assignment.actualEndAt = input.actualEndAt;

  const blockingErrors: string[] = [];
  const actualTimesOk = Boolean(input.actualStartAt && input.actualEndAt);
  const durationOk =
    actualTimesOk &&
    new Date(input.actualEndAt).getTime() > new Date(input.actualStartAt).getTime();
  const tasksHandledOk = input.tasksHandled;
  const documentationOk =
    !assignment.requiresDocumentation ||
    Boolean(STORE.documentation.has(`${input.tenantId}:${input.assignmentId}`));
  const deviationsDocumented = true;

  if (!actualTimesOk) blockingErrors.push('Ist-Zeiten fehlen.');
  if (!durationOk) blockingErrors.push('Ist-Dauer ungültig.');
  if (!tasksHandledOk) blockingErrors.push('Aufgaben nicht vollständig bearbeitet.');

  checkCounter += 1;
  const check: AssignmentCompletionCheck = {
    id: `check-${checkCounter}`,
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    actualTimesOk,
    durationOk,
    tasksHandledOk,
    documentationOk,
    deviationsDocumented,
    signatureOk: false,
    signatureExceptionOk: false,
    blockingErrors,
    checkedAt: new Date().toISOString(),
  };
  STORE.checks.set(check.id, check);

  if (blockingErrors.length > 0) {
    audit({
      tenantId: input.tenantId,
      assignmentId: input.assignmentId,
      entityType: 'documentation',
      entityId: check.id,
      action: 'finish_blocked',
      actorId: input.actorId ?? null,
      summary: blockingErrors.join(' '),
    });
    return { ok: false, error: blockingErrors[0] };
  }

  patchAssignmentStatus(input.tenantId, input.assignmentId, 'beendet');
  const nextStatus: CompletionChainStatus =
    assignment.requiresDocumentation && !documentationOk
      ? 'documentation_pending'
      : assignment.requiresSignature
        ? 'signature_pending'
        : 'review_pending';
  setChainStatus(input.assignmentId, nextStatus);

  audit({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    entityType: 'documentation',
    entityId: check.id,
    action: 'assignment_finished',
    actorId: input.actorId ?? null,
    summary: 'Einsatz beendet — Abschlussprüfung bestanden.',
  });

  return { ok: true, data: { check, nextStatus } };
}

export function submitAssignmentDocumentation(input: {
  tenantId: string;
  assignmentId: string;
  clientId: string;
  employeeId: string;
  summary: string;
  performedTasks: string;
  observations: string;
  deviations: string;
  followUpRequired: boolean;
  actorRoleKey?: RoleKey | null;
  actorId?: string | null;
}): ServiceResult<AssignmentDocumentation> {
  const denied = enforcePermission<AssignmentDocumentation>(input.actorRoleKey, 'assist.execution.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const required = [
    'summary',
    'performedTasks',
    'observations',
    'deviations',
    'employeeId',
    'clientId',
    'assignmentId',
  ] as const;
  for (const field of required) {
    const value = input[field];
    if (typeof value === 'string' && !value.trim()) {
      return { ok: false, error: `Pflichtfeld ${field} fehlt.` };
    }
  }

  docCounter += 1;
  const now = new Date().toISOString();
  const doc: AssignmentDocumentation = {
    id: `doc-${docCounter}`,
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    clientId: input.clientId,
    employeeId: input.employeeId,
    summary: input.summary.trim(),
    performedTasks: input.performedTasks.trim(),
    observations: input.observations.trim(),
    deviations: input.deviations.trim(),
    followUpRequired: input.followUpRequired,
    documentedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  STORE.documentation.set(`${input.tenantId}:${input.assignmentId}`, doc);
  patchAssignmentStatus(input.tenantId, input.assignmentId, 'dokumentation_offen');

  const assignment = getAssignmentWorkflow(input.tenantId, input.assignmentId);
  const nextStatus: CompletionChainStatus = assignment?.requiresSignature
    ? 'signature_pending'
    : 'review_pending';
  setChainStatus(input.assignmentId, nextStatus);

  const auditEvent = audit({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    entityType: 'documentation',
    entityId: doc.id,
    action: 'documentation_submitted',
    actorId: input.actorId ?? null,
    summary: 'Dokumentation erfasst.',
  });

  return { ok: true, data: { ...doc, updatedAt: auditEvent.createdAt } };
}

export function captureAssignmentSignature(input: {
  tenantId: string;
  assignmentId: string;
  clientId: string;
  signatureType: AssignmentSignatureType;
  signerName: string;
  signerRole: string;
  signatureData: string;
  capturedBy: string;
  deviceInfo?: string | null;
  actorRoleKey?: RoleKey | null;
}): ServiceResult<AssignmentSignature> {
  const denied = enforcePermission<AssignmentSignature>(input.actorRoleKey, 'assist.execution.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  if (!input.signatureData.trim()) {
    return { ok: false, error: 'Unterschrift fehlt.' };
  }

  sigCounter += 1;
  const auditEvent = audit({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    entityType: 'signature',
    entityId: `sig-${sigCounter}`,
    action: 'signature_captured',
    actorId: input.capturedBy,
    summary: `Unterschrift (${input.signatureType}) erfasst.`,
  });

  const signature: AssignmentSignature = {
    id: `sig-${sigCounter}`,
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    clientId: input.clientId,
    documentId: null,
    signatureType: input.signatureType,
    signerName: input.signerName,
    signerRole: input.signerRole,
    signatureData: input.signatureData,
    signaturePath: null,
    signedAt: new Date().toISOString(),
    capturedBy: input.capturedBy,
    deviceInfo: input.deviceInfo ?? null,
    contentHash: `hash-${input.signatureData.length}`,
    auditEventId: auditEvent.id,
  };

  STORE.signatures.set(signature.id, signature);
  patchAssignmentStatus(input.tenantId, input.assignmentId, 'unterschrift_offen');
  setChainStatus(input.assignmentId, 'review_pending');

  return { ok: true, data: signature };
}

export function requestSignatureException(input: {
  tenantId: string;
  assignmentId: string;
  reason: string;
  requestedBy: string;
  actorRoleKey?: RoleKey | null;
}): ServiceResult<SignatureException> {
  const denied = enforcePermission<SignatureException>(input.actorRoleKey, 'assist.execution.manage');
  if (denied) return denied;

  if (!input.reason.trim()) {
    return { ok: false, error: 'Begründung für fehlende Unterschrift erforderlich.' };
  }

  excCounter += 1;
  const exception: SignatureException = {
    id: `exc-${excCounter}`,
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    reason: input.reason.trim(),
    requestedBy: input.requestedBy,
    reviewedBy: null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };

  STORE.exceptions.set(exception.id, exception);
  setChainStatus(input.assignmentId, 'review_pending_exception');

  audit({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    entityType: 'signature',
    entityId: exception.id,
    action: 'signature_exception_requested',
    actorId: input.requestedBy,
    summary: 'Ausnahme ohne Unterschrift beantragt.',
  });

  return { ok: true, data: exception };
}

export function reviewSignatureException(input: {
  tenantId: string;
  exceptionId: string;
  approved: boolean;
  reviewerId: string;
  actorRoleKey?: RoleKey | null;
}): ServiceResult<SignatureException> {
  const denied = enforcePermission<SignatureException>(input.actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  const exception = STORE.exceptions.get(input.exceptionId);
  if (!exception || exception.tenantId !== input.tenantId) {
    return { ok: false, error: 'Ausnahmeantrag nicht gefunden.' };
  }

  exception.status = input.approved ? 'approved' : 'rejected';
  exception.reviewedBy = input.reviewerId;
  exception.resolvedAt = new Date().toISOString();

  if (input.approved) {
    setChainStatus(exception.assignmentId, 'review_pending');
  }

  audit({
    tenantId: input.tenantId,
    assignmentId: exception.assignmentId,
    entityType: 'signature',
    entityId: exception.id,
    action: input.approved ? 'signature_exception_approved' : 'signature_exception_rejected',
    actorId: input.reviewerId,
    summary: input.approved ? 'Ausnahme genehmigt.' : 'Ausnahme abgelehnt.',
  });

  return { ok: true, data: exception };
}

export function generateServiceRecord(input: {
  tenantId: string;
  assignmentId: string;
  careLevel: string;
  payer: string;
  budgetAllocation: string;
  billingAmountCents: number;
  actorRoleKey?: RoleKey | null;
  actorId?: string | null;
}): ServiceResult<ServiceRecord> {
  const denied = enforcePermission<ServiceRecord>(input.actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const assignment = getAssignmentWorkflow(input.tenantId, input.assignmentId);
  if (!assignment) return { ok: false, error: 'Einsatz nicht gefunden.' };
  if (!assignment.clientId || !assignment.employeeId) {
    return { ok: false, error: 'Leistungsnachweis benötigt Klient:in und Mitarbeitende:n.' };
  }
  if (!assignment.actualStartAt || !assignment.actualEndAt) {
    return { ok: false, error: 'Leistungsnachweis benötigt Ist-Zeiten.' };
  }

  const doc = STORE.documentation.get(`${input.tenantId}:${input.assignmentId}`);
  if (!doc) return { ok: false, error: 'Leistungsnachweis benötigt Dokumentation.' };

  recordCounter += 1;
  const record: ServiceRecord = {
    id: `sr-${recordCounter}`,
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    clientId: assignment.clientId,
    careLevel: input.careLevel,
    payer: input.payer,
    employeeId: assignment.employeeId,
    deploymentDate: assignment.plannedStartAt.slice(0, 10),
    startTime: assignment.actualStartAt,
    endTime: assignment.actualEndAt,
    durationMinutes: assignment.plannedDurationMinutes,
    serviceType: assignment.serviceType,
    tasksSummary: assignment.tasks.map((t) => t.taskTitle).join(', '),
    documentationId: doc.id,
    signatureId: [...STORE.signatures.values()].find((s) => s.assignmentId === input.assignmentId)?.id ?? null,
    signatureExceptionId:
      [...STORE.exceptions.values()].find(
        (e) => e.assignmentId === input.assignmentId && e.status === 'approved',
      )?.id ?? null,
    budgetAllocation: input.budgetAllocation,
    billingAmountCents: input.billingAmountCents,
    status: 'generated',
    version: 1,
    correctedFromId: null,
    lockedAt: null,
    contentHash: null,
    pdfPath: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  STORE.serviceRecords.set(record.id, record);
  setChainStatus(input.assignmentId, 'review_pending');

  audit({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    entityType: 'service_record',
    entityId: record.id,
    action: 'service_record_generated',
    actorId: input.actorId ?? null,
    summary: 'Leistungsnachweis erzeugt.',
  });

  return { ok: true, data: record };
}

export function reviewServiceRecord(input: {
  tenantId: string;
  serviceRecordId: string;
  decision: ServiceRecordReviewDecision;
  reviewerId: string;
  internalNote: string;
  actorRoleKey?: RoleKey | null;
}): ServiceResult<ServiceRecordReview> {
  const denied = enforcePermission<ServiceRecordReview>(input.actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  const record = STORE.serviceRecords.get(input.serviceRecordId);
  if (!record || record.tenantId !== input.tenantId) {
    return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };
  }

  reviewCounter += 1;
  const review: ServiceRecordReview = {
    id: `review-${reviewCounter}`,
    tenantId: input.tenantId,
    serviceRecordId: input.serviceRecordId,
    reviewerId: input.reviewerId,
    decision: input.decision,
    internalNote: input.internalNote,
    reviewedAt: new Date().toISOString(),
  };

  STORE.reviews.set(review.id, review);

  if (input.decision === 'approved') {
    record.status = 'approved';
    setChainStatus(record.assignmentId, 'billing_ready');
  } else if (input.decision === 'rejected') {
    record.status = 'rejected';
  } else {
    record.status = 'review_pending';
    setChainStatus(record.assignmentId, 'correction_requested');
  }
  record.updatedAt = new Date().toISOString();

  audit({
    tenantId: input.tenantId,
    assignmentId: record.assignmentId,
    entityType: 'service_record',
    entityId: record.id,
    action: `review_${input.decision}`,
    actorId: input.reviewerId,
    summary: `Prüfung: ${input.decision}.`,
  });

  return { ok: true, data: review };
}

export function requestServiceRecordCorrection(input: {
  tenantId: string;
  serviceRecordId: string;
  reason: string;
  assignedToEmployeeId: string;
  requestedBy: string;
  actorRoleKey?: RoleKey | null;
}): ServiceResult<CorrectionRequest> {
  const denied = enforcePermission<CorrectionRequest>(input.actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  const record = STORE.serviceRecords.get(input.serviceRecordId);
  if (!record || record.tenantId !== input.tenantId) {
    return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };
  }
  if (record.lockedAt) {
    return { ok: false, error: 'Finalisierter Nachweis darf nicht direkt bearbeitet werden.' };
  }

  correctionCounter += 1;
  const correction: CorrectionRequest = {
    id: `corr-${correctionCounter}`,
    tenantId: input.tenantId,
    serviceRecordId: input.serviceRecordId,
    assignmentId: record.assignmentId,
    requestedBy: input.requestedBy,
    assignedToEmployeeId: input.assignedToEmployeeId,
    reason: input.reason,
    status: 'open',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };

  STORE.corrections.set(correction.id, correction);
  record.status = 'corrected';
  setChainStatus(record.assignmentId, 'correction_requested');

  audit({
    tenantId: input.tenantId,
    assignmentId: record.assignmentId,
    entityType: 'correction',
    entityId: correction.id,
    action: 'correction_requested',
    actorId: input.requestedBy,
    summary: 'Korrektur angefordert — neue Version erforderlich.',
  });

  return { ok: true, data: correction };
}

export function attemptEditFinalizedServiceRecord(
  tenantId: string,
  serviceRecordId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<never> {
  const denied = enforcePermission<never>(actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  const record = STORE.serviceRecords.get(serviceRecordId);
  if (!record || record.tenantId !== tenantId) {
    return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };
  }
  if (record.lockedAt || record.status === 'archived') {
    audit({
      tenantId,
      assignmentId: record.assignmentId,
      entityType: 'service_record',
      entityId: record.id,
      action: 'edit_blocked',
      actorId: null,
      summary: 'Direkte Bearbeitung finalisierter Nachweise blockiert.',
    });
    return { ok: false, error: 'Finalisierter Leistungsnachweis ist gesperrt.' };
  }
  return { ok: false, error: 'Nachweis ist nicht finalisiert.' };
}

export function prepareBillingFromServiceRecord(input: {
  tenantId: string;
  serviceRecordId: string;
  rateCents: number;
  taxRatePercent: number;
  invoiceRecipient: string;
  actorRoleKey?: RoleKey | null;
  actorId?: string | null;
}): ServiceResult<BillingReadyItem> {
  const denied = enforcePermission<BillingReadyItem>(input.actorRoleKey, 'office.invoices.status_change');
  if (denied) return denied;

  const record = STORE.serviceRecords.get(input.serviceRecordId);
  if (!record || record.tenantId !== input.tenantId) {
    return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };
  }

  if (record.status !== 'approved' && record.status !== 'billing_ready') {
    return { ok: false, error: 'Abrechnung nur bei freigegebenem Nachweis möglich.' };
  }
  if (!record.clientId || !record.payer || !record.serviceType || !record.budgetAllocation) {
    return { ok: false, error: 'Abrechnungsdaten unvollständig.' };
  }

  billingCounter += 1;
  const item: BillingReadyItem = {
    id: `bill-${billingCounter}`,
    tenantId: input.tenantId,
    serviceRecordId: input.serviceRecordId,
    clientId: record.clientId,
    payer: record.payer,
    serviceType: record.serviceType,
    budgetCode: record.budgetAllocation,
    rateCents: input.rateCents,
    taxRatePercent: input.taxRatePercent,
    invoiceRecipient: input.invoiceRecipient,
    amountCents: record.billingAmountCents,
    status: 'billing_ready',
    createdAt: new Date().toISOString(),
  };

  STORE.billingItems.set(item.id, item);
  record.status = 'billing_ready';
  setChainStatus(record.assignmentId, 'billing_ready');

  audit({
    tenantId: input.tenantId,
    assignmentId: record.assignmentId,
    entityType: 'billing',
    entityId: item.id,
    action: 'billing_prepared',
    actorId: input.actorId ?? null,
    summary: 'Abrechnungsposition vorbereitet.',
  });

  return { ok: true, data: item };
}

export function createBillingPreparationBatch(
  tenantId: string,
  itemIds: string[],
  actorRoleKey?: RoleKey | null,
): ServiceResult<BillingPreparationBatch> {
  const denied = enforcePermission<BillingPreparationBatch>(actorRoleKey, 'office.invoices.status_change');
  if (denied) return denied;

  const validItems = itemIds.filter((id) => {
    const item = STORE.billingItems.get(id);
    return item && item.tenantId === tenantId && item.status === 'billing_ready';
  });

  if (validItems.length === 0) {
    return { ok: false, error: 'Keine abrechnungsbereiten Positionen.' };
  }

  batchCounter += 1;
  const batch: BillingPreparationBatch = {
    id: `batch-${batchCounter}`,
    tenantId,
    itemIds: validItems,
    status: 'prepared',
    preparedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  STORE.billingBatches.set(batch.id, batch);
  return { ok: true, data: batch };
}

export function archiveAndLockCompletion(input: {
  tenantId: string;
  serviceRecordId: string;
  pdfPath: string;
  actorRoleKey?: RoleKey | null;
  actorId?: string | null;
}): ServiceResult<{ archive: DocumentArchiveEntry; record: ServiceRecord }> {
  const denied = enforcePermission<{ archive: DocumentArchiveEntry; record: ServiceRecord }>(
    input.actorRoleKey,
    'assist.assignments.manage',
  );
  if (denied) return denied;

  const record = STORE.serviceRecords.get(input.serviceRecordId);
  if (!record || record.tenantId !== input.tenantId) {
    return { ok: false, error: 'Leistungsnachweis nicht gefunden.' };
  }
  if (record.status !== 'billing_ready' && record.status !== 'approved') {
    return { ok: false, error: 'Archivierung nur nach Freigabe/Abrechnungsvorbereitung.' };
  }

  const contentHash = `archive-${record.id}-${Date.now()}`;
  archiveCounter += 1;

  const auditEvent = audit({
    tenantId: input.tenantId,
    assignmentId: record.assignmentId,
    entityType: 'archive',
    entityId: `arch-${archiveCounter}`,
    action: 'archived_and_locked',
    actorId: input.actorId ?? null,
    summary: 'PDF archiviert — Einsatz und Nachweis gesperrt.',
  });

  const archive: DocumentArchiveEntry = {
    id: `arch-${archiveCounter}`,
    tenantId: input.tenantId,
    assignmentId: record.assignmentId,
    serviceRecordId: record.id,
    pdfPath: input.pdfPath,
    contentHash,
    archivedAt: new Date().toISOString(),
    auditEventId: auditEvent.id,
  };

  STORE.archives.set(archive.id, archive);

  const now = new Date().toISOString();
  record.status = 'archived';
  record.lockedAt = now;
  record.contentHash = contentHash;
  record.pdfPath = input.pdfPath;
  record.updatedAt = now;

  const assignment = getAssignmentWorkflow(input.tenantId, record.assignmentId);
  if (assignment) {
    assignment.lockedAt = now;
    assignment.status = 'abgeschlossen';
    assignment.canonicalStatus = 'locked';
  }

  setChainStatus(record.assignmentId, 'locked');

  return { ok: true, data: { archive, record } };
}

export function listCompletionMonitorItems(
  tenantId: string,
  area?: CompletionMonitorArea,
): CompletionMonitorItem[] {
  const items: CompletionMonitorItem[] = [];

  for (const doc of STORE.documentation.values()) {
    if (doc.tenantId !== tenantId) continue;
    const assignment = getAssignmentWorkflow(tenantId, doc.assignmentId);
    if (!assignment) continue;
  }

  for (const assignment of listAssignmentWorkflows(tenantId)) {
    const chain = STORE.chainStatus.get(assignment.id);
    const record = [...STORE.serviceRecords.values()].find((r) => r.assignmentId === assignment.id);

    if (!STORE.documentation.has(`${tenantId}:${assignment.id}`) && assignment.requiresDocumentation) {
      items.push({
        area: 'missing_doc',
        assignmentId: assignment.id,
        clientId: assignment.clientId,
        employeeId: assignment.employeeId,
        title: assignment.title,
        status: chain ?? 'documentation_pending',
        updatedAt: assignment.updatedAt,
      });
    }

    if (
      assignment.requiresSignature &&
      ![...STORE.signatures.values()].some((s) => s.assignmentId === assignment.id) &&
      ![...STORE.exceptions.values()].some((e) => e.assignmentId === assignment.id && e.status === 'approved')
    ) {
      items.push({
        area: 'missing_signature',
        assignmentId: assignment.id,
        clientId: assignment.clientId,
        employeeId: assignment.employeeId,
        title: assignment.title,
        status: chain ?? 'signature_pending',
        updatedAt: assignment.updatedAt,
      });
    }

    if (chain === 'review_pending' || record?.status === 'review_pending') {
      items.push({
        area: 'review_pending',
        assignmentId: assignment.id,
        serviceRecordId: record?.id,
        clientId: assignment.clientId,
        employeeId: assignment.employeeId,
        title: assignment.title,
        status: chain ?? 'review_pending',
        updatedAt: assignment.updatedAt,
      });
    }

    if (chain === 'correction_requested') {
      items.push({
        area: 'correction_requested',
        assignmentId: assignment.id,
        serviceRecordId: record?.id,
        clientId: assignment.clientId,
        employeeId: assignment.employeeId,
        title: assignment.title,
        status: 'correction_requested',
        updatedAt: assignment.updatedAt,
      });
    }

    if (chain === 'billing_ready' || record?.status === 'billing_ready') {
      items.push({
        area: 'billing_ready',
        assignmentId: assignment.id,
        serviceRecordId: record?.id,
        clientId: assignment.clientId,
        employeeId: assignment.employeeId,
        title: assignment.title,
        status: 'billing_ready',
        updatedAt: assignment.updatedAt,
      });
    }

    if (record?.status === 'rejected') {
      items.push({
        area: 'rejected',
        assignmentId: assignment.id,
        serviceRecordId: record.id,
        clientId: assignment.clientId,
        employeeId: assignment.employeeId,
        title: assignment.title,
        status: 'review_pending',
        updatedAt: record.updatedAt,
      });
    }

    if (chain === 'review_pending_exception') {
      items.push({
        area: 'exception_review',
        assignmentId: assignment.id,
        clientId: assignment.clientId,
        employeeId: assignment.employeeId,
        title: assignment.title,
        status: 'review_pending_exception',
        updatedAt: assignment.updatedAt,
      });
    }
  }

  return area ? items.filter((i) => i.area === area) : items;
}

export function getCompletionAuditTrail(
  tenantId: string,
  assignmentId?: string,
): CompletionAuditEvent[] {
  return STORE.auditEvents.filter(
    (e) => e.tenantId === tenantId && (!assignmentId || e.assignmentId === assignmentId),
  );
}

export function getServiceRecord(tenantId: string, serviceRecordId: string): ServiceRecord | undefined {
  const record = STORE.serviceRecords.get(serviceRecordId);
  if (!record || record.tenantId !== tenantId) return undefined;
  return record;
}

export function getAssignmentDocumentation(
  tenantId: string,
  assignmentId: string,
): AssignmentDocumentation | undefined {
  return STORE.documentation.get(`${tenantId}:${assignmentId}`);
}

export async function fetchCompletionChainProductionSafe(
  tenantId: string,
): Promise<ServiceResult<CompletionMonitorItem[]>> {
  const liveBlock = guardLiveDemoFeature<CompletionMonitorItem[]>(tenantId, 'Abschlusskette');
  if (liveBlock) return liveBlock;
  return { ok: true, data: listCompletionMonitorItems(tenantId) };
}

export function resetCompletionChainStore(): void {
  STORE.documentation.clear();
  STORE.checks.clear();
  STORE.signatures.clear();
  STORE.exceptions.clear();
  STORE.serviceRecords.clear();
  STORE.reviews.clear();
  STORE.billingItems.clear();
  STORE.billingBatches.clear();
  STORE.corrections.clear();
  STORE.archives.clear();
  STORE.auditEvents.length = 0;
  STORE.chainStatus.clear();
  docCounter = 0;
  checkCounter = 0;
  sigCounter = 0;
  excCounter = 0;
  recordCounter = 0;
  reviewCounter = 0;
  billingCounter = 0;
  batchCounter = 0;
  correctionCounter = 0;
  archiveCounter = 0;
  auditCounter = 0;
}

export { ADMIN as COMPLETION_CHAIN_ADMIN_ROLE };
