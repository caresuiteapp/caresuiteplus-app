import type {
  ManagementTask,
  ManagementTaskStatus,
  ManagementTaskType,
  NotificationPriority,
} from '@/types/modules/liveMonitor';
import { createInternalTaskFromManagementTask } from '@/lib/tasks/internalTaskService';
import {
  LIVE_MONITOR_STORE,
  filterByTenant,
  nextTaskId,
} from './liveMonitorStore';

const TASK_TITLES: Record<ManagementTaskType, string> = {
  cancel_review: 'Absage prüfen',
  reschedule_review: 'Verschiebung prüfen',
  missing_documentation: 'Dokumentation fehlt',
  missing_signature: 'Unterschrift fehlt',
  problem_review: 'Problem melden — Prüfung',
  emergency_review: 'Notfall — sofortige Prüfung',
  correction_review: 'Korrektur prüfen',
  billing_release: 'Abrechnungsfreigabe',
  service_proof_review: 'Leistungsnachweis prüfen',
};

export function createManagementTask(input: {
  tenantId: string;
  assignmentId?: string;
  taskType: ManagementTaskType;
  title?: string;
  description?: string;
  priority?: NotificationPriority;
  clientId?: string | null;
  employeeId?: string | null;
  assignedTo?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  dueAt?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, string>;
}): ManagementTask {
  const assignmentId = input.assignmentId ?? '';
  const existing = LIVE_MONITOR_STORE.managementTasks.find(
    (t) =>
      t.tenantId === input.tenantId &&
      t.assignmentId === assignmentId &&
      t.taskType === input.taskType &&
      t.status !== 'resolved' &&
      t.status !== 'archived',
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const task: ManagementTask = {
    id: nextTaskId(),
    tenantId: input.tenantId,
    assignmentId,
    taskType: input.taskType,
    status: 'open',
    title: input.title ?? TASK_TITLES[input.taskType] ?? input.taskType,
    description: input.description ?? TASK_TITLES[input.taskType] ?? input.taskType,
    priority: input.priority ?? 'normal',
    clientId: input.clientId ?? null,
    employeeId: input.employeeId ?? null,
    relatedEntityType: input.relatedEntityType ?? null,
    relatedEntityId: input.relatedEntityId ?? null,
    dueAt: input.dueAt ?? null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    metadata: input.metadata,
  };
  LIVE_MONITOR_STORE.managementTasks.push(task);

  createInternalTaskFromManagementTask({
    tenantId: input.tenantId,
    managementTaskId: task.id,
    assignmentId: input.assignmentId,
    taskType: input.taskType,
    title: task.title,
    description: task.description,
    priority: task.priority,
  });

  return task;
}

export function listManagementTasks(
  tenantId: string,
  filter?: { assignmentId?: string; status?: ManagementTaskStatus; taskType?: ManagementTaskType },
): ManagementTask[] {
  if (!tenantId?.trim()) return [];
  return filterByTenant(LIVE_MONITOR_STORE.managementTasks, tenantId).filter((t) => {
    if (filter?.assignmentId && t.assignmentId !== filter.assignmentId) return false;
    if (filter?.status && t.status !== filter.status) return false;
    if (filter?.taskType && t.taskType !== filter.taskType) return false;
    return true;
  });
}

export function updateManagementTaskStatus(
  tenantId: string,
  taskId: string,
  status: ManagementTaskStatus,
): ManagementTask | null {
  const task = LIVE_MONITOR_STORE.managementTasks.find(
    (t) => t.id === taskId && t.tenantId === tenantId,
  );
  if (!task) return null;
  task.status = status;
  if (status === 'resolved' || status === 'archived') {
    task.resolvedAt = new Date().toISOString();
  }
  return task;
}
