import type { RoleKey, ServiceResult } from '@/types';
import type {
  CapturePrivacyRequestInput,
  CreateProcessingActivityInput,
  PrivacyAuditEvent,
  PrivacyComplianceDashboard,
  PrivacyConsentRecord,
  PrivacyDataExportJob,
  PrivacyDataSubjectRequest,
  PrivacyDataSubjectRequestStatus,
  PrivacyDeletionRequest,
  PrivacyDpaRecord,
  PrivacyIncidentReport,
  PrivacyProcessingActivity,
  PrivacyRequestType,
  PrivacyRetentionRule,
  PrivacyTomRecord,
} from '@/types/modules/privacyManagement';
import { PRIVACY_OPEN_REQUEST_STATUSES } from '@/types/modules/privacyManagement';
import { enforcePermission } from '@/lib/permissions';
import { createInternalTask } from '@/lib/tasks/internalTaskService';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import {
  DSGVO_ART12_RESPONSE_DAYS,
  computeDataSubjectRequestDeadline,
} from './dataSubjectRequestSla';
import {
  assertPrivacyProductionSafety,
  assertPrivacyTenantScope,
  buildPrivacyAccessContext,
  canExportPrivacyHealthData,
  canManagePrivacyCompliance,
  canReviewPrivacyDeletion,
  canViewPrivacyCompliance,
  evaluateRetentionBlock,
  filterPrivacyRequestsForTenant,
} from './privacyManagementAccess';
import {
  PRIVACY_MANAGEMENT_STORE,
  filterPrivacyByTenant,
  getPrivacyDeletionByRequestId,
  getPrivacyRequestById,
  listPrivacyRetentionRules,
  nextPrivacyActivityId,
  nextPrivacyAuditId,
  nextPrivacyConsentId,
  nextPrivacyDeletionId,
  nextPrivacyDpaId,
  nextPrivacyExportJobId,
  nextPrivacyRequestId,
  nextPrivacyRetentionId,
  nextPrivacyTomId,
  resetPrivacyManagementStore,
  seedDefaultPrivacyRetentionRules,
  seedPreparedPrivacyIncidents,
} from './privacyManagementStore';

export const PRIVACY_COMPLIANCE_ROUTE = '/business/office/privacy';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

function audit(input: Omit<PrivacyAuditEvent, 'id' | 'createdAt' | 'updatedAt'>): PrivacyAuditEvent {
  const now = nowIso();
  const event: PrivacyAuditEvent = {
    id: nextPrivacyAuditId(),
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  PRIVACY_MANAGEMENT_STORE.auditEvents.push(event);
  return event;
}

function computeDueAt(receivedAt: string): string {
  return computeDataSubjectRequestDeadline(receivedAt).toISOString();
}

function nextRequestNumber(tenantId: string): string {
  const count = filterPrivacyByTenant(PRIVACY_MANAGEMENT_STORE.dataSubjectRequests, tenantId).length + 1;
  return `DSR-2026${String(count).padStart(4, '0')}`;
}

function assertManageAccess<T>(
  tenantId: string,
  roleKey?: RoleKey | null,
): ServiceResult<T> | null {
  const denied = enforcePermission<T>(roleKey, 'security.manage');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  return null;
}

function assertViewAccess<T>(
  tenantId: string,
  roleKey?: RoleKey | null,
): ServiceResult<T> | null {
  const denied = enforcePermission<T>(roleKey, 'security.view');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  return null;
}

export { resetPrivacyManagementStore, seedDefaultPrivacyRetentionRules, seedPreparedPrivacyIncidents };

export function getPrivacyAuditTrail(tenantId: string): PrivacyAuditEvent[] {
  return filterPrivacyByTenant(PRIVACY_MANAGEMENT_STORE.auditEvents, tenantId);
}

export async function fetchPrivacyComplianceDashboard(
  tenantId: string,
  roleKey?: RoleKey | null,
): Promise<ServiceResult<PrivacyComplianceDashboard>> {
  const block = assertViewAccess<PrivacyComplianceDashboard>(tenantId, roleKey);
  if (block) return block;

  seedDefaultPrivacyRetentionRules(tenantId);
  seedPreparedPrivacyIncidents(tenantId);

  const requests = filterPrivacyByTenant(PRIVACY_MANAGEMENT_STORE.dataSubjectRequests, tenantId);
  const now = new Date();
  const openRequests = requests.filter((r) => PRIVACY_OPEN_REQUEST_STATUSES.includes(r.status));
  const overdue = openRequests.filter((r) => new Date(r.dueAt) < now);

  return {
    ok: true,
    data: {
      processingActivitiesCount: filterPrivacyByTenant(
        PRIVACY_MANAGEMENT_STORE.processingActivities,
        tenantId,
      ).length,
      tomRecordsCount: filterPrivacyByTenant(PRIVACY_MANAGEMENT_STORE.tomRecords, tenantId).length,
      dpaRecordsCount: filterPrivacyByTenant(PRIVACY_MANAGEMENT_STORE.dpaRecords, tenantId).length,
      openRequestsCount: openRequests.length,
      overdueRequestsCount: overdue.length,
      pendingDeletionReviews: filterPrivacyByTenant(
        PRIVACY_MANAGEMENT_STORE.deletionRequests,
        tenantId,
      ).filter((d) => d.reviewStatus === 'pending_review').length,
      activeRetentionRules: listPrivacyRetentionRules(tenantId).length,
      incidentsPrepared: filterPrivacyByTenant(PRIVACY_MANAGEMENT_STORE.incidentReports, tenantId).filter(
        (i) => i.preparedOnly,
      ).length,
    },
  };
}

export async function createProcessingActivity(
  input: CreateProcessingActivityInput,
  roleKey?: RoleKey | null,
  actorUserId?: string | null,
): Promise<ServiceResult<PrivacyProcessingActivity>> {
  const block = assertManageAccess<PrivacyProcessingActivity>(input.tenantId, roleKey);
  if (block) return block;

  const ctx = buildPrivacyAccessContext({
    tenantId: input.tenantId,
    roleKey: roleKey ?? null,
    userId: actorUserId,
  });
  const production = assertPrivacyProductionSafety(ctx);
  if (!production.allowed) return { ok: false, error: production.reason };

  const now = nowIso();
  const record: PrivacyProcessingActivity = {
    id: nextPrivacyActivityId(),
    tenantId: input.tenantId,
    title: input.title.trim(),
    purpose: input.purpose.trim(),
    legalBasis: input.legalBasis.trim(),
    dataCategories: input.dataCategories ?? [],
    dataSubjects: input.dataSubjects ?? [],
    recipients: input.recipients ?? [],
    retentionReference: input.retentionReference ?? null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  PRIVACY_MANAGEMENT_STORE.processingActivities.push(record);
  audit({
    tenantId: input.tenantId,
    action: 'record_created',
    entityType: 'processing_activity',
    entityId: record.id,
    actorUserId: actorUserId ?? null,
    actorRoleKey: roleKey ?? null,
    details: `Verarbeitungstätigkeit angelegt: ${record.title}`,
    metadata: { area: 'processing_activities' },
  });

  return { ok: true, data: record };
}

export async function createTomRecord(
  tenantId: string,
  input: { title: string; category: string; description?: string },
  roleKey?: RoleKey | null,
): Promise<ServiceResult<PrivacyTomRecord>> {
  const block = assertManageAccess<PrivacyTomRecord>(tenantId, roleKey);
  if (block) return block;

  const now = nowIso();
  const record: PrivacyTomRecord = {
    id: nextPrivacyTomId(),
    tenantId,
    title: input.title.trim(),
    category: input.category.trim(),
    description: input.description?.trim() ?? '',
    implementationStatus: 'planned',
    reviewDueAt: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  PRIVACY_MANAGEMENT_STORE.tomRecords.push(record);
  audit({
    tenantId,
    action: 'record_created',
    entityType: 'tom_record',
    entityId: record.id,
    actorUserId: null,
    actorRoleKey: roleKey ?? null,
    details: `TOM erfasst: ${record.title}`,
    metadata: { area: 'toms' },
  });
  return { ok: true, data: record };
}

export async function createDpaRecord(
  tenantId: string,
  input: { processorName: string; serviceDescription: string },
  roleKey?: RoleKey | null,
): Promise<ServiceResult<PrivacyDpaRecord>> {
  const block = assertManageAccess<PrivacyDpaRecord>(tenantId, roleKey);
  if (block) return block;

  const now = nowIso();
  const record: PrivacyDpaRecord = {
    id: nextPrivacyDpaId(),
    tenantId,
    processorName: input.processorName.trim(),
    serviceDescription: input.serviceDescription.trim(),
    signedAt: null,
    expiresAt: null,
    documentId: null,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  PRIVACY_MANAGEMENT_STORE.dpaRecords.push(record);
  audit({
    tenantId,
    action: 'record_created',
    entityType: 'dpa_record',
    entityId: record.id,
    actorUserId: null,
    actorRoleKey: roleKey ?? null,
    details: `AVV erfasst: ${record.processorName}`,
    metadata: { area: 'dpa' },
  });
  return { ok: true, data: record };
}

/** Betroffenenanfrage erfassen — auditierbar, mit Frist und Aufgabe */
export async function capturePrivacyDataSubjectRequest(
  input: CapturePrivacyRequestInput,
  roleKey?: RoleKey | null,
  actorUserId?: string | null,
): Promise<ServiceResult<PrivacyDataSubjectRequest>> {
  const block = assertManageAccess<PrivacyDataSubjectRequest>(input.tenantId, roleKey);
  if (block) return block;

  const ctx = buildPrivacyAccessContext({
    tenantId: input.tenantId,
    roleKey: roleKey ?? null,
    userId: actorUserId,
  });
  const production = assertPrivacyProductionSafety(ctx);
  if (!production.allowed) return { ok: false, error: production.reason };

  const name = input.requesterName.trim();
  const email = input.requesterEmail.trim();
  if (!name) return { ok: false, error: 'Name des Antragstellers fehlt.' };
  if (!email.includes('@')) return { ok: false, error: 'Gültige E-Mail erforderlich.' };

  const now = nowIso();
  const receivedAt = now;
  const request: PrivacyDataSubjectRequest = {
    id: nextPrivacyRequestId(),
    tenantId: input.tenantId,
    requestType: input.requestType,
    status: 'received',
    requesterName: name,
    requesterEmail: email,
    requestNumber: nextRequestNumber(input.tenantId),
    clientId: input.clientId ?? null,
    employeeId: input.employeeId ?? null,
    profileId: input.profileId ?? null,
    identityVerified: false,
    identityCheckPrepared: false,
    verificationNotes: input.verificationNotes ?? null,
    receivedAt,
    dueAt: computeDueAt(receivedAt),
    completedAt: null,
    containsHealthData: input.containsHealthData ?? false,
    internalTaskId: null,
    createdAt: now,
    updatedAt: now,
  };

  const task = createInternalTask({
    tenantId: input.tenantId,
    taskType: 'privacy_request',
    title: `DSGVO-Anfrage ${request.requestNumber}`,
    description: `${input.requestType} — ${name}`,
    priority: 'high',
    linkedEntityType: 'privacy_request',
    linkedEntityId: request.id,
    source: 'system',
    dueAt: request.dueAt,
  });
  request.internalTaskId = task.id;

  PRIVACY_MANAGEMENT_STORE.dataSubjectRequests.push(request);

  audit({
    tenantId: input.tenantId,
    action: 'request_captured',
    entityType: 'data_subject_request',
    entityId: request.id,
    actorUserId: actorUserId ?? null,
    actorRoleKey: roleKey ?? null,
    details: `Betroffenenanfrage ${request.requestNumber} erfasst`,
    metadata: { requestType: input.requestType, taskId: task.id },
  });
  audit({
    tenantId: input.tenantId,
    action: 'task_created',
    entityType: 'internal_task',
    entityId: task.id,
    actorUserId: actorUserId ?? null,
    actorRoleKey: roleKey ?? null,
    details: 'Interne Datenschutz-Aufgabe angelegt',
    metadata: { requestId: request.id },
  });

  return { ok: true, data: request };
}

/** Identitätsprüfung vorbereitet — Statuswechsel + Audit */
export async function preparePrivacyIdentityCheck(
  tenantId: string,
  requestId: string,
  verified: boolean,
  notes: string | null,
  roleKey?: RoleKey | null,
  actorUserId?: string | null,
): Promise<ServiceResult<PrivacyDataSubjectRequest>> {
  const block = assertManageAccess<PrivacyDataSubjectRequest>(tenantId, roleKey);
  if (block) return block;

  const request = getPrivacyRequestById(tenantId, requestId);
  if (!request) return { ok: false, error: 'Anfrage nicht gefunden.' };

  const tenantCheck = assertPrivacyTenantScope(
    buildPrivacyAccessContext({ tenantId, roleKey: roleKey ?? null }),
    request.tenantId,
  );
  if (!tenantCheck.allowed) return { ok: false, error: tenantCheck.reason };

  const now = nowIso();
  request.identityCheckPrepared = true;
  request.identityVerified = verified;
  request.verificationNotes = notes;
  request.status = verified ? 'in_review' : 'identity_check_required';
  request.updatedAt = now;

  audit({
    tenantId,
    action: 'identity_check_prepared',
    entityType: 'data_subject_request',
    entityId: request.id,
    actorUserId: actorUserId ?? null,
    actorRoleKey: roleKey ?? null,
    details: verified ? 'Identität bestätigt' : 'Identitätsprüfung ausstehend',
    metadata: { verified },
  });

  return { ok: true, data: request };
}

/** Datenexport vorbereiten — Gesundheitsdaten nur mit view_sensitive */
export async function preparePrivacyDataExport(
  tenantId: string,
  requestId: string,
  includesHealthData: boolean,
  roleKey?: RoleKey | null,
  actorUserId?: string | null,
): Promise<ServiceResult<PrivacyDataExportJob>> {
  const block = assertManageAccess<PrivacyDataExportJob>(tenantId, roleKey);
  if (block) return block;

  const ctx = buildPrivacyAccessContext({
    tenantId,
    roleKey: roleKey ?? null,
    userId: actorUserId,
  });
  const production = assertPrivacyProductionSafety(ctx);
  if (!production.allowed) return { ok: false, error: production.reason };

  const request = getPrivacyRequestById(tenantId, requestId);
  if (!request) return { ok: false, error: 'Anfrage nicht gefunden.' };

  if (includesHealthData || request.containsHealthData) {
    const health = canExportPrivacyHealthData(ctx);
    if (!health.allowed) return { ok: false, error: health.reason ?? 'Export blockiert.' };
  }

  const now = nowIso();
  const job: PrivacyDataExportJob = {
    id: nextPrivacyExportJobId(),
    tenantId,
    requestId,
    status: 'queued',
    includesHealthData: includesHealthData || request.containsHealthData,
    exportPrepared: true,
    approvedByRole: roleKey ?? null,
    resultSummary: 'Export vorbereitet — keine automatische Auslieferung.',
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  PRIVACY_MANAGEMENT_STORE.exportJobs.push(job);
  request.status = 'processing';
  request.updatedAt = now;

  audit({
    tenantId,
    action: 'export_prepared',
    entityType: 'data_export_job',
    entityId: job.id,
    actorUserId: actorUserId ?? null,
    actorRoleKey: roleKey ?? null,
    details: includesHealthData ? 'Export mit Gesundheitsdaten vorbereitet' : 'Export vorbereitet',
    metadata: { requestId, includesHealthData: job.includesHealthData },
  });

  return { ok: true, data: job };
}

/** Löschantrag zur Prüfung — keine direkte Löschung */
export async function submitPrivacyDeletionForReview(
  tenantId: string,
  requestId: string,
  targetEntityType: PrivacyDeletionRequest['targetEntityType'],
  targetEntityId: string,
  entityCreatedAt: string,
  roleKey?: RoleKey | null,
  actorUserId?: string | null,
): Promise<ServiceResult<PrivacyDeletionRequest>> {
  const block = assertManageAccess<PrivacyDeletionRequest>(tenantId, roleKey);
  if (block) return block;

  const request = getPrivacyRequestById(tenantId, requestId);
  if (!request) return { ok: false, error: 'Anfrage nicht gefunden.' };
  if (request.requestType !== 'deletion') {
    return { ok: false, error: 'Nur Löschanfragen können geprüft werden.' };
  }

  seedDefaultPrivacyRetentionRules(tenantId);
  const retention = evaluateRetentionBlock(
    targetEntityType,
    entityCreatedAt,
    listPrivacyRetentionRules(tenantId),
  );

  const now = nowIso();
  const deletion: PrivacyDeletionRequest = {
    id: nextPrivacyDeletionId(),
    tenantId,
    requestId,
    targetEntityType,
    targetEntityId,
    reviewStatus: retention.blocked ? 'blocked_retention' : 'pending_review',
    retentionBlocked: retention.blocked,
    retentionRuleId: retention.rule?.id ?? null,
    reviewedByUserId: null,
    reviewedAt: null,
    reviewNotes: retention.reason,
    executedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  PRIVACY_MANAGEMENT_STORE.deletionRequests.push(deletion);
  request.status = retention.blocked ? 'in_review' : 'processing';
  request.updatedAt = now;

  audit({
    tenantId,
    action: retention.blocked ? 'deletion_blocked_retention' : 'deletion_reviewed',
    entityType: 'deletion_request',
    entityId: deletion.id,
    actorUserId: actorUserId ?? null,
    actorRoleKey: roleKey ?? null,
    details: retention.blocked
      ? (retention.reason ?? 'Löschung durch Aufbewahrungsfrist blockiert')
      : 'Löschantrag zur Prüfung eingereicht',
    metadata: { requestId, retentionBlocked: retention.blocked },
  });

  return { ok: true, data: deletion };
}

/** Löschprüfung — Freigabe markiert Status, führt aber keine Löschung aus */
export async function reviewPrivacyDeletionRequest(
  tenantId: string,
  deletionId: string,
  approved: boolean,
  reviewNotes: string,
  roleKey?: RoleKey | null,
  actorUserId?: string | null,
): Promise<ServiceResult<PrivacyDeletionRequest>> {
  const ctx = buildPrivacyAccessContext({ tenantId, roleKey: roleKey ?? null, userId: actorUserId });
  if (!canReviewPrivacyDeletion(ctx)) {
    return { ok: false, error: 'Keine Berechtigung für Löschprüfung.' };
  }

  const deletion = PRIVACY_MANAGEMENT_STORE.deletionRequests.find(
    (d) => d.tenantId === tenantId && d.id === deletionId,
  );
  if (!deletion) return { ok: false, error: 'Löschantrag nicht gefunden.' };
  if (deletion.retentionBlocked) {
    return { ok: false, error: 'Löschung durch Aufbewahrungsfrist blockiert — keine Freigabe möglich.' };
  }

  const now = nowIso();
  deletion.reviewStatus = approved ? 'approved' : 'rejected';
  deletion.reviewedByUserId = actorUserId ?? null;
  deletion.reviewedAt = now;
  deletion.reviewNotes = reviewNotes;
  deletion.updatedAt = now;

  const request = getPrivacyRequestById(tenantId, deletion.requestId);
  if (request) {
    request.status = approved ? 'completed' : 'rejected';
    request.completedAt = approved ? now : null;
    request.updatedAt = now;
  }

  audit({
    tenantId,
    action: 'deletion_reviewed',
    entityType: 'deletion_request',
    entityId: deletion.id,
    actorUserId: actorUserId ?? null,
    actorRoleKey: roleKey ?? null,
    details: approved ? 'Löschung freigegeben (Review)' : 'Löschung abgelehnt',
    metadata: { approved, reviewNotes },
  });

  return { ok: true, data: deletion };
}

export async function listPrivacyDataSubjectRequests(
  tenantId: string,
  roleKey?: RoleKey | null,
  requestType?: PrivacyRequestType,
): Promise<ServiceResult<PrivacyDataSubjectRequest[]>> {
  const block = assertViewAccess<PrivacyDataSubjectRequest[]>(tenantId, roleKey);
  if (block) return block;

  let rows = filterPrivacyRequestsForTenant(
    filterPrivacyByTenant(PRIVACY_MANAGEMENT_STORE.dataSubjectRequests, tenantId),
    tenantId,
  );
  if (requestType) {
    rows = rows.filter((r) => r.requestType === requestType);
  }
  return { ok: true, data: rows };
}

export async function createRetentionRule(
  tenantId: string,
  input: Omit<PrivacyRetentionRule, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'status'>,
  roleKey?: RoleKey | null,
): Promise<ServiceResult<PrivacyRetentionRule>> {
  const block = assertManageAccess<PrivacyRetentionRule>(tenantId, roleKey);
  if (block) return block;

  const now = nowIso();
  const rule: PrivacyRetentionRule = {
    id: nextPrivacyRetentionId(),
    tenantId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  PRIVACY_MANAGEMENT_STORE.retentionRules.push(rule);
  return { ok: true, data: rule };
}

export async function listConsentRecords(
  tenantId: string,
  roleKey?: RoleKey | null,
): Promise<ServiceResult<PrivacyConsentRecord[]>> {
  const block = assertViewAccess<PrivacyConsentRecord[]>(tenantId, roleKey);
  if (block) return block;
  return {
    ok: true,
    data: filterPrivacyByTenant(PRIVACY_MANAGEMENT_STORE.consentRecords, tenantId),
  };
}

export async function registerPrivacyConsent(
  tenantId: string,
  input: Omit<PrivacyConsentRecord, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  roleKey?: RoleKey | null,
): Promise<ServiceResult<PrivacyConsentRecord>> {
  const block = assertManageAccess<PrivacyConsentRecord>(tenantId, roleKey);
  if (block) return block;

  const now = nowIso();
  const record: PrivacyConsentRecord = {
    id: nextPrivacyConsentId(),
    tenantId,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  PRIVACY_MANAGEMENT_STORE.consentRecords.push(record);
  audit({
    tenantId,
    action: 'consent_updated',
    entityType: 'consent_record',
    entityId: record.id,
    actorUserId: null,
    actorRoleKey: roleKey ?? null,
    details: `Einwilligung ${record.consentType} erfasst`,
    metadata: { granted: record.granted },
  });
  return { ok: true, data: record };
}

export async function listPrivacyIncidents(
  tenantId: string,
  roleKey?: RoleKey | null,
): Promise<ServiceResult<PrivacyIncidentReport[]>> {
  const block = assertViewAccess<PrivacyIncidentReport[]>(tenantId, roleKey);
  if (block) return block;
  seedPreparedPrivacyIncidents(tenantId);
  return {
    ok: true,
    data: filterPrivacyByTenant(PRIVACY_MANAGEMENT_STORE.incidentReports, tenantId),
  };
}

export function computePrivacyRequestDeadlineInfo(request: PrivacyDataSubjectRequest): {
  dueAt: string;
  daysRemaining: number;
  overdue: boolean;
} {
  const now = new Date();
  const due = new Date(request.dueAt);
  const daysRemaining = Math.round((due.getTime() - now.getTime()) / MS_PER_DAY);
  return {
    dueAt: request.dueAt,
    daysRemaining,
    overdue: daysRemaining < 0,
  };
}

export function isPrivacyBackendReady(): boolean {
  return getServiceMode() === 'supabase';
}

export function guardPrivacyLiveFeature<T>(
  tenantId: string,
  featureLabel: string,
): ServiceResult<T> | null {
  return guardLiveDemoFeature<T>(tenantId, featureLabel);
}

export async function updatePrivacyRequestStatus(
  tenantId: string,
  requestId: string,
  status: PrivacyDataSubjectRequestStatus,
  roleKey?: RoleKey | null,
  actorUserId?: string | null,
): Promise<ServiceResult<PrivacyDataSubjectRequest>> {
  const block = assertManageAccess<PrivacyDataSubjectRequest>(tenantId, roleKey);
  if (block) return block;

  const request = getPrivacyRequestById(tenantId, requestId);
  if (!request) return { ok: false, error: 'Anfrage nicht gefunden.' };

  const now = nowIso();
  request.status = status;
  request.updatedAt = now;
  if (status === 'completed') request.completedAt = now;

  audit({
    tenantId,
    action: 'status_changed',
    entityType: 'data_subject_request',
    entityId: request.id,
    actorUserId: actorUserId ?? null,
    actorRoleKey: roleKey ?? null,
    details: `Status geändert: ${status}`,
    metadata: { status },
  });

  return { ok: true, data: request };
}

export function getPrivacyDeletionForRequest(
  tenantId: string,
  requestId: string,
): PrivacyDeletionRequest | null {
  return getPrivacyDeletionByRequestId(tenantId, requestId);
}

export {
  canViewPrivacyCompliance,
  canManagePrivacyCompliance,
  canExportPrivacyHealthData,
  evaluateRetentionBlock,
  buildPrivacyAccessContext,
};
