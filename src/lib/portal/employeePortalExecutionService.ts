import type { RoleKey, ServiceResult } from '@/types';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type {
  EmployeePortalAssignmentDetail,
  EmployeePortalAssignmentListItem,
  EmployeePortalCompletionResult,
  EmployeePortalDocumentationInput,
  EmployeePortalDocumentationRecord,
  EmployeePortalOverview,
  EmployeePortalPauseEvent,
  EmployeePortalRouteAction,
  EmployeePortalSignatureCaptureInput,
  EmployeePortalStatusHistoryEntry,
  EmployeePortalTaskItem,
} from '@/types/modules/employeePortalExecution';
import type { ExtendedAssignmentTaskStatus } from '@/types/modules/assignmentWorkflow';
import { demoClients } from '@/data/demo/clients';
import { getDemoClientDetail } from '@/data/demo/clientDetails';
import {
  buildWorkspaceAccessContext,
  canStartAssignment,
  canViewAssignment,
  logWorkspaceAccessEvent,
} from '@/lib/permissions/workspaceAccess';
import { enforcePermission, hasPermission } from '@/lib/permissions';
import {
  getAllowedAssignmentTransitions,
  isAssignmentLocked,
  taskStatusRequiresNote,
  validateExecutionTransition,
} from '@/lib/assist/assignmentStatusMachine';
import {
  getAssignmentWorkflow,
  getAssignmentWorkflowAuditTrail,
  listAssignmentWorkflows,
  listWorkflowNotifications,
  upsertAssignmentWorkflowRecord,
} from '@/lib/assist/assignmentWorkflowService';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import {
  canCaptureGps,
  canViewAccessHints,
  canViewEmergencyContact,
  resolveEnabledExecutionModules,
  type TenantModuleFlags,
} from './employeePortalModuleAccess';
import {
  captureEmployeePortalSignature,
  hasRequiredSignature,
  listEmployeePortalSignatures,
  lockEmployeePortalSignatures,
} from './employeePortalSignatureService';
import {
  applyEmployeePortalTrackingForStatus,
  peekEmployeePortalTrackingEntry,
  resetEmployeePortalVisitTrackingStore,
} from './employeePortalVisitTrackingService';
import {
  persistEmployeePortalSignature,
  persistEmployeePortalStatusTransition,
  persistEmployeePortalVisitProof,
  resetEmployeePortalPersistenceSessionStore,
} from './employeePortalVisitTrackingPersistence';

type ExecutionStore = {
  statusHistory: Map<string, EmployeePortalStatusHistoryEntry[]>;
  pauseEvents: Map<string, EmployeePortalPauseEvent[]>;
  documentations: Map<string, EmployeePortalDocumentationRecord>;
  signatureImpossible: Map<string, string>;
  lockedAssignments: Set<string>;
};

const STORE: ExecutionStore = {
  statusHistory: new Map(),
  pauseEvents: new Map(),
  documentations: new Map(),
  signatureImpossible: new Map(),
  lockedAssignments: new Set(),
};

let historyCounter = 0;
let pauseCounter = 0;

function storeKey(tenantId: string, assignmentId: string): string {
  return `${tenantId}:${assignmentId}`;
}

function clientName(clientId: string): string {
  const client = demoClients.find((c) => c.id === clientId);
  return client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
}

function assertEmployeeAccess(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  assignmentId: string,
): ServiceResult<never> | null {
  const record = getAssignmentWorkflow(tenantId, assignmentId);
  if (!record) {
    return { ok: false, error: 'Einsatz nicht gefunden.' };
  }

  const ctx = buildWorkspaceAccessContext({ tenantId, roleKey, employeeId, userId: employeeId });
  const view = canViewAssignment(ctx, {
    tenantId: record.tenantId,
    employeeId: record.employeeId ?? '',
    clientId: record.clientId,
  });
  if (!view.allowed) {
    logWorkspaceAccessEvent({
      tenantId,
      userId: employeeId,
      roleKey,
      action: 'assignment_access_denied',
      resourceType: 'assignment',
      resourceId: assignmentId,
      outcome: 'denied',
      summary: view.message ?? 'Zugriff verweigert.',
    });
    return { ok: false, error: view.message ?? 'Kein Zugriff auf diesen Einsatz.' };
  }

  return null;
}

function pushStatusHistory(
  tenantId: string,
  assignmentId: string,
  fromStatus: AssignmentStatus | null,
  toStatus: AssignmentStatus,
  actorId: string,
  note?: string,
): void {
  const key = storeKey(tenantId, assignmentId);
  historyCounter += 1;
  const entry: EmployeePortalStatusHistoryEntry = {
    id: `ep-hist-${historyCounter}`,
    fromStatus,
    toStatus,
    note: note ?? null,
    actorId,
    createdAt: new Date().toISOString(),
  };
  const list = STORE.statusHistory.get(key) ?? [];
  STORE.statusHistory.set(key, [...list, entry]);
}

function toListItem(record: NonNullable<ReturnType<typeof getAssignmentWorkflow>>): EmployeePortalAssignmentListItem {
  const doc = STORE.documentations.get(storeKey(record.tenantId, record.id));
  return {
    assignmentId: record.id,
    title: record.title,
    clientName: clientName(record.clientId),
    clientId: record.clientId,
    plannedStartAt: record.plannedStartAt,
    plannedEndAt: record.plannedEndAt,
    locationAddress: record.locationAddress,
    status: record.status,
    canonicalStatus: record.canonicalStatus,
    documentationPending:
      record.requiresDocumentation &&
      (record.status === 'beendet' || record.status === 'dokumentation_offen') &&
      !doc,
    signaturePending:
      record.requiresSignature &&
      (record.status === 'dokumentation_offen' || record.status === 'unterschrift_offen') &&
      !hasRequiredSignature(record.tenantId, record.id) &&
      !STORE.signatureImpossible.has(storeKey(record.tenantId, record.id)),
    isLocked: Boolean(record.lockedAt) || STORE.lockedAssignments.has(storeKey(record.tenantId, record.id)),
  };
}

function isSameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function isSameWeek(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  const start = new Date(ref);
  start.setDate(ref.getDate() - ref.getDay() + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}

function updateWorkflowStatus(
  tenantId: string,
  assignmentId: string,
  toStatus: AssignmentStatus,
  actorId: string,
  patch?: Partial<{ actualStartAt: string; actualEndAt: string; lockedAt: string; completedAt: string }>,
): ServiceResult<NonNullable<ReturnType<typeof getAssignmentWorkflow>>> {
  const record = getAssignmentWorkflow(tenantId, assignmentId);
  if (!record) return { ok: false, error: 'Einsatz nicht gefunden.' };

  if (record.lockedAt || STORE.lockedAssignments.has(storeKey(tenantId, assignmentId))) {
    return { ok: false, error: 'Abgeschlossener Einsatz ist gesperrt.' };
  }

  const doc = STORE.documentations.get(storeKey(tenantId, assignmentId));
  const validation = validateExecutionTransition(record.status, toStatus, {
    requireArrivedBeforeStart: true,
    hasDocumentation: Boolean(doc?.shortDescription?.trim()),
    hasRequiredSignature: record.requiresSignature
      ? hasRequiredSignature(tenantId, assignmentId)
      : true,
    signatureImpossibleJustified: Boolean(STORE.signatureImpossible.get(storeKey(tenantId, assignmentId))),
  });
  if (!validation.valid) return { ok: false, error: validation.error };

  const fromStatus = record.status;
  const now = new Date().toISOString();
  const next = {
    ...record,
    status: toStatus,
    canonicalStatus: record.canonicalStatus,
    updatedBy: actorId,
    actualStartAt:
      patch?.actualStartAt ??
      record.actualStartAt ??
      (toStatus === 'gestartet' ? now : record.actualStartAt),
    actualEndAt:
      patch?.actualEndAt ?? record.actualEndAt ?? (toStatus === 'beendet' ? now : record.actualEndAt),
    lockedAt: patch?.lockedAt ?? record.lockedAt,
    completedAt:
      patch?.completedAt ?? record.completedAt ?? (toStatus === 'abgeschlossen' ? now : record.completedAt),
    updatedAt: now,
  };

  upsertAssignmentWorkflowRecord(next);
  pushStatusHistory(tenantId, assignmentId, fromStatus, toStatus, actorId);
  return { ok: true, data: next };
}

function mapTasks(record: NonNullable<ReturnType<typeof getAssignmentWorkflow>>): EmployeePortalTaskItem[] {
  return record.tasks.map((task) => ({
    id: task.id,
    title: task.taskTitle,
    description: task.taskDescription,
    required: task.required,
    status: task.status,
    completionNote: task.completionNote,
    requiresNote: taskStatusRequiresNote(task.status),
  }));
}

function documentationStatus(
  record: NonNullable<ReturnType<typeof getAssignmentWorkflow>>,
): EmployeePortalAssignmentDetail['documentationStatus'] {
  const doc = STORE.documentations.get(storeKey(record.tenantId, record.id));
  if (!doc) return record.status === 'beendet' || record.status === 'dokumentation_offen' ? 'draft' : 'none';
  return doc.locked ? 'locked' : 'submitted';
}

function signatureStatus(
  record: NonNullable<ReturnType<typeof getAssignmentWorkflow>>,
): EmployeePortalAssignmentDetail['signatureStatus'] {
  if (!record.requiresSignature) return 'none';
  const key = storeKey(record.tenantId, record.id);
  if (STORE.signatureImpossible.has(key)) return 'impossible_justified';
  const sigs = listEmployeePortalSignatures(record.tenantId, record.id);
  if (sigs.some((s) => s.locked)) return 'locked';
  if (hasRequiredSignature(record.tenantId, record.id)) return 'captured';
  if (record.status === 'dokumentation_offen' || record.status === 'unterschrift_offen') return 'pending';
  return 'none';
}

export function fetchEmployeePortalOverview(
  tenantId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  tenantModules?: TenantModuleFlags,
): ServiceResult<EmployeePortalOverview> {
  const denied = enforcePermission<EmployeePortalOverview>(roleKey, 'portal.employee.appointments.view');
  if (denied && roleKey === 'employee_portal') return denied;

  const liveBlock = guardLiveDemoFeature<EmployeePortalOverview>(
    tenantId,
    'Mitarbeiterportal-Einsatzübersicht',
  );
  if (liveBlock) return liveBlock;

  void tenantModules;

  const now = new Date();
  const assignments = listAssignmentWorkflows(tenantId)
    .filter((a) => a.employeeId === employeeId)
    .map(toListItem)
    .sort((a, b) => a.plannedStartAt.localeCompare(b.plannedStartAt));

  const todayAssignments = assignments.filter((a) => isSameDay(a.plannedStartAt, now));
  const nextAssignments = assignments.filter((a) => new Date(a.plannedStartAt) > now && !a.isLocked);
  const weeklyPlan = assignments.filter((a) => isSameWeek(a.plannedStartAt, now));
  const notifications = listWorkflowNotifications(tenantId).filter((n) => n.channel === 'employee');

  return {
    ok: true,
    data: {
      todayAssignments,
      nextAssignments: nextAssignments.slice(0, 5),
      weeklyPlan,
      openDocumentations: assignments.filter((a) => a.documentationPending).length,
      missingSignatures: assignments.filter((a) => a.signaturePending).length,
      adminMessageCount: notifications.length,
      canReportProblem: hasPermission(roleKey, 'portal.employee.messages.view'),
    },
  };
}

export function fetchEmployeePortalAssignmentDetail(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  tenantModules?: TenantModuleFlags,
): ServiceResult<EmployeePortalAssignmentDetail> {
  const denied = enforcePermission<EmployeePortalAssignmentDetail>(
    roleKey,
    'portal.employee.appointments.view',
  );
  if (denied && roleKey === 'employee_portal') return denied;

  const liveBlock = guardLiveDemoFeature<EmployeePortalAssignmentDetail>(
    tenantId,
    'Mitarbeiterportal-Einsatzdetail',
  );
  if (liveBlock) return liveBlock;

  const accessDenied = assertEmployeeAccess(tenantId, employeeId, roleKey, assignmentId);
  if (accessDenied) return accessDenied;

  const record = getAssignmentWorkflow(tenantId, assignmentId);
  if (!record) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const clientDetail = getDemoClientDetail(record.clientId);
  const emergencyContact = clientDetail?.contacts?.find((c) => c.isEmergency);
  const ctx = buildWorkspaceAccessContext({ tenantId, roleKey, employeeId, userId: employeeId });
  const canStart = canStartAssignment(ctx, {
    tenantId: record.tenantId,
    employeeId: record.employeeId ?? '',
    clientId: record.clientId,
  });

  const key = storeKey(tenantId, assignmentId);
  const enabledModules = resolveEnabledExecutionModules(roleKey, tenantModules);

  return {
    ok: true,
    data: {
      assignmentId: record.id,
      tenantId: record.tenantId,
      title: record.title,
      clientId: record.clientId,
      clientName: clientName(record.clientId),
      locationAddress: record.locationAddress,
      plannedStartAt: record.plannedStartAt,
      plannedEndAt: record.plannedEndAt,
      actualStartAt: record.actualStartAt,
      actualEndAt: record.actualEndAt,
      status: record.status,
      canonicalStatus: record.canonicalStatus,
      notesForEmployee: record.notesForEmployee,
      accessHints:
        canViewAccessHints(roleKey) && clientDetail?.notes ? clientDetail.notes : null,
      emergencyContact:
        canViewEmergencyContact(roleKey) && emergencyContact
          ? `${emergencyContact.name}${emergencyContact.phone ? ` (${emergencyContact.phone})` : ''}`
          : null,
      tasks: mapTasks(record),
      statusHistory: STORE.statusHistory.get(key) ?? [],
      pauseEvents: STORE.pauseEvents.get(key) ?? [],
      documentationStatus: documentationStatus(record),
      signatureStatus: signatureStatus(record),
      requiresSignature: record.requiresSignature,
      requiresDocumentation: record.requiresDocumentation,
      requiresRoute: record.requiresRoute,
      canStartExecution: canStart.allowed && !isAssignmentLocked(record.status),
      canOpenRoute: record.requiresRoute || Boolean(record.locationAddress),
      canCaptureGps: canCaptureGps(roleKey),
      allowedTransitions: getAllowedAssignmentTransitions(record.status),
      isLocked: Boolean(record.lockedAt) || STORE.lockedAssignments.has(key),
      enabledModules,
    },
  };
}

export async function transitionEmployeePortalAssignment(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  toStatus: AssignmentStatus,
): Promise<ServiceResult<EmployeePortalAssignmentDetail>> {
  const denied = enforcePermission<EmployeePortalAssignmentDetail>(roleKey, 'assist.execution.manage');
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<EmployeePortalAssignmentDetail>(
    tenantId,
    'Mitarbeiterportal-Statuswechsel',
  );
  if (liveBlock) return liveBlock;

  const accessDenied = assertEmployeeAccess(tenantId, employeeId, roleKey, assignmentId);
  if (accessDenied) return accessDenied;

  const record = getAssignmentWorkflow(tenantId, assignmentId);
  if (!record) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const startCtx = buildWorkspaceAccessContext({ tenantId, roleKey, employeeId, userId: employeeId });
  const startDenied = canStartAssignment(startCtx, {
    tenantId,
    employeeId: record.employeeId ?? '',
    clientId: record.clientId,
  });
  if (!startDenied.allowed) {
    return { ok: false, error: startDenied.message ?? 'Einsatzstart nicht freigegeben.' };
  }

  if (toStatus === 'pausiert') {
    pauseCounter += 1;
    const key = storeKey(tenantId, assignmentId);
    const pauses = STORE.pauseEvents.get(key) ?? [];
    STORE.pauseEvents.set(key, [
      ...pauses,
      { id: `ep-pause-${pauseCounter}`, pausedAt: new Date().toISOString(), resumedAt: null, reason: null },
    ]);
  }

  if (toStatus === 'gestartet' && record.status === 'pausiert') {
    const key = storeKey(tenantId, assignmentId);
    const pauses = STORE.pauseEvents.get(key) ?? [];
    const openPause = [...pauses].reverse().find((p) => !p.resumedAt);
    if (openPause) {
      openPause.resumedAt = new Date().toISOString();
      STORE.pauseEvents.set(key, pauses);
    }
  }

  const fromStatus = record.status;
  const updated = updateWorkflowStatus(tenantId, assignmentId, toStatus, employeeId);
  if (!updated.ok) return updated;

  applyEmployeePortalTrackingForStatus(tenantId, assignmentId, fromStatus, toStatus);

  const entry = peekEmployeePortalTrackingEntry(tenantId, assignmentId);
  await persistEmployeePortalStatusTransition(
    {
      tenantId,
      assignmentId,
      employeeId,
      profileId: employeeId,
      locationAddress: record.locationAddress,
    },
    fromStatus,
    toStatus,
    entry.geofenceLastCheck,
  );

  logWorkspaceAccessEvent({
    tenantId,
    userId: employeeId,
    roleKey,
    action: 'assignment_status_change',
    resourceType: 'assignment',
    resourceId: assignmentId,
    outcome: 'allowed',
    summary: `Status → ${toStatus}`,
  });

  return fetchEmployeePortalAssignmentDetail(tenantId, assignmentId, employeeId, roleKey);
}

export function updateEmployeePortalTask(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  taskId: string,
  status: ExtendedAssignmentTaskStatus,
  completionNote?: string,
): ServiceResult<EmployeePortalAssignmentDetail> {
  const denied = enforcePermission<EmployeePortalAssignmentDetail>(roleKey, 'assist.execution.manage');
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<EmployeePortalAssignmentDetail>(
    tenantId,
    'Mitarbeiterportal-Aufgabe',
  );
  if (liveBlock) return liveBlock;

  const accessDenied = assertEmployeeAccess(tenantId, employeeId, roleKey, assignmentId);
  if (accessDenied) return accessDenied;

  if (taskStatusRequiresNote(status) && !completionNote?.trim()) {
    return { ok: false, error: 'Abweichung erfordert eine Begründung.' };
  }

  const record = getAssignmentWorkflow(tenantId, assignmentId);
  if (!record) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const tasks = record.tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          status,
          completionNote: completionNote?.trim() ?? null,
          completedBy: status === 'done' ? employeeId : task.completedBy,
          completedAt: status === 'done' ? new Date().toISOString() : task.completedAt,
        }
      : task,
  );

  upsertAssignmentWorkflowRecord({ ...record, tasks, updatedBy: employeeId });

  return fetchEmployeePortalAssignmentDetail(tenantId, assignmentId, employeeId, roleKey);
}

export function submitEmployeePortalDocumentation(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  input: EmployeePortalDocumentationInput,
): ServiceResult<EmployeePortalAssignmentDetail> {
  const denied = enforcePermission<EmployeePortalAssignmentDetail>(roleKey, 'assist.execution.manage');
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<EmployeePortalAssignmentDetail>(
    tenantId,
    'Mitarbeiterportal-Dokumentation',
  );
  if (liveBlock) return liveBlock;

  const accessDenied = assertEmployeeAccess(tenantId, employeeId, roleKey, assignmentId);
  if (accessDenied) return accessDenied;

  if (!input.shortDescription.trim()) {
    return { ok: false, error: 'Kurzbeschreibung ist erforderlich.' };
  }

  if (input.deviations?.trim() && !input.deviationJustification?.trim()) {
    return { ok: false, error: 'Abweichungen müssen begründet werden.' };
  }

  const record = getAssignmentWorkflow(tenantId, assignmentId);
  if (!record) return { ok: false, error: 'Einsatz nicht gefunden.' };

  if (record.status !== 'beendet' && record.status !== 'dokumentation_offen') {
    return { ok: false, error: 'Dokumentation erst nach Beendigung möglich.' };
  }

  const key = storeKey(tenantId, assignmentId);
  const existing = STORE.documentations.get(key);
  if (existing?.locked) {
    return { ok: false, error: 'Finalisierte Dokumentation kann nicht geändert werden.' };
  }

  const doc: EmployeePortalDocumentationRecord = {
    ...input,
    assignmentId,
    tenantId,
    submittedAt: new Date().toISOString(),
    submittedBy: employeeId,
    locked: false,
  };
  STORE.documentations.set(key, doc);

  let statusResult = updateWorkflowStatus(tenantId, assignmentId, 'dokumentation_offen', employeeId);
  if (!statusResult.ok) return statusResult;

  if (record.requiresSignature) {
    statusResult = updateWorkflowStatus(tenantId, assignmentId, 'unterschrift_offen', employeeId);
    if (!statusResult.ok) return statusResult;
  }

  return fetchEmployeePortalAssignmentDetail(tenantId, assignmentId, employeeId, roleKey);
}

export async function captureEmployeePortalAssignmentSignature(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  roleKey: RoleKey | null,
  input: EmployeePortalSignatureCaptureInput,
): Promise<ServiceResult<EmployeePortalAssignmentDetail>> {
  const denied = enforcePermission<EmployeePortalAssignmentDetail>(roleKey, 'assist.records.sign');
  if (denied) return denied;

  const liveBlock = guardLiveDemoFeature<EmployeePortalAssignmentDetail>(
    tenantId,
    'Mitarbeiterportal-Unterschrift',
  );
  if (liveBlock) return liveBlock;

  const accessDenied = assertEmployeeAccess(tenantId, employeeId, roleKey, assignmentId);
  if (accessDenied) return accessDenied;

  const record = getAssignmentWorkflow(tenantId, assignmentId);
  if (!record) return { ok: false, error: 'Einsatz nicht gefunden.' };

  if (input.signatureImpossibleReason?.trim()) {
    STORE.signatureImpossible.set(storeKey(tenantId, assignmentId), input.signatureImpossibleReason.trim());
    return fetchEmployeePortalAssignmentDetail(tenantId, assignmentId, employeeId, roleKey);
  }

  const result = captureEmployeePortalSignature(
    tenantId,
    assignmentId,
    record.clientId,
    employeeId,
    input,
  );
  if (!result.ok) return result;

  if (input.signatureDataUrl?.trim()) {
    const persist = await persistEmployeePortalSignature(
      {
        tenantId,
        assignmentId,
        employeeId,
        profileId: employeeId,
        locationAddress: record.locationAddress,
      },
      input,
      {
        visitId: assignmentId,
        clientId: record.clientId,
        employeeId: record.employeeId,
        plannedStartAt: record.plannedStartAt,
        plannedEndAt: record.plannedEndAt,
        taskStatuses: record.tasks.map((t) => ({ taskId: t.id, status: t.status })),
        documentationNote: STORE.documentations.get(storeKey(tenantId, assignmentId))?.shortDescription ?? null,
      },
    );
    if (!persist.ok) return { ok: false, error: persist.error ?? 'Signatur konnte nicht gespeichert werden.' };
  }

  if (record.status === 'unterschrift_offen' || record.status === 'dokumentation_offen') {
    updateWorkflowStatus(tenantId, assignmentId, 'unterschrift_offen', employeeId);
  }

  return fetchEmployeePortalAssignmentDetail(tenantId, assignmentId, employeeId, roleKey);
}

export async function completeEmployeePortalAssignment(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  roleKey: RoleKey | null,
): Promise<ServiceResult<EmployeePortalCompletionResult>> {
  const denied = enforcePermission<EmployeePortalCompletionResult>(roleKey, 'assist.execution.manage');
  if (denied) return denied;

  if (getServiceMode() === 'supabase') {
    return {
      ok: false,
      error: 'Mitarbeiterportal-Abschluss im Live-Modus über executionService.',
    };
  }

  const accessDenied = assertEmployeeAccess(tenantId, employeeId, roleKey, assignmentId);
  if (accessDenied) return accessDenied;

  const record = getAssignmentWorkflow(tenantId, assignmentId);
  if (!record) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const key = storeKey(tenantId, assignmentId);
  const doc = STORE.documentations.get(key);
  if (record.requiresDocumentation && !doc?.shortDescription?.trim()) {
    return { ok: false, error: 'Pflichtdokumentation fehlt.' };
  }

  const openRequiredTasks = record.tasks.filter(
    (t) => t.required && t.status !== 'done' && t.status !== 'requires_follow_up',
  );
  if (openRequiredTasks.length > 0) {
    return { ok: false, error: 'Pflichtaufgaben sind noch offen.' };
  }

  const sigOk =
    !record.requiresSignature ||
    hasRequiredSignature(tenantId, assignmentId) ||
    Boolean(STORE.signatureImpossible.get(key));
  if (!sigOk) {
    return { ok: false, error: 'Unterschrift erforderlich.' };
  }

  const completion = updateWorkflowStatus(tenantId, assignmentId, 'abgeschlossen', employeeId, {
    lockedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });
  if (!completion.ok) return completion;

  if (doc) {
    STORE.documentations.set(key, { ...doc, locked: true });
  }
  lockEmployeePortalSignatures(tenantId, assignmentId);
  STORE.lockedAssignments.add(key);

  const docRecord = STORE.documentations.get(key);
  await persistEmployeePortalVisitProof(
    {
      tenantId,
      assignmentId,
      employeeId,
      profileId: employeeId,
      locationAddress: record.locationAddress,
    },
    {
      assignmentId,
      clientId: record.clientId,
      title: record.title,
      status: 'abgeschlossen',
      documentation: docRecord?.shortDescription ?? null,
      tasks: record.tasks.map((t) => ({ id: t.id, status: t.status, title: t.taskTitle })),
      completedAt: completion.data.completedAt ?? new Date().toISOString(),
    },
  );

  const auditId = `ep-complete-${Date.now()}`;
  logWorkspaceAccessEvent({
    tenantId,
    userId: employeeId,
    roleKey,
    action: 'assignment_completed',
    resourceType: 'assignment',
    resourceId: assignmentId,
    outcome: 'allowed',
    summary: 'Einsatz abgeschlossen und gesperrt.',
  });

  return {
    ok: true,
    data: {
      assignmentId,
      status: 'abgeschlossen',
      lockedAt: completion.data.lockedAt ?? new Date().toISOString(),
      serviceProofJobId: `proof-job-${assignmentId}`,
      auditEventId: auditId,
    },
  };
}

export function buildEmployeePortalRoute(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  roleKey: RoleKey | null,
): ServiceResult<EmployeePortalRouteAction> {
  const denied = enforcePermission<EmployeePortalRouteAction>(roleKey, 'portal.employee.appointments.view');
  if (denied && roleKey === 'employee_portal') return denied;

  const accessDenied = assertEmployeeAccess(tenantId, employeeId, roleKey, assignmentId);
  if (accessDenied) return accessDenied;

  const record = getAssignmentWorkflow(tenantId, assignmentId);
  if (!record) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const encoded = encodeURIComponent(record.locationAddress);
  return {
    ok: true,
    data: {
      mapUrl: `https://maps.google.com/?q=${encoded}`,
      internalMapAvailable: canCaptureGps(roleKey),
    },
  };
}

export function getEmployeePortalExecutionAuditTrail(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  roleKey: RoleKey | null,
): ServiceResult<EmployeePortalStatusHistoryEntry[]> {
  const accessDenied = assertEmployeeAccess(tenantId, employeeId, roleKey, assignmentId);
  if (accessDenied) return accessDenied;

  void getAssignmentWorkflowAuditTrail(tenantId, assignmentId);

  return {
    ok: true,
    data: STORE.statusHistory.get(storeKey(tenantId, assignmentId)) ?? [],
  };
}

export function peekEmployeePortalPauseEvents(
  tenantId: string,
  assignmentId: string,
): EmployeePortalPauseEvent[] {
  return STORE.pauseEvents.get(storeKey(tenantId, assignmentId)) ?? [];
}

export function peekEmployeePortalStatusHistory(
  tenantId: string,
  assignmentId: string,
): EmployeePortalStatusHistoryEntry[] {
  return STORE.statusHistory.get(storeKey(tenantId, assignmentId)) ?? [];
}

export function resetEmployeePortalExecutionStore(): void {
  STORE.statusHistory.clear();
  STORE.pauseEvents.clear();
  STORE.documentations.clear();
  STORE.signatureImpossible.clear();
  STORE.lockedAssignments.clear();
  historyCounter = 0;
  pauseCounter = 0;
  resetEmployeePortalVisitTrackingStore();
  resetEmployeePortalPersistenceSessionStore();
}
