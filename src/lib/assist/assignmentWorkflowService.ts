import type { RoleKey, ServiceResult } from '@/types';
import type {
  AssignmentWorkflowAuditEvent,
  AssignmentWorkflowCreateInput,
  AssignmentWorkflowRecord,
  AssignmentWorkflowTask,
  AutomationNotification,
  CanonicalAssignmentStatus,
  ClientVisitRequestType,
  ScheduleEntry,
} from '@/types/modules/assignmentWorkflow';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { createDemoAssignmentSeed } from '@/data/demo/assistAssignments';
import { enforcePermission } from '@/lib/permissions';
import { buildWorkspaceAccessContext, canViewAssignment } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { detectAssignmentConflicts, hasBlockingConflicts } from './assignmentConflictService';
import { syncScheduleFromAssignments } from './scheduleFromAssignmentsService';
import { emitWorkflowLiveEvent, handleStatusSideEffects } from './liveMonitorOrchestrator';
import {
  getEmployeeAvailabilityBlocks,
  getPlanningBlockAbsences,
} from '@/lib/office/absenceStore';

type Store = {
  assignments: Map<string, AssignmentWorkflowRecord>;
  scheduleEntries: Map<string, ScheduleEntry>;
  auditEvents: AssignmentWorkflowAuditEvent[];
  notifications: AutomationNotification[];
};

const STORE: Store = {
  assignments: new Map(),
  scheduleEntries: new Map(),
  auditEvents: [],
  notifications: [],
};

let assignmentCounter = 0;
let taskCounter = 0;
let auditCounter = 0;
let notificationCounter = 0;

function durationMinutes(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
}

function resolveCanonicalStatus(employeeId: string | null, status: AssignmentStatus): CanonicalAssignmentStatus {
  if (!employeeId && status === 'geplant') return 'planned';
  if (employeeId && status === 'geplant') return 'assigned';
  const map: Partial<Record<AssignmentStatus, CanonicalAssignmentStatus>> = {
    bestaetigt: 'confirmed',
    unterwegs: 'on_the_way',
    angekommen: 'arrived',
    gestartet: 'started',
    pausiert: 'paused',
    beendet: 'finished',
    dokumentation_offen: 'documentation_pending',
    unterschrift_offen: 'signature_pending',
    abgeschlossen: 'completed',
    storniert: 'cancelled',
    nicht_erschienen: 'no_show',
  };
  return map[status] ?? 'planned';
}

function audit(input: Omit<AssignmentWorkflowAuditEvent, 'id' | 'createdAt'>): AssignmentWorkflowAuditEvent {
  auditCounter += 1;
  const event: AssignmentWorkflowAuditEvent = {
    id: `asg-audit-${auditCounter}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  STORE.auditEvents.push(event);
  return event;
}

function notify(input: Omit<AutomationNotification, 'id' | 'createdAt'>): void {
  notificationCounter += 1;
  STORE.notifications.push({
    id: `asg-notify-${notificationCounter}`,
    createdAt: new Date().toISOString(),
    ...input,
  });
}

function syncSchedule(): void {
  STORE.scheduleEntries.clear();
  for (const entry of syncScheduleFromAssignments([...STORE.assignments.values()])) {
    STORE.scheduleEntries.set(entry.id, entry);
  }
}

function upsertAssignment(record: AssignmentWorkflowRecord): AssignmentWorkflowRecord {
  const next = { ...record, updatedAt: new Date().toISOString() };
  STORE.assignments.set(record.id, next);
  syncSchedule();
  return next;
}

function conflictContext(tenantId: string) {
  return {
    employeeAbsences: getPlanningBlockAbsences(tenantId),
    employeeAvailability: getEmployeeAvailabilityBlocks(tenantId),
  };
}

/** Interner Upsert für abhängige Services (Mitarbeiterportal-Durchführung). */
export function upsertAssignmentWorkflowRecord(record: AssignmentWorkflowRecord): AssignmentWorkflowRecord {
  return upsertAssignment(record);
}

function buildTasks(
  tenantId: string,
  assignmentId: string,
  tasks: AssignmentWorkflowCreateInput['tasks'],
): AssignmentWorkflowTask[] {
  return tasks.map((task, index) => {
    taskCounter += 1;
    return {
      id: `task-${taskCounter}`,
      tenantId,
      assignmentId,
      taskTitle: task.title,
      taskDescription: task.description ?? '',
      taskCategory: task.category ?? 'standard',
      required: task.required ?? true,
      sortOrder: index + 1,
      status: 'open',
      completionNote: null,
      completedBy: null,
      completedAt: null,
    };
  });
}

export function createAssignmentWorkflow(
  input: AssignmentWorkflowCreateInput,
  actorRoleKey?: RoleKey | null,
): ServiceResult<AssignmentWorkflowRecord> {
  const denied = enforcePermission<AssignmentWorkflowRecord>(actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  if (!input.clientId?.trim()) {
    return { ok: false, error: 'Kein Einsatz ohne Klient:in.' };
  }

  if (!input.tenantId?.trim()) {
    return { ok: false, error: 'Kein Einsatz ohne tenant_id.' };
  }

  const employeeId = input.employeeId?.trim() ? input.employeeId.trim() : null;
  if (!employeeId && input.tasks.length === 0) {
    return { ok: false, error: 'Offener Einsatz benötigt mindestens eine Aufgabe.' };
  }

  assignmentCounter += 1;
  const id = `asg-wf-${assignmentCounter}`;
  const status: AssignmentStatus = employeeId ? 'bestaetigt' : 'geplant';
  const tasks = buildTasks(input.tenantId, id, input.tasks);

  const draft: AssignmentWorkflowRecord = {
    id,
    tenantId: input.tenantId,
    clientId: input.clientId,
    employeeId,
    serviceType: input.serviceType,
    assignmentType: input.assignmentType ?? 'single',
    plannedStartAt: input.plannedStartAt,
    plannedEndAt: input.plannedEndAt,
    plannedDurationMinutes: durationMinutes(input.plannedStartAt, input.plannedEndAt),
    actualStartAt: null,
    actualEndAt: null,
    status,
    canonicalStatus: resolveCanonicalStatus(employeeId, status),
    locationAddress: input.locationAddress,
    notesForEmployee: input.notesForEmployee ?? '',
    internalNotes: input.internalNotes ?? '',
    clientVisibleNotes: input.clientVisibleNotes ?? '',
    billingRelevant: input.billingRelevant ?? true,
    requiresSignature: input.requiresSignature ?? false,
    requiresDocumentation: input.requiresDocumentation ?? true,
    requiresRoute: input.requiresRoute ?? false,
    createdBy: input.createdBy ?? null,
    updatedBy: input.createdBy ?? null,
    cancelledAt: null,
    completedAt: null,
    lockedAt: null,
    title: input.title,
    tasks,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const conflicts = detectAssignmentConflicts({
    assignment: draft,
    existing: [...STORE.assignments.values()],
    ...conflictContext(input.tenantId),
    actorRoleKey,
  });
  if (hasBlockingConflicts(conflicts)) {
    return { ok: false, error: conflicts.find((c) => c.severity === 'error')?.message ?? 'Konflikt erkannt.' };
  }

  const saved = upsertAssignment(draft);

  createDemoAssignmentSeed({
    clientId: saved.clientId,
    employeeId: saved.employeeId ?? 'employee-open',
    title: saved.title,
    scheduledStart: saved.plannedStartAt,
    scheduledEnd: saved.plannedEndAt,
    location: saved.locationAddress,
    notes: saved.notesForEmployee,
  });

  audit({
    tenantId: saved.tenantId,
    assignmentId: saved.id,
    action: 'assignment_created',
    actorId: input.createdBy ?? null,
    summary: `Einsatz ${saved.title} angelegt.`,
    metadata: { tasks: String(saved.tasks.length) },
  });

  emitWorkflowLiveEvent({
    tenantId: saved.tenantId,
    assignmentId: saved.id,
    clientId: saved.clientId,
    currentStatus: saved.status,
    eventType: 'assignment_created',
    actorUserId: input.createdBy ?? null,
    source: 'administration',
  });

  notify({
    tenantId: saved.tenantId,
    assignmentId: saved.id,
    channel: 'dispatch',
    eventType: 'assignment_created',
    message: 'Kalender/Dienstplan aktualisiert.',
  });

  if (saved.employeeId) {
    notify({
      tenantId: saved.tenantId,
      assignmentId: saved.id,
      channel: 'employee',
      eventType: 'assignment_assigned',
      message: 'Neuer Einsatz zugewiesen.',
    });
  }

  return { ok: true, data: saved };
}

export function assignEmployeeToWorkflow(
  tenantId: string,
  assignmentId: string,
  employeeId: string,
  actorRoleKey?: RoleKey | null,
  actorId?: string | null,
): ServiceResult<AssignmentWorkflowRecord> {
  const denied = enforcePermission<AssignmentWorkflowRecord>(actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  const current = getAssignmentWorkflow(tenantId, assignmentId);
  if (!current) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const draft = {
    ...current,
    employeeId,
  };

  const conflicts = detectAssignmentConflicts({
    assignment: draft,
    existing: [...STORE.assignments.values()],
    ...conflictContext(tenantId),
    actorRoleKey,
  });
  if (hasBlockingConflicts(conflicts)) {
    return { ok: false, error: conflicts.find((c) => c.severity === 'error')?.message ?? 'Konflikt erkannt.' };
  }

  const updated = upsertAssignment({
    ...current,
    employeeId,
    status: 'bestaetigt',
    canonicalStatus: 'assigned',
    updatedBy: actorId ?? null,
  });

  audit({
    tenantId,
    assignmentId,
    action: 'employee_assigned',
    actorId: actorId ?? null,
    summary: `Mitarbeitende:r ${employeeId} zugewiesen.`,
  });

  emitWorkflowLiveEvent({
    tenantId,
    assignmentId,
    clientId: updated.clientId,
    currentStatus: updated.status,
    eventType: 'assignment_assigned',
    actorUserId: actorId ?? null,
    source: 'administration',
  });

  notify({
    tenantId,
    assignmentId,
    channel: 'employee',
    eventType: 'assignment_assigned',
    message: 'Einsatz zugewiesen — Mitarbeiterportal aktualisiert.',
  });

  return { ok: true, data: updated };
}

export function updateAssignmentWorkflow(
  tenantId: string,
  assignmentId: string,
  patch: Partial<Pick<AssignmentWorkflowRecord, 'plannedStartAt' | 'plannedEndAt' | 'locationAddress' | 'title' | 'notesForEmployee'>>,
  actorRoleKey?: RoleKey | null,
  actorId?: string | null,
): ServiceResult<AssignmentWorkflowRecord> {
  const denied = enforcePermission<AssignmentWorkflowRecord>(actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  const current = getAssignmentWorkflow(tenantId, assignmentId);
  if (!current) return { ok: false, error: 'Einsatz nicht gefunden.' };
  if (current.lockedAt) return { ok: false, error: 'Gesperrter Einsatz kann nicht geändert werden.' };

  const next: AssignmentWorkflowRecord = {
    ...current,
    ...patch,
    plannedDurationMinutes: durationMinutes(
      patch.plannedStartAt ?? current.plannedStartAt,
      patch.plannedEndAt ?? current.plannedEndAt,
    ),
    updatedBy: actorId ?? null,
  };

  const conflicts = detectAssignmentConflicts({
    assignment: next,
    existing: [...STORE.assignments.values()],
    ...conflictContext(tenantId),
    actorRoleKey,
  });
  if (hasBlockingConflicts(conflicts)) {
    return { ok: false, error: conflicts.find((c) => c.severity === 'error')?.message ?? 'Konflikt.' };
  }

  const saved = upsertAssignment(next);

  audit({
    tenantId,
    assignmentId,
    action: 'assignment_updated',
    actorId: actorId ?? null,
    summary: 'Einsatz geändert — Dienstplan synchronisiert.',
  });

  emitWorkflowLiveEvent({
    tenantId,
    assignmentId,
    clientId: saved.clientId,
    currentStatus: saved.status,
    eventType: 'assignment_updated',
    actorUserId: actorId ?? null,
    source: 'administration',
  });

  notify({
    tenantId,
    assignmentId,
    channel: 'employee',
    eventType: 'assignment_changed',
    message: 'Einsatz geändert.',
  });

  return { ok: true, data: saved };
}

export function requestVisitChange(
  tenantId: string,
  assignmentId: string,
  requestType: ClientVisitRequestType,
): ServiceResult<AssignmentWorkflowRecord> {
  const current = getAssignmentWorkflow(tenantId, assignmentId);
  if (!current) return { ok: false, error: 'Einsatz nicht gefunden.' };

  const canonicalStatus: CanonicalAssignmentStatus =
    requestType === 'cancel' ? 'cancel_requested' : 'reschedule_requested';

  const saved = upsertAssignment({
    ...current,
    canonicalStatus,
  });

  audit({
    tenantId,
    assignmentId,
    action: requestType === 'cancel' ? 'cancel_requested' : 'reschedule_requested',
    actorId: null,
    summary: `Anfrage erfasst — Einsatzzeit unverändert (${current.plannedStartAt}).`,
    metadata: { requestType },
  });

  handleStatusSideEffects({
    tenantId,
    assignmentId,
    clientId: current.clientId,
    employeeId: current.employeeId,
    oldStatus: current.status,
    newStatus: current.status,
    canonicalStatus,
    source: 'client_portal',
  });

  return { ok: true, data: saved };
}

export function getAssignmentWorkflow(tenantId: string, assignmentId: string): AssignmentWorkflowRecord | undefined {
  const record = STORE.assignments.get(assignmentId);
  if (!record || record.tenantId !== tenantId) return undefined;
  return record;
}

export function listAssignmentWorkflows(tenantId: string): AssignmentWorkflowRecord[] {
  return [...STORE.assignments.values()].filter((a) => a.tenantId === tenantId);
}

export function listScheduleEntries(tenantId: string): ScheduleEntry[] {
  return [...STORE.scheduleEntries.values()].filter((e) => e.tenantId === tenantId);
}

export function getAssignmentWorkflowAuditTrail(tenantId: string, assignmentId: string): AssignmentWorkflowAuditEvent[] {
  return STORE.auditEvents.filter((e) => e.tenantId === tenantId && e.assignmentId === assignmentId);
}

export function listWorkflowNotifications(tenantId: string, assignmentId?: string): AutomationNotification[] {
  return STORE.notifications.filter(
    (n) => n.tenantId === tenantId && (!assignmentId || n.assignmentId === assignmentId),
  );
}

export function getEmployeePortalTasks(tenantId: string, employeeId: string): AssignmentWorkflowTask[] {
  return listAssignmentWorkflows(tenantId)
    .filter((a) => a.employeeId === employeeId)
    .flatMap((a) => a.tasks);
}

export function getClientPortalAssignments(
  tenantId: string,
  clientId: string,
  roleKey: RoleKey | null,
): AssignmentWorkflowRecord[] {
  const ctx = buildWorkspaceAccessContext({ tenantId, roleKey, userId: 'portal', clientId });
  return listAssignmentWorkflows(tenantId).filter((a) =>
    canViewAssignment(ctx, {
      tenantId: a.tenantId,
      employeeId: a.employeeId ?? '',
      clientId: a.clientId,
    }).allowed,
  );
}

export function resetAssignmentWorkflowStore(): void {
  STORE.assignments.clear();
  STORE.scheduleEntries.clear();
  STORE.auditEvents.length = 0;
  STORE.notifications.length = 0;
  assignmentCounter = 0;
  taskCounter = 0;
  auditCounter = 0;
  notificationCounter = 0;
}

export { detectAssignmentConflicts, hasBlockingConflicts } from './assignmentConflictService';
export { syncScheduleFromAssignments, filterScheduleByView } from './scheduleFromAssignmentsService';
export type { AssignmentWorkflowRecord } from '@/types/modules/assignmentWorkflow';
