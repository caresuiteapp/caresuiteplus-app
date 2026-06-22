import type { RoleKey, ServiceResult } from '@/types';
import type {
  AbsenceAuditEvent,
  ClientPortalAbsenceHint,
  CreateAbsenceInput,
  CreateVacationRequestInput,
  EmployeeAbsence,
  EmployeeAbsenceRequest,
  EmployeePortalAbsenceView,
  RecordSickLeaveInput,
  VacationBalance,
} from '@/types/modules/employeeAbsence';
import { ABSENCE_TYPE_LABELS as TYPE_LABELS } from '@/types/modules/employeeAbsence';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { listAssignmentWorkflows } from '@/lib/assist/assignmentWorkflowService';
import { createManagementTask } from '@/lib/assist/managementTaskService';
import { createMonitorNotification } from '@/lib/assist/monitorNotificationService';
import {
  ABSENCE_STORE,
  filterByTenant,
  getAbsenceById,
  listAbsencesForTenant,
  nextAbsenceAuditId,
  nextAbsenceId,
  nextAbsenceRequestId,
  nextBalanceId,
} from './absenceStore';
import {
  countRequestedDays,
  detectAbsenceAssignmentConflicts,
  findAssignmentsOverlappingAbsence,
} from './absenceConflictService';
import { createReplacementRequestsForAbsence } from './replacementPlanningService';
import {
  buildCalendarEventFromAbsence,
  cancelCalendarEventBySourceAsync,
  syncCalendarEventFromAbsenceAsync,
} from '@/lib/calendar/calendarSyncService';

function nowIso(): string {
  return new Date().toISOString();
}

function audit(input: Omit<AbsenceAuditEvent, 'id' | 'createdAt'>): AbsenceAuditEvent {
  const event: AbsenceAuditEvent = {
    id: nextAbsenceAuditId(),
    createdAt: nowIso(),
    ...input,
  };
  ABSENCE_STORE.auditEvents.push(event);
  return event;
}

function upsertBalance(tenantId: string, employeeId: string, year: number): VacationBalance {
  let balance = ABSENCE_STORE.balances.find(
    (b) => b.tenantId === tenantId && b.employeeId === employeeId && b.year === year,
  );
  if (!balance) {
    const entitlement = ABSENCE_STORE.entitlements.find(
      (e) => e.tenantId === tenantId && e.employeeId === employeeId && e.year === year,
    );
    balance = {
      id: nextBalanceId(),
      tenantId,
      employeeId,
      year,
      entitledDays: entitlement?.entitledDays ?? 0,
      usedDays: 0,
      pendingDays: 0,
      remainingDays: entitlement?.entitledDays ?? 0,
      updatedAt: nowIso(),
    };
    ABSENCE_STORE.balances.push(balance);
  }
  return balance;
}

function recalculateBalance(tenantId: string, employeeId: string, year: number): VacationBalance {
  const balance = upsertBalance(tenantId, employeeId, year);
  const absences = listAbsencesForTenant(tenantId, employeeId).filter(
    (a) =>
      a.absenceType === 'vacation' &&
      new Date(a.startsAt).getFullYear() === year &&
      (a.status === 'approved' || a.status === 'active' || a.status === 'completed'),
  );
  const pending = listAbsencesForTenant(tenantId, employeeId).filter(
    (a) => a.absenceType === 'vacation' && a.status === 'requested' && new Date(a.startsAt).getFullYear() === year,
  );
  balance.usedDays = absences.reduce((sum, a) => sum + (a.requestedDays ?? 0), 0);
  balance.pendingDays = pending.reduce((sum, a) => sum + (a.requestedDays ?? 0), 0);
  balance.remainingDays = balance.entitledDays - balance.usedDays - balance.pendingDays;
  balance.updatedAt = nowIso();
  return balance;
}

function handleAbsenceSideEffects(
  absence: EmployeeAbsence,
  actorRoleKey?: RoleKey | null,
): void {
  const assignments = listAssignmentWorkflows(absence.tenantId);
  const overlapping = findAssignmentsOverlappingAbsence(absence, assignments);

  if (overlapping.length > 0) {
    absence.replacementRequired = true;
    createReplacementRequestsForAbsence(absence, overlapping);

    for (const assignment of overlapping) {
      createManagementTask({
        tenantId: absence.tenantId,
        assignmentId: assignment.id,
        taskType: 'absence_replacement',
        description: `Abwesenheit (${TYPE_LABELS[absence.absenceType]}) — Vertretung für „${assignment.title}“ erforderlich.`,
        priority: absence.absenceType === 'sick_leave' ? 'high' : 'normal',
      });
    }

    createMonitorNotification({
      tenantId: absence.tenantId,
      recipientType: 'admin',
      eventType: 'absence_conflict',
      title: 'Abwesenheitskonflikt',
      body: `${overlapping.length} Einsatz/Einsätze überschneiden sich mit Abwesenheit.`,
      priority: 'high',
    });
  }

  audit({
    tenantId: absence.tenantId,
    absenceId: absence.id,
    action: 'side_effects_processed',
    actorId: null,
    actorRole: actorRoleKey ?? null,
    summary: overlapping.length
      ? `${overlapping.length} Einsatzkonflikt(e) — Vertretung markiert.`
      : 'Keine Einsatzkonflikte.',
    metadata: { conflicts: String(overlapping.length) },
  });
}

export function sanitizeForEmployeePortal(
  absence: EmployeeAbsence,
  viewerEmployeeId: string,
): EmployeePortalAbsenceView | null {
  if (absence.employeeId !== viewerEmployeeId) {
    if (absence.absenceType === 'sick_leave' || absence.absenceType === 'child_sick_leave') {
      return null;
    }
  }
  return {
    id: absence.id,
    tenantId: absence.tenantId,
    employeeId: absence.employeeId,
    absenceType: absence.absenceType,
    status: absence.status,
    startsAt: absence.startsAt,
    endsAt: absence.endsAt,
    allDay: absence.allDay,
    employeeVisibleNote: absence.employeeVisibleNote,
    replacementRequired: absence.replacementRequired,
    requestedDays: absence.requestedDays,
    createdAt: absence.createdAt,
    updatedAt: absence.updatedAt,
    hasAuDocument: Boolean(absence.auDocumentId),
  };
}

export function sanitizeForClientPortal(absence: EmployeeAbsence): ClientPortalAbsenceHint {
  return {
    employeeId: absence.employeeId,
    startsAt: absence.startsAt,
    endsAt: absence.endsAt,
    category: 'unavailable',
  };
}

export function sanitizeAbsenceForViewer(
  absence: EmployeeAbsence,
  options: {
    viewerEmployeeId?: string | null;
    canViewSensitive: boolean;
    isTeamView?: boolean;
  },
): EmployeeAbsence {
  const copy = { ...absence };
  const isOwn = options.viewerEmployeeId === absence.employeeId;

  if (!options.canViewSensitive) {
    copy.sickDetails = null;
    copy.auDocumentId = null;
    if (absence.hideDetailsFromAdmin && !isOwn) {
      copy.internalNotes = '';
    }
  }

  if (!isOwn && !options.isTeamView && (absence.absenceType === 'sick_leave' || absence.absenceType === 'child_sick_leave')) {
    copy.sickDetails = null;
    copy.auDocumentId = null;
    copy.internalNotes = '';
  }

  return copy;
}

export async function createAbsence(
  input: CreateAbsenceInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<EmployeeAbsence>> {
  const denied = enforcePermission<EmployeeAbsence>(actorRoleKey, 'office.employees.absences.manage');
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<EmployeeAbsence>(input.tenantId, 'Abwesenheitsverwaltung');
  if (liveBlock) return liveBlock;

  if (!input.tenantId?.trim()) {
    return { ok: false, error: 'Abwesenheit ohne tenant_id nicht möglich.' };
  }

  const now = nowIso();
  const absence: EmployeeAbsence = {
    id: nextAbsenceId(),
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    absenceType: input.absenceType,
    status: input.status ?? 'approved',
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    allDay: input.allDay ?? true,
    internalNotes: input.internalNotes ?? '',
    employeeVisibleNote: input.employeeVisibleNote ?? '',
    sickDetails: null,
    auDocumentId: null,
    certificateDocumentId: null,
    replacementRequired: false,
    hideDetailsFromAdmin: input.hideDetailsFromAdmin ?? false,
    requestedDays: null,
    approvedBy: input.status === 'approved' || input.status === 'active' ? input.actorProfileId ?? null : null,
    approvedAt: input.status === 'approved' || input.status === 'active' ? now : null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    cancelledAt: null,
    qualificationUpdated: false,
    createdBy: input.actorProfileId ?? null,
    updatedBy: input.actorProfileId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  ABSENCE_STORE.absences.push(absence);

  audit({
    tenantId: absence.tenantId,
    absenceId: absence.id,
    action: 'absence_created',
    actorId: input.actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: `Abwesenheit (${TYPE_LABELS[absence.absenceType]}) angelegt.`,
  });

  if (absence.status === 'approved' || absence.status === 'active') {
    handleAbsenceSideEffects(absence, actorRoleKey);
  }

  syncCalendarEventFromAbsenceAsync(absence);

  return { ok: true, data: absence };
}

export async function requestVacation(
  input: CreateVacationRequestInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ absence: EmployeeAbsence; request: EmployeeAbsenceRequest }>> {
  const denied = enforcePermission<{ absence: EmployeeAbsence; request: EmployeeAbsenceRequest }>(
    actorRoleKey,
    'portal.employee.absences.request',
  );
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<{ absence: EmployeeAbsence; request: EmployeeAbsenceRequest }>(
    input.tenantId,
    'Urlaubsantrag',
  );
  if (liveBlock) return liveBlock;

  const requestedDays = countRequestedDays(
    input.startsAt,
    input.endsAt,
    input.halfDayStart,
    input.halfDayEnd,
  );
  const year = new Date(input.startsAt).getFullYear();
  const balance = recalculateBalance(input.tenantId, input.employeeId, year);
  if (balance.entitledDays > 0 && balance.remainingDays < requestedDays) {
    return { ok: false, error: 'Nicht genügend Urlaubstage verfügbar.' };
  }

  const now = nowIso();
  const absence: EmployeeAbsence = {
    id: nextAbsenceId(),
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    absenceType: 'vacation',
    status: 'requested',
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    allDay: !input.halfDayStart && !input.halfDayEnd,
    internalNotes: '',
    employeeVisibleNote: input.employeeNote ?? '',
    sickDetails: null,
    auDocumentId: null,
    certificateDocumentId: null,
    replacementRequired: false,
    hideDetailsFromAdmin: false,
    requestedDays,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    cancelledAt: null,
    qualificationUpdated: false,
    createdBy: input.actorProfileId ?? null,
    updatedBy: input.actorProfileId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const request: EmployeeAbsenceRequest = {
    id: nextAbsenceRequestId(),
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    absenceId: absence.id,
    requestedStartsAt: input.startsAt,
    requestedEndsAt: input.endsAt,
    requestedDays,
    halfDayStart: input.halfDayStart ?? false,
    halfDayEnd: input.halfDayEnd ?? false,
    employeeNote: input.employeeNote ?? '',
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  ABSENCE_STORE.absences.push(absence);
  ABSENCE_STORE.requests.push(request);
  recalculateBalance(input.tenantId, input.employeeId, year);

  audit({
    tenantId: input.tenantId,
    absenceId: absence.id,
    action: 'vacation_requested',
    actorId: input.actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: `Urlaubsantrag ${requestedDays} Tag(e).`,
    metadata: { requestId: request.id },
  });

  syncCalendarEventFromAbsenceAsync(absence);

  return { ok: true, data: { absence, request } };
}

export async function approveVacation(
  tenantId: string,
  absenceId: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<EmployeeAbsence>> {
  const denied = enforcePermission<EmployeeAbsence>(actorRoleKey, 'office.employees.absences.approve');
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<EmployeeAbsence>(tenantId, 'Urlaubsgenehmigung');
  if (liveBlock) return liveBlock;

  const absence = getAbsenceById(tenantId, absenceId);
  if (!absence) return { ok: false, error: 'Abwesenheit nicht gefunden.' };
  if (absence.absenceType !== 'vacation') return { ok: false, error: 'Kein Urlaubsantrag.' };
  if (absence.status !== 'requested') return { ok: false, error: 'Antrag nicht mehr offen.' };

  const assignmentConflicts = findAssignmentsOverlappingAbsence(
    absence,
    listAssignmentWorkflows(tenantId),
  );

  const now = nowIso();
  absence.status = assignmentConflicts.length > 0 ? 'requires_review' : 'approved';
  absence.approvedBy = actorProfileId ?? null;
  absence.approvedAt = now;
  absence.updatedBy = actorProfileId ?? null;
  absence.updatedAt = now;

  const req = ABSENCE_STORE.requests.find((r) => r.absenceId === absenceId);
  if (req) {
    req.status = 'approved';
    req.reviewedBy = actorProfileId ?? null;
    req.reviewedAt = now;
    req.updatedAt = now;
  }

  recalculateBalance(tenantId, absence.employeeId, new Date(absence.startsAt).getFullYear());
  handleAbsenceSideEffects(absence, actorRoleKey);

  audit({
    tenantId,
    absenceId,
    action: 'vacation_approved',
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: assignmentConflicts.length
      ? 'Urlaub genehmigt — Einsatzkonflikte zur Prüfung.'
      : 'Urlaub genehmigt.',
    metadata: { conflicts: String(assignmentConflicts.length) },
  });

  if (assignmentConflicts.length === 0) {
    createMonitorNotification({
      tenantId,
      recipientType: 'employee',
      recipientId: absence.employeeId,
      eventType: 'vacation_approved',
      title: 'Urlaub genehmigt',
      body: `Ihr Urlaubsantrag (${absence.startsAt.slice(0, 10)} – ${absence.endsAt.slice(0, 10)}) wurde genehmigt.`,
    });
  }

  syncCalendarEventFromAbsenceAsync(absence);

  return { ok: true, data: absence };
}

export async function rejectVacation(
  tenantId: string,
  absenceId: string,
  reason: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<EmployeeAbsence>> {
  const denied = enforcePermission<EmployeeAbsence>(actorRoleKey, 'office.employees.absences.approve');
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<EmployeeAbsence>(tenantId, 'Urlaubsablehnung');
  if (liveBlock) return liveBlock;

  const absence = getAbsenceById(tenantId, absenceId);
  if (!absence) return { ok: false, error: 'Abwesenheit nicht gefunden.' };

  const now = nowIso();
  absence.status = 'rejected';
  absence.rejectedBy = actorProfileId ?? null;
  absence.rejectedAt = now;
  absence.rejectionReason = reason;
  absence.updatedAt = now;

  const req = ABSENCE_STORE.requests.find((r) => r.absenceId === absenceId);
  if (req) {
    req.status = 'rejected';
    req.reviewedBy = actorProfileId ?? null;
    req.reviewedAt = now;
    req.updatedAt = now;
  }

  recalculateBalance(tenantId, absence.employeeId, new Date(absence.startsAt).getFullYear());

  audit({
    tenantId,
    absenceId,
    action: 'vacation_rejected',
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: 'Urlaubsantrag abgelehnt.',
    metadata: { reason },
  });

  return { ok: true, data: absence };
}

export async function cancelAbsence(
  tenantId: string,
  absenceId: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
): Promise<ServiceResult<EmployeeAbsence>> {
  const canManage = !enforcePermission(actorRoleKey, 'office.employees.absences.manage');
  const canRequest = !enforcePermission(actorRoleKey, 'portal.employee.absences.request');
  if (!canManage && !canRequest) {
    return { ok: false, error: 'Keine Berechtigung zum Stornieren.' };
  }

  const liveBlock = guardLiveDemoFeature<EmployeeAbsence>(tenantId, 'Abwesenheit stornieren');
  if (liveBlock) return liveBlock;

  const absence = getAbsenceById(tenantId, absenceId);
  if (!absence) return { ok: false, error: 'Abwesenheit nicht gefunden.' };

  absence.status = 'cancelled';
  absence.cancelledAt = nowIso();
  absence.updatedBy = actorProfileId ?? null;
  absence.updatedAt = nowIso();

  if (absence.absenceType === 'vacation') {
    recalculateBalance(tenantId, absence.employeeId, new Date(absence.startsAt).getFullYear());
  }

  audit({
    tenantId,
    absenceId,
    action: 'absence_cancelled',
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: 'Abwesenheit storniert.',
  });

  const sourceType = buildCalendarEventFromAbsence(absence).sourceType;
  cancelCalendarEventBySourceAsync(tenantId, sourceType, absenceId);

  return { ok: true, data: absence };
}

export async function recordSickLeave(
  input: RecordSickLeaveInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<EmployeeAbsence>> {
  const canManage = !enforcePermission(actorRoleKey, 'office.employees.absences.manage');
  const canRequest = !enforcePermission(actorRoleKey, 'portal.employee.absences.request');
  if (!canManage && !canRequest) {
    return { ok: false, error: 'Keine Berechtigung für Krankmeldung.' };
  }

  const liveBlock = guardLiveDemoFeature<EmployeeAbsence>(input.tenantId, 'Krankmeldung');
  if (liveBlock) return liveBlock;

  const now = nowIso();
  const absence: EmployeeAbsence = {
    id: nextAbsenceId(),
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    absenceType: 'sick_leave',
    status: 'active',
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    allDay: true,
    internalNotes: '',
    employeeVisibleNote: 'Krankgemeldet',
    sickDetails: input.sickDetails ?? null,
    auDocumentId: input.auDocumentId ?? null,
    certificateDocumentId: null,
    replacementRequired: false,
    hideDetailsFromAdmin: false,
    requestedDays: null,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    cancelledAt: null,
    qualificationUpdated: false,
    createdBy: input.actorProfileId ?? null,
    updatedBy: input.actorProfileId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  ABSENCE_STORE.absences.push(absence);
  handleAbsenceSideEffects(absence, actorRoleKey);

  createMonitorNotification({
    tenantId: input.tenantId,
    recipientType: 'admin',
    eventType: 'sick_leave_recorded',
    title: 'Krankmeldung erfasst',
    body: `Mitarbeitende:r ${input.employeeId} krankgemeldet.`,
    priority: 'high',
  });

  audit({
    tenantId: input.tenantId,
    absenceId: absence.id,
    action: 'sick_leave_recorded',
    actorId: input.actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: 'Krankmeldung erfasst — Einsätze geprüft.',
  });

  syncCalendarEventFromAbsenceAsync(absence);

  return { ok: true, data: absence };
}

export async function uploadAuDocument(
  tenantId: string,
  absenceId: string,
  documentId: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
  viewerEmployeeId?: string | null,
): Promise<ServiceResult<EmployeeAbsence>> {
  const canViewSensitive = enforcePermission(actorRoleKey, 'office.employees.absences.view_sensitive') === null;
  const canPortalRequest = enforcePermission(actorRoleKey, 'portal.employee.absences.request') === null;
  if (!canViewSensitive && !canPortalRequest) {
    return { ok: false, error: 'Keine Berechtigung für AU-Upload.' };
  }

  const liveBlock = guardLiveDemoFeature<EmployeeAbsence>(tenantId, 'AU-Upload');
  if (liveBlock) return liveBlock;

  const absence = getAbsenceById(tenantId, absenceId);
  if (!absence) return { ok: false, error: 'Abwesenheit nicht gefunden.' };
  if (absence.absenceType !== 'sick_leave' && absence.absenceType !== 'child_sick_leave') {
    return { ok: false, error: 'AU nur für Krankmeldungen.' };
  }

  if (!canViewSensitive && viewerEmployeeId && absence.employeeId !== viewerEmployeeId) {
    return { ok: false, error: 'Nur eigene Krankmeldungen.' };
  }

  absence.auDocumentId = documentId;
  absence.updatedBy = actorProfileId ?? null;
  absence.updatedAt = nowIso();

  audit({
    tenantId,
    absenceId,
    action: 'au_document_uploaded',
    actorId: actorProfileId ?? null,
    actorRole: actorRoleKey ?? null,
    summary: 'AU-Dokument hinterlegt.',
    metadata: { documentId },
  });

  return { ok: true, data: absence };
}

export function listAbsences(
  tenantId: string,
  filter?: { employeeId?: string; status?: EmployeeAbsence['status']; absenceType?: EmployeeAbsence['absenceType'] },
  actorRoleKey?: RoleKey | null,
  viewerEmployeeId?: string | null,
): ServiceResult<EmployeeAbsence[]> {
  const hasOfficeView = enforcePermission(actorRoleKey, 'office.employees.absences.view') === null;
  const hasPortalView = enforcePermission(actorRoleKey, 'portal.employee.absences.view') === null;
  if (!hasOfficeView && !hasPortalView) {
    return { ok: false, error: 'Keine Berechtigung für Abwesenheiten.' };
  }

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const isPortal = !hasOfficeView && hasPortalView;
  const canViewSensitive = enforcePermission(actorRoleKey, 'office.employees.absences.view_sensitive') === null;

  let items = listAbsencesForTenant(tenantId);
  if (filter?.employeeId) items = items.filter((a) => a.employeeId === filter.employeeId);
  if (filter?.status) items = items.filter((a) => a.status === filter.status);
  if (filter?.absenceType) items = items.filter((a) => a.absenceType === filter.absenceType);

  if (isPortal && viewerEmployeeId) {
    items = items.filter((a) => a.employeeId === viewerEmployeeId);
  }

  const isTeamView = !isPortal;
  return {
    ok: true,
    data: items.map((a) =>
      sanitizeAbsenceForViewer(a, {
        viewerEmployeeId,
        canViewSensitive,
        isTeamView,
      }),
    ),
  };
}

export function getVacationBalance(
  tenantId: string,
  employeeId: string,
  year: number,
  actorRoleKey?: RoleKey | null,
): ServiceResult<VacationBalance | null> {
  const hasOfficeView = enforcePermission(actorRoleKey, 'office.employees.absences.view') === null;
  const hasPortalView = enforcePermission(actorRoleKey, 'portal.employee.absences.view') === null;
  if (!hasOfficeView && !hasPortalView) {
    return { ok: false, error: 'Keine Berechtigung.' };
  }

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const balance = ABSENCE_STORE.balances.find(
    (b) => b.tenantId === tenantId && b.employeeId === employeeId && b.year === year,
  );
  if (!balance) {
    const entitlement = ABSENCE_STORE.entitlements.find(
      (e) => e.tenantId === tenantId && e.employeeId === employeeId && e.year === year,
    );
    if (!entitlement) return { ok: true, data: null };
    return { ok: true, data: recalculateBalance(tenantId, employeeId, year) };
  }
  return { ok: true, data: recalculateBalance(tenantId, employeeId, year) };
}

export function listAbsenceAuditTrail(tenantId: string, absenceId: string): AbsenceAuditEvent[] {
  return filterByTenant(ABSENCE_STORE.auditEvents, tenantId).filter((e) => e.absenceId === absenceId);
}

export function setVacationEntitlement(
  tenantId: string,
  employeeId: string,
  year: number,
  entitledDays: number,
): VacationBalance {
  let entitlement = ABSENCE_STORE.entitlements.find(
    (e) => e.tenantId === tenantId && e.employeeId === employeeId && e.year === year,
  );
  if (!entitlement) {
    entitlement = {
      id: nextBalanceId(),
      tenantId,
      employeeId,
      year,
      entitledDays,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    ABSENCE_STORE.entitlements.push(entitlement);
  } else {
    entitlement.entitledDays = entitledDays;
    entitlement.updatedAt = nowIso();
  }
  const balance = upsertBalance(tenantId, employeeId, year);
  balance.entitledDays = entitledDays;
  return recalculateBalance(tenantId, employeeId, year);
}

export { resetAbsenceStore } from './absenceStore';
