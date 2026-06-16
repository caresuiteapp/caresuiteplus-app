import type { RoleKey, ServiceResult } from '@/types';
import type { ManagementTaskType } from '@/types/modules/liveMonitor';
import type {
  AttachmentSensitivityLevel,
  AutoTaskTriggerType,
  InternalTask,
  InternalTaskPriority,
  InternalTaskStatus,
  InternalTaskType,
  InternalTaskViewKey,
  LinkedEntityType,
  TaskAttachment,
  TaskComment,
  TaskCommentVisibility,
} from '@/types/modules/internalTasks';
import { INTERNAL_TASK_TYPE_LABELS } from '@/types/modules/internalTasks';
import { enforcePermission } from '@/lib/permissions';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import {
  INTERNAL_TASK_STORE,
  filterTasksByTenant,
  nextInternalTaskId,
  nextTaskAttachmentId,
  nextTaskCommentId,
} from './internalTaskStore';

const MANAGEMENT_TASK_TYPE_MAP: Record<ManagementTaskType, InternalTaskType> = {
  cancel_review: 'assignment_change',
  client_cancel_request: 'assignment_change',
  reschedule_review: 'scheduling',
  client_reschedule_request: 'scheduling',
  missing_documentation: 'missing_doc_signature',
  missing_signature: 'missing_doc_signature',
  review_service_record: 'correction',
  review_exception: 'correction',
  service_proof_review: 'correction',
  problem_review: 'complaint',
  problem_report: 'complaint',
  emergency_review: 'emergency_followup',
  emergency_follow_up: 'emergency_followup',
  correction_review: 'correction',
  correction_requested: 'correction',
  billing_release: 'billing_blocker',
  billing_blocker: 'billing_blocker',
  budget_warning: 'billing_blocker',
  complaint: 'complaint',
  missing_contract: 'contract_doc_missing',
  missing_consent: 'contract_doc_missing',
  employee_late: 'scheduling',
  no_show_follow_up: 'complaint',
  audit_review: 'correction',
  master_data_review: 'general',
  absence_replacement: 'employee_request',
  absence_conflict: 'employee_request',
};

const AUTO_TRIGGER_TYPE_MAP: Record<AutoTaskTriggerType, InternalTaskType> = {
  cancel_request: 'assignment_change',
  reschedule_request: 'scheduling',
  problem_report: 'complaint',
  emergency_report: 'emergency_followup',
  missing_documentation: 'missing_doc_signature',
  missing_signature: 'missing_doc_signature',
  service_record_review: 'correction',
  invoice_blocked: 'billing_blocker',
  budget_exceeded: 'billing_blocker',
  connect_error: 'connect_api_error',
  privacy_request: 'privacy_request',
  system_error: 'system_error',
};

const AUTO_TRIGGER_PRIORITY: Partial<Record<AutoTaskTriggerType, InternalTaskPriority>> = {
  emergency_report: 'critical',
  connect_error: 'high',
  invoice_blocked: 'high',
  privacy_request: 'high',
  system_error: 'critical',
};

const AUTO_TRIGGER_TITLES: Record<AutoTaskTriggerType, string> = {
  cancel_request: 'Absage prüfen',
  reschedule_request: 'Verschiebung prüfen',
  problem_report: 'Problem melden — Prüfung',
  emergency_report: 'Notfall — sofortige Prüfung',
  missing_documentation: 'Dokumentation fehlt',
  missing_signature: 'Unterschrift fehlt',
  service_record_review: 'Leistungsnachweis prüfen',
  invoice_blocked: 'Rechnung blockiert',
  budget_exceeded: 'Budget überschritten',
  connect_error: 'Connect / API-Fehler',
  privacy_request: 'Datenschutzanfrage',
  system_error: 'Systemfehler',
};

const VIEW_TYPE_FILTERS: Partial<Record<InternalTaskViewKey, InternalTaskType[]>> = {
  billing: ['billing_blocker'],
  qm: ['correction', 'complaint'],
  planning: ['scheduling', 'assignment_change'],
  employees: ['employee_request', 'sick_leave', 'vacation_prepared'],
  client_requests: ['client_request', 'callback'],
  system_errors: ['connect_api_error', 'system_error'],
};

const VIEW_STATUS_FILTERS: Partial<Record<InternalTaskViewKey, InternalTaskStatus[]>> = {
  archive: ['archived'],
  critical: undefined,
};

export function mapManagementTaskTypeToInternal(type: ManagementTaskType): InternalTaskType {
  return MANAGEMENT_TASK_TYPE_MAP[type] ?? 'general';
}

export function mapAutoTriggerToInternalType(trigger: AutoTaskTriggerType): InternalTaskType {
  return AUTO_TRIGGER_TYPE_MAP[trigger] ?? 'general';
}

function assertTenant(tenantId: string): ServiceResult<never> | null {
  const block = guardServiceTenant(tenantId);
  if (block) return block;
  return null;
}

function canViewTask(
  task: InternalTask,
  actorRoleKey?: RoleKey | null,
  actorUserId?: string | null,
  actorEmployeeId?: string | null,
): boolean {
  if (!actorRoleKey) return false;
  if (actorRoleKey === 'client_portal' || actorRoleKey === 'family_portal') return false;

  const isAdmin = ['business_admin', 'business_manager', 'dispatch', 'billing'].includes(actorRoleKey);
  if (isAdmin) return true;

  if (actorRoleKey === 'employee_portal' || actorRoleKey === 'caregiver' || actorRoleKey === 'nurse') {
    if (!task.employeeVisible) return false;
    if (task.assignedToEmployeeId && actorEmployeeId) {
      return task.assignedToEmployeeId === actorEmployeeId;
    }
    if (task.assignedToUserId && actorUserId) {
      return task.assignedToUserId === actorUserId;
    }
    return false;
  }

  return isAdmin;
}

export function createInternalTask(input: {
  tenantId: string;
  taskType: InternalTaskType;
  title?: string;
  description?: string;
  priority?: InternalTaskPriority;
  status?: InternalTaskStatus;
  linkedEntityType?: LinkedEntityType;
  linkedEntityId?: string | null;
  source?: InternalTask['source'];
  assignedToUserId?: string | null;
  assignedToEmployeeId?: string | null;
  createdByUserId?: string | null;
  dueAt?: string | null;
  employeeVisible?: boolean;
  managementTaskId?: string | null;
}): InternalTask {
  const existing = INTERNAL_TASK_STORE.tasks.find(
    (t) =>
      t.tenantId === input.tenantId &&
      t.taskType === input.taskType &&
      t.linkedEntityId === (input.linkedEntityId ?? null) &&
      t.linkedEntityType === (input.linkedEntityType ?? 'none') &&
      !['resolved', 'archived', 'rejected'].includes(t.status),
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const task: InternalTask = {
    id: nextInternalTaskId(),
    tenantId: input.tenantId,
    taskType: input.taskType,
    status: input.status ?? 'open',
    priority: input.priority ?? 'normal',
    title: input.title ?? INTERNAL_TASK_TYPE_LABELS[input.taskType],
    description: input.description ?? INTERNAL_TASK_TYPE_LABELS[input.taskType],
    assignedToUserId: input.assignedToUserId ?? null,
    assignedToEmployeeId: input.assignedToEmployeeId ?? null,
    createdByUserId: input.createdByUserId ?? null,
    dueAt: input.dueAt ?? null,
    resolvedAt: null,
    archivedAt: null,
    escalatedAt: null,
    linkedEntityType: input.linkedEntityType ?? 'none',
    linkedEntityId: input.linkedEntityId ?? null,
    source: input.source ?? 'manual',
    isInternalOnly: true,
    employeeVisible: input.employeeVisible ?? false,
    managementTaskId: input.managementTaskId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  INTERNAL_TASK_STORE.tasks.push(task);
  return task;
}

export function createInternalTaskFromManagementTask(input: {
  tenantId: string;
  managementTaskId: string;
  assignmentId: string;
  taskType: ManagementTaskType;
  title: string;
  description: string;
  priority?: InternalTaskPriority;
}): InternalTask {
  const internalType = mapManagementTaskTypeToInternal(input.taskType);
  const priority: InternalTaskPriority =
    input.priority === 'critical'
      ? 'critical'
      : input.priority === 'high'
        ? 'high'
        : 'normal';

  return createInternalTask({
    tenantId: input.tenantId,
    taskType: internalType,
    title: input.title,
    description: input.description,
    priority,
    linkedEntityType: 'assignment',
    linkedEntityId: input.assignmentId,
    source: 'management_task_bridge',
    managementTaskId: input.managementTaskId,
    employeeVisible: internalType === 'employee_request',
  });
}

export function createInternalTaskFromAutoTrigger(input: {
  tenantId: string;
  trigger: AutoTaskTriggerType;
  description?: string;
  linkedEntityType?: LinkedEntityType;
  linkedEntityId?: string | null;
}): InternalTask {
  const taskType = mapAutoTriggerToInternalType(input.trigger);
  return createInternalTask({
    tenantId: input.tenantId,
    taskType,
    title: AUTO_TRIGGER_TITLES[input.trigger],
    description: input.description ?? AUTO_TRIGGER_TITLES[input.trigger],
    priority: AUTO_TRIGGER_PRIORITY[input.trigger] ?? 'normal',
    linkedEntityType: input.linkedEntityType ?? 'none',
    linkedEntityId: input.linkedEntityId ?? null,
    source: 'auto_trigger',
  });
}

export function listInternalTasks(
  tenantId: string,
  filter?: {
    view?: InternalTaskViewKey;
    status?: InternalTaskStatus;
    assignedToUserId?: string;
    assignedToEmployeeId?: string;
    actorRoleKey?: RoleKey | null;
    actorUserId?: string | null;
    actorEmployeeId?: string | null;
  },
): InternalTask[] {
  if (!tenantId?.trim()) return [];
  let items = filterTasksByTenant(INTERNAL_TASK_STORE.tasks, tenantId);

  if (filter?.view) {
    if (filter.view === 'my_tasks') {
      items = items.filter(
        (t) =>
          t.assignedToUserId === filter.actorUserId ||
          t.assignedToEmployeeId === filter.actorEmployeeId,
      );
    } else if (filter.view === 'critical') {
      items = items.filter((t) => t.priority === 'critical' && t.status !== 'archived');
    } else if (filter.view === 'overdue') {
      const now = Date.now();
      items = items.filter(
        (t) =>
          t.dueAt &&
          new Date(t.dueAt).getTime() < now &&
          !['resolved', 'archived', 'rejected'].includes(t.status),
      );
    } else if (filter.view === 'archive') {
      items = items.filter((t) => t.status === 'archived');
    } else {
      const types = VIEW_TYPE_FILTERS[filter.view];
      if (types) items = items.filter((t) => types.includes(t.taskType));
      const statuses = VIEW_STATUS_FILTERS[filter.view];
      if (statuses) items = items.filter((t) => statuses.includes(t.status));
    }
  }

  if (filter?.status) {
    items = items.filter((t) => t.status === filter.status);
  }

  if (filter?.actorRoleKey) {
    items = items.filter((t) =>
      canViewTask(t, filter.actorRoleKey, filter.actorUserId, filter.actorEmployeeId),
    );
  }

  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function fetchInternalTasks(
  tenantId: string,
  filter: Parameters<typeof listInternalTasks>[1],
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<InternalTask[]>> {
  const denied = enforcePermission<InternalTask[]>(actorRoleKey, 'office.access');
  if (denied) return denied;
  const tenantBlock = assertTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  const liveBlock = guardLiveDemoFeature<InternalTask[]>(tenantId, 'Interne Aufgaben');
  if (liveBlock) return liveBlock;

  return {
    ok: true,
    data: listInternalTasks(tenantId, { ...filter, actorRoleKey }),
  };
}

export function updateInternalTaskStatus(
  tenantId: string,
  taskId: string,
  status: InternalTaskStatus,
): InternalTask | null {
  const task = INTERNAL_TASK_STORE.tasks.find((t) => t.id === taskId && t.tenantId === tenantId);
  if (!task) return null;
  task.status = status;
  task.updatedAt = new Date().toISOString();
  const now = new Date().toISOString();
  if (status === 'resolved') task.resolvedAt = now;
  if (status === 'archived') task.archivedAt = now;
  if (status === 'escalated') task.escalatedAt = now;
  return task;
}

export function assignInternalTask(
  tenantId: string,
  taskId: string,
  assignedToUserId: string | null,
  assignedToEmployeeId?: string | null,
): InternalTask | null {
  const task = INTERNAL_TASK_STORE.tasks.find((t) => t.id === taskId && t.tenantId === tenantId);
  if (!task) return null;
  task.assignedToUserId = assignedToUserId;
  if (assignedToEmployeeId !== undefined) task.assignedToEmployeeId = assignedToEmployeeId;
  task.status = 'assigned';
  task.updatedAt = new Date().toISOString();
  return task;
}

export function addTaskComment(input: {
  tenantId: string;
  taskId: string;
  body: string;
  authorUserId?: string | null;
  authorRoleKey?: string | null;
  visibility?: TaskCommentVisibility;
}): TaskComment | null {
  const task = INTERNAL_TASK_STORE.tasks.find(
    (t) => t.id === input.taskId && t.tenantId === input.tenantId,
  );
  if (!task) return null;

  const visibility = input.visibility ?? 'internal';
  const comment: TaskComment = {
    id: nextTaskCommentId(),
    tenantId: input.tenantId,
    taskId: input.taskId,
    authorUserId: input.authorUserId ?? null,
    authorRoleKey: input.authorRoleKey ?? null,
    body: input.body,
    visibility,
    isInternalOnly: visibility === 'internal' || visibility === 'management',
    employeeVisible: visibility === 'employee',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  INTERNAL_TASK_STORE.comments.push(comment);
  return comment;
}

export function addTaskAttachment(input: {
  tenantId: string;
  taskId: string;
  fileName: string;
  mimeType: string;
  sensitivityLevel: AttachmentSensitivityLevel;
  uploadedByUserId?: string | null;
}): TaskAttachment | null {
  const task = INTERNAL_TASK_STORE.tasks.find(
    (t) => t.id === input.taskId && t.tenantId === input.tenantId,
  );
  if (!task) return null;

  const attachment: TaskAttachment = {
    id: nextTaskAttachmentId(),
    tenantId: input.tenantId,
    taskId: input.taskId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sensitivityLevel: input.sensitivityLevel,
    uploadedByUserId: input.uploadedByUserId ?? null,
    createdAt: new Date().toISOString(),
  };
  INTERNAL_TASK_STORE.attachments.push(attachment);
  return attachment;
}

export function listTaskComments(tenantId: string, taskId: string, actorRoleKey?: RoleKey | null): TaskComment[] {
  const comments = INTERNAL_TASK_STORE.comments.filter(
    (c) => c.tenantId === tenantId && c.taskId === taskId,
  );
  if (actorRoleKey === 'client_portal' || actorRoleKey === 'family_portal') return [];
  if (actorRoleKey === 'employee_portal' || actorRoleKey === 'caregiver') {
    return comments.filter((c) => c.employeeVisible);
  }
  return comments;
}

export function createTaskFromMessage(input: {
  tenantId: string;
  messageId: string;
  title: string;
  description: string;
  source: 'client_message' | 'employee_message';
}): InternalTask {
  return createInternalTask({
    tenantId: input.tenantId,
    taskType: input.source === 'client_message' ? 'client_request' : 'employee_request',
    title: input.title,
    description: input.description,
    linkedEntityType: 'message',
    linkedEntityId: input.messageId,
    source: input.source,
    employeeVisible: input.source === 'employee_message',
  });
}

export { canViewTask, AUTO_TRIGGER_TITLES };
