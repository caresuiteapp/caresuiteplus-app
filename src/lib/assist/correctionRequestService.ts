import type { RoleKey, ServiceResult } from '@/types';
import type { ServiceRecord, ServiceRecordStatus } from '@/types/modules/assignmentCompletion';
import type { CorrectionAffectedArea, QmCorrectionRequest } from '@/types/modules/qmCockpit';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getAssignmentWorkflow } from './assignmentWorkflowService';
import { onCorrectionRequested, onServiceRecordReviewPending } from './managementTaskAutomationService';
import {
  QM_COCKPIT_STORE,
  appendQmAuditEvent,
  filterQmByTenant,
  nextQmCorrectionId,
  nextServiceRecordId,
} from './qmCockpitStore';

function nowIso(): string {
  return new Date().toISOString();
}

export function createServiceRecord(input: {
  tenantId: string;
  assignmentId: string;
  clientId: string;
  employeeId: string;
  serviceType: string;
  deploymentDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  documentationId: string;
  billingAmountCents?: number;
}): ServiceResult<ServiceRecord> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const record: ServiceRecord = {
    id: nextServiceRecordId(),
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    clientId: input.clientId,
    careLevel: 'PG3',
    payer: 'Pflegekasse',
    employeeId: input.employeeId,
    deploymentDate: input.deploymentDate,
    startTime: input.startTime,
    endTime: input.endTime,
    durationMinutes: input.durationMinutes,
    serviceType: input.serviceType,
    tasksSummary: '',
    documentationId: input.documentationId,
    signatureId: null,
    signatureExceptionId: null,
    budgetAllocation: 'entlastungsleistungen',
    billingAmountCents: input.billingAmountCents ?? 0,
    status: 'review_pending',
    version: 1,
    correctedFromId: null,
    lockedAt: null,
    contentHash: null,
    pdfPath: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  QM_COCKPIT_STORE.serviceRecords.push(record);
  onServiceRecordReviewPending(record);

  appendQmAuditEvent({
    tenantId: input.tenantId,
    action: 'service_record.created',
    entityType: 'service_record',
    entityId: record.id,
    assignmentId: input.assignmentId,
    actorId: null,
    summary: 'Leistungsnachweis erstellt — Prüfung ausstehend',
  });

  return { ok: true, data: record };
}

export function getServiceRecord(tenantId: string, serviceRecordId: string): ServiceRecord | null {
  return (
    QM_COCKPIT_STORE.serviceRecords.find(
      (r) => r.id === serviceRecordId && r.tenantId === tenantId,
    ) ?? null
  );
}

export function listServiceRecords(tenantId: string, filter?: { status?: ServiceRecordStatus }): ServiceRecord[] {
  if (!tenantId?.trim()) return [];
  return filterQmByTenant(QM_COCKPIT_STORE.serviceRecords, tenantId).filter((r) => {
    if (filter?.status && r.status !== filter.status) return false;
    return true;
  });
}

export function isServiceRecordFinalized(record: ServiceRecord): boolean {
  return record.lockedAt != null || record.status === 'approved' || record.status === 'billing_ready';
}

export function requestCorrection(input: {
  tenantId: string;
  assignmentId: string;
  serviceRecordId?: string | null;
  requestedBy: string;
  assignedToEmployeeId: string;
  affectedArea: CorrectionAffectedArea;
  reason: string;
  requiredResponse: string;
  dueAt?: string | null;
  actorRoleKey?: RoleKey | null;
}): ServiceResult<QmCorrectionRequest> {
  const denied = enforcePermission<QmCorrectionRequest>(input.actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const assignment = getAssignmentWorkflow(input.tenantId, input.assignmentId);
  if (!assignment) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const serviceRecord = input.serviceRecordId
    ? getServiceRecord(input.tenantId, input.serviceRecordId)
    : null;

  if (serviceRecord && isServiceRecordFinalized(serviceRecord)) {
    const correctedVersion = serviceRecord.version + 1;
    const correction: QmCorrectionRequest = {
      id: nextQmCorrectionId(),
      tenantId: input.tenantId,
      assignmentId: input.assignmentId,
      serviceRecordId: serviceRecord.id,
      requestedBy: input.requestedBy,
      assignedToEmployeeId: input.assignedToEmployeeId,
      affectedArea: input.affectedArea,
      reason: input.reason,
      requiredResponse: input.requiredResponse,
      dueAt: input.dueAt ?? null,
      status: 'waiting_for_employee',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      resolvedAt: null,
      resolvedBy: null,
      documentVersion: correctedVersion,
      correctedFromDocumentId: serviceRecord.id,
    };

    QM_COCKPIT_STORE.qmCorrectionRequests.push(correction);
    serviceRecord.status = 'corrected';
    serviceRecord.version = correctedVersion;
    serviceRecord.updatedAt = nowIso();

    onCorrectionRequested({
      tenantId: input.tenantId,
      assignmentId: input.assignmentId,
      correctionId: correction.id,
      employeeId: input.assignedToEmployeeId,
      dueAt: input.dueAt,
      reason: input.reason,
      createdBy: input.requestedBy,
    });

    appendQmAuditEvent({
      tenantId: input.tenantId,
      action: 'correction.requested',
      entityType: 'correction_request',
      entityId: correction.id,
      assignmentId: input.assignmentId,
      actorId: input.requestedBy,
      summary: `Korrektur angefordert (${input.affectedArea}) — neue Version ${correctedVersion}, kein Überschreiben`,
      metadata: {
        affectedArea: input.affectedArea,
        documentVersion: String(correctedVersion),
        correctedFromDocumentId: serviceRecord.id,
      },
    });

    return { ok: true, data: correction };
  }

  const correction: QmCorrectionRequest = {
    id: nextQmCorrectionId(),
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    serviceRecordId: input.serviceRecordId ?? null,
    requestedBy: input.requestedBy,
    assignedToEmployeeId: input.assignedToEmployeeId,
    affectedArea: input.affectedArea,
    reason: input.reason,
    requiredResponse: input.requiredResponse,
    dueAt: input.dueAt ?? null,
    status: 'open',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    resolvedAt: null,
    resolvedBy: null,
    documentVersion: 1,
    correctedFromDocumentId: null,
  };

  QM_COCKPIT_STORE.qmCorrectionRequests.push(correction);

  onCorrectionRequested({
    tenantId: input.tenantId,
    assignmentId: input.assignmentId,
    correctionId: correction.id,
    employeeId: input.assignedToEmployeeId,
    dueAt: input.dueAt,
    reason: input.reason,
    createdBy: input.requestedBy,
  });

  appendQmAuditEvent({
    tenantId: input.tenantId,
    action: 'correction.requested',
    entityType: 'correction_request',
    entityId: correction.id,
    assignmentId: input.assignmentId,
    actorId: input.requestedBy,
    summary: `Korrektur angefordert (${input.affectedArea})`,
    metadata: { affectedArea: input.affectedArea },
  });

  return { ok: true, data: correction };
}

export function resolveCorrection(
  tenantId: string,
  correctionId: string,
  resolvedBy: string,
  actorRoleKey?: RoleKey | null,
  actorEmployeeId?: string | null,
): ServiceResult<QmCorrectionRequest> {
  const correction = QM_COCKPIT_STORE.qmCorrectionRequests.find(
    (c) => c.id === correctionId && c.tenantId === tenantId,
  );
  if (!correction) return { ok: false, error: 'Korrekturanfrage nicht gefunden.' };

  const isEmployee =
    actorRoleKey === 'caregiver' || actorRoleKey === 'employee_portal';
  if (isEmployee && actorEmployeeId !== correction.assignedToEmployeeId) {
    return { ok: false, error: 'Mitarbeitende sehen nur eigene Korrekturaufgaben.' };
  }

  correction.status = 'resolved';
  correction.resolvedBy = resolvedBy;
  correction.resolvedAt = nowIso();
  correction.updatedAt = nowIso();

  appendQmAuditEvent({
    tenantId,
    action: 'correction.resolved',
    entityType: 'correction_request',
    entityId: correction.id,
    assignmentId: correction.assignmentId,
    actorId: resolvedBy,
    summary: 'Korrektur abgeschlossen',
  });

  return { ok: true, data: correction };
}

export function listCorrectionRequests(
  tenantId: string,
  filter?: { employeeId?: string; status?: QmCorrectionRequest['status'] },
): QmCorrectionRequest[] {
  if (!tenantId?.trim()) return [];
  return filterQmByTenant(QM_COCKPIT_STORE.qmCorrectionRequests, tenantId).filter((c) => {
    if (filter?.employeeId && c.assignedToEmployeeId !== filter.employeeId) return false;
    if (filter?.status && c.status !== filter.status) return false;
    return true;
  });
}

export function listEmployeeCorrections(
  tenantId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
): ServiceResult<QmCorrectionRequest[]> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (actorRoleKey === 'client_portal') {
    return { ok: false, error: 'Interne QM-Aufgaben sind für Klient:innen nicht sichtbar.' };
  }

  if (actorRoleKey === 'caregiver' || actorRoleKey === 'employee_portal') {
    return {
      ok: true,
      data: listCorrectionRequests(tenantId, { employeeId }),
    };
  }

  const denied = enforcePermission<QmCorrectionRequest[]>(actorRoleKey, 'assist.assignments.view');
  if (denied) return denied;

  return { ok: true, data: listCorrectionRequests(tenantId) };
}
