import type { RoleKey, ServiceResult } from '@/types';
import type {
  ManagementTask,
  ManagementTaskPriority,
  ManagementTaskRelatedEntityType,
  ManagementTaskStatus,
  ManagementTaskType,
} from '@/types/modules/liveMonitor';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { createInternalTaskFromManagementTask } from '@/lib/tasks/internalTaskService';
import { appendQmAuditEvent } from './qmCockpitStore';
import {
  LIVE_MONITOR_STORE,
  filterByTenant,
  nextTaskId,
} from './liveMonitorStore';

const TASK_TITLES: Record<ManagementTaskType, string> = {
  missing_documentation: 'Dokumentation fehlt',
  missing_signature: 'Unterschrift fehlt',
  review_service_record: 'Leistungsnachweis prüfen',
  review_exception: 'Signatur-Ausnahme prüfen',
  correction_requested: 'Korrektur angefordert',
  billing_blocker: 'Abrechnungsblocker',
  client_cancel_request: 'Absage prüfen',
  client_reschedule_request: 'Verschiebung prüfen',
  problem_report: 'Problem melden — Prüfung',
  emergency_follow_up: 'Notfall — Nachverfolgung',
  complaint: 'Beschwerde bearbeiten',
  missing_contract: 'Vertrag fehlt',
  missing_consent: 'Einwilligung fehlt',
  budget_warning: 'Budget-Warnung',
  employee_late: 'Verspätung / Überzug',
  no_show_follow_up: 'Nicht angetroffen — Nachverfolgung',
  audit_review: 'Interne Prüfung',
  billing_release: 'Abrechnungsfreigabe',
  service_proof_review: 'Leistungsnachweis prüfen',
  master_data_review: 'Stammdaten prüfen',
  cancel_review: 'Absage prüfen',
  reschedule_review: 'Verschiebung prüfen',
  problem_review: 'Problem melden — Prüfung',
  emergency_review: 'Notfall — sofortige Prüfung',
  correction_review: 'Korrektur prüfen',
  absence_replacement: 'Vertretung erforderlich',
  absence_conflict: 'Abwesenheitskonflikt prüfen',
};

export type CreateManagementTaskInput = {
  tenantId: string;
  taskType: ManagementTaskType;
  title?: string;
  description?: string;
  priority?: ManagementTaskPriority;
  assignmentId?: string | null;
  clientId?: string | null;
  employeeId?: string | null;
  relatedEntityType?: ManagementTaskRelatedEntityType | null;
  relatedEntityId?: string | null;
  dueAt?: string | null;
  assignedTo?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, string>;
  dedupeKey?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function isTerminalStatus(status: ManagementTaskStatus): boolean {
  return status === 'resolved' || status === 'rejected' || status === 'archived';
}

export function createManagementTask(input: CreateManagementTaskInput): ManagementTask {
  const dedupeKey =
    input.dedupeKey ??
    [
      input.tenantId,
      input.taskType,
      input.assignmentId ?? '',
      input.relatedEntityId ?? '',
    ].join(':');

  const existing = LIVE_MONITOR_STORE.managementTasks.find(
    (t) =>
      t.tenantId === input.tenantId &&
      t.metadata?.dedupeKey === dedupeKey &&
      !isTerminalStatus(t.status),
  );
  if (existing) return existing;

  const timestamp = nowIso();
  const task: ManagementTask = {
    id: nextTaskId(),
    tenantId: input.tenantId,
    taskType: input.taskType,
    status: 'open',
    title: input.title ?? TASK_TITLES[input.taskType],
    description: input.description ?? TASK_TITLES[input.taskType],
    priority: input.priority ?? 'normal',
    relatedEntityType: input.relatedEntityType ?? null,
    relatedEntityId: input.relatedEntityId ?? null,
    clientId: input.clientId ?? null,
    employeeId: input.employeeId ?? null,
    assignmentId: input.assignmentId ?? null,
    dueAt: input.dueAt ?? null,
    assignedTo: input.assignedTo ?? null,
    createdBy: input.createdBy ?? null,
    createdAt: timestamp,
    updatedBy: input.createdBy ?? null,
    updatedAt: timestamp,
    resolvedBy: null,
    resolvedAt: null,
    archivedAt: null,
    metadata: { ...(input.metadata ?? {}), dedupeKey },
  };
  LIVE_MONITOR_STORE.managementTasks.push(task);

  appendQmAuditEvent({
    tenantId: input.tenantId,
    action: 'management_task.created',
    entityType: 'management_task',
    entityId: task.id,
    assignmentId: task.assignmentId,
    actorId: input.createdBy ?? null,
    summary: `Verwaltungsaufgabe erstellt: ${task.title}`,
    metadata: { taskType: task.taskType },
  });

  createInternalTaskFromManagementTask({
    tenantId: input.tenantId,
    managementTaskId: task.id,
    assignmentId: task.assignmentId ?? '',
    taskType: task.taskType,
    title: task.title,
    description: task.description,
    priority: task.priority,
  });

  return task;
}

export type ManagementTaskListFilter = {
  assignmentId?: string;
  clientId?: string;
  employeeId?: string;
  status?: ManagementTaskStatus;
  taskType?: ManagementTaskType;
  assignedTo?: string;
  search?: string;
};

export function listManagementTasks(
  tenantId: string,
  filter?: ManagementTaskListFilter,
): ManagementTask[] {
  if (!tenantId?.trim()) return [];
  return filterByTenant(LIVE_MONITOR_STORE.managementTasks, tenantId).filter((t) => {
    if (filter?.assignmentId && t.assignmentId !== filter.assignmentId) return false;
    if (filter?.clientId && t.clientId !== filter.clientId) return false;
    if (filter?.employeeId && t.employeeId !== filter.employeeId) return false;
    if (filter?.status && t.status !== filter.status) return false;
    if (filter?.taskType && t.taskType !== filter.taskType) return false;
    if (filter?.assignedTo && t.assignedTo !== filter.assignedTo) return false;
    if (filter?.search?.trim()) {
      const q = filter.search.trim().toLowerCase();
      const haystack = `${t.title} ${t.description}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function getManagementTask(tenantId: string, taskId: string): ManagementTask | null {
  return (
    LIVE_MONITOR_STORE.managementTasks.find((t) => t.id === taskId && t.tenantId === tenantId) ?? null
  );
}

export function assignManagementTask(
  tenantId: string,
  taskId: string,
  assignedTo: string,
  actorId?: string | null,
): ManagementTask | null {
  const task = getManagementTask(tenantId, taskId);
  if (!task) return null;
  task.assignedTo = assignedTo;
  task.status = 'in_progress';
  task.updatedBy = actorId ?? null;
  task.updatedAt = nowIso();
  appendQmAuditEvent({
    tenantId,
    action: 'management_task.assigned',
    entityType: 'management_task',
    entityId: task.id,
    assignmentId: task.assignmentId,
    actorId: actorId ?? null,
    summary: `Aufgabe zugewiesen an ${assignedTo}`,
  });
  return task;
}

export function commentManagementTask(
  tenantId: string,
  taskId: string,
  comment: string,
  actorId?: string | null,
): ManagementTask | null {
  const task = getManagementTask(tenantId, taskId);
  if (!task) return null;
  const note = `[${nowIso()}] ${comment}`;
  task.description = task.description ? `${task.description}\n${note}` : note;
  task.updatedBy = actorId ?? null;
  task.updatedAt = nowIso();
  appendQmAuditEvent({
    tenantId,
    action: 'management_task.comment',
    entityType: 'management_task',
    entityId: task.id,
    assignmentId: task.assignmentId,
    actorId: actorId ?? null,
    summary: 'Kommentar zur Verwaltungsaufgabe',
  });
  return task;
}

export function updateManagementTaskStatus(
  tenantId: string,
  taskId: string,
  status: ManagementTaskStatus,
  actorId?: string | null,
): ManagementTask | null {
  const task = getManagementTask(tenantId, taskId);
  if (!task) return null;
  task.status = status;
  task.updatedBy = actorId ?? null;
  task.updatedAt = nowIso();
  if (status === 'resolved' || status === 'rejected') {
    task.resolvedBy = actorId ?? null;
    task.resolvedAt = nowIso();
  }
  if (status === 'archived') {
    task.archivedAt = nowIso();
    if (!task.resolvedAt) {
      task.resolvedBy = actorId ?? null;
      task.resolvedAt = task.archivedAt;
    }
  }
  appendQmAuditEvent({
    tenantId,
    action: 'management_task.status_updated',
    entityType: 'management_task',
    entityId: task.id,
    assignmentId: task.assignmentId,
    actorId: actorId ?? null,
    summary: `Status geändert: ${status}`,
    metadata: { status },
  });
  return task;
}

export function listEmployeeCorrectionTasks(
  tenantId: string,
  employeeId: string,
): ManagementTask[] {
  return listManagementTasks(tenantId, {
    employeeId,
    taskType: 'correction_requested',
  }).filter(
    (t) =>
      t.assignedTo === employeeId ||
      t.employeeId === employeeId ||
      t.status === 'waiting_for_employee',
  );
}

export function fetchManagementTasksForRole(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  filter?: ManagementTaskListFilter,
  actorEmployeeId?: string | null,
): ServiceResult<ManagementTask[]> {
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (actorRoleKey === 'client_portal') {
    return { ok: false, error: 'Interne QM-Aufgaben sind für Klient:innen nicht sichtbar.' };
  }

  if (actorRoleKey === 'caregiver' || actorRoleKey === 'employee_portal') {
    if (!actorEmployeeId?.trim()) {
      return { ok: false, error: 'Mitarbeitende sehen nur eigene Korrekturaufgaben.' };
    }
    return {
      ok: true,
      data: listEmployeeCorrectionTasks(tenantId, actorEmployeeId),
    };
  }

  const denied = enforcePermission<ManagementTask[]>(actorRoleKey, 'assist.assignments.view');
  if (denied) return denied;

  return { ok: true, data: listManagementTasks(tenantId, filter) };
}
