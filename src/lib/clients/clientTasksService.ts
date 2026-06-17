import type { ServiceResult } from '@/types';
import type { ClientTask } from '@/types/modules/client';
import { validateAssistTaskTitle } from '@/lib/assist/assistTaskGuardService';
import { TASK_CATALOG } from '@/data/demo/clients/taskCatalog';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';

export type ClientTaskInput = Omit<
  ClientTask,
  'id' | 'tenantId' | 'clientId' | 'createdAt' | 'updatedAt'
>;

export async function fetchClientTasks(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientTask[]>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().fetchTasks(tenantId, clientId);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    return { ok: true, data: full.tasks };
  }, { delayMs: 200 });
}

export async function addClientTaskFromCatalog(
  tenantId: string,
  clientId: string,
  catalogTaskId: string,
): Promise<ServiceResult<ClientTask>> {
  return runService(async () => {
    const catalogItem = TASK_CATALOG.find((t) => t.id === catalogTaskId);
    if (!catalogItem) return { ok: false, error: 'Aufgabe nicht im Katalog gefunden.' };

    const taskInput = {
      category: catalogItem.category,
      title: catalogItem.title,
      description: catalogItem.description,
      frequency: 'woechentlich' as const,
      durationMinutes: catalogItem.defaultDurationMinutes,
      isActive: true,
      catalogTaskId,
      assignedEmployeeIds: [] as string[],
    };

    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().createTask(tenantId, clientId, taskInput);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const now = new Date().toISOString();
    const task: ClientTask = {
      id: `task-${clientId}-${Date.now()}`,
      tenantId,
      clientId,
      moduleKey: null,
      leistungsbereich: null,
      subcategory: null,
      packageId: null,
      leistungsart: null,
      isMandatory: false,
      proofRequired: false,
      documentationRequired: true,
      billingRelevant: true,
      visibleToClient: true,
      ...taskInput,
      createdAt: now,
      updatedAt: now,
    };
    upsertDemoClientFullDetail({ ...full, tasks: [...full.tasks, task], updatedAt: now });
    return { ok: true, data: task };
  }, { delayMs: 250 });
}

export function getTaskCatalog() {
  return TASK_CATALOG;
}

function validateClientTaskInput(input: Pick<ClientTaskInput, 'title' | 'description' | 'moduleKey'>): ServiceResult<void> {
  if (input.moduleKey === 'assist' || input.moduleKey == null) {
    const validation = validateAssistTaskTitle(input.title, input.description ?? '');
    if (!validation.ok) return { ok: false, error: validation.error };
  }
  return { ok: true, data: undefined };
}

export async function createClientTask(
  tenantId: string,
  clientId: string,
  input: ClientTaskInput,
): Promise<ServiceResult<ClientTask>> {
  return runService(async () => {
    if (!input.title.trim()) {
      return { ok: false, error: 'Titel ist erforderlich.' };
    }

    const validation = validateClientTaskInput(input);
    if (!validation.ok) return validation;

    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().createTask(tenantId, clientId, input);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const now = new Date().toISOString();
    const task: ClientTask = {
      id: `task-${clientId}-${Date.now()}`,
      tenantId,
      clientId,
      moduleKey: input.moduleKey ?? 'assist',
      leistungsbereich: input.leistungsbereich ?? null,
      subcategory: input.subcategory ?? null,
      packageId: input.packageId ?? null,
      leistungsart: input.leistungsart ?? null,
      isMandatory: input.isMandatory ?? false,
      proofRequired: input.proofRequired ?? false,
      documentationRequired: input.documentationRequired ?? true,
      billingRelevant: input.billingRelevant ?? true,
      visibleToClient: input.visibleToClient ?? true,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    upsertDemoClientFullDetail({ ...full, tasks: [...full.tasks, task], updatedAt: now });
    return { ok: true, data: task };
  }, { delayMs: 250 });
}

export async function updateClientTask(
  tenantId: string,
  clientId: string,
  taskId: string,
  input: Partial<ClientTaskInput>,
): Promise<ServiceResult<ClientTask>> {
  return runService(async () => {
    if (input.title !== undefined && !input.title.trim()) {
      return { ok: false, error: 'Titel ist erforderlich.' };
    }

    if (input.title !== undefined || input.description !== undefined) {
      const validation = validateClientTaskInput({
        title: input.title ?? '',
        description: input.description,
        moduleKey: input.moduleKey,
      });
      if (!validation.ok) return validation;
    }

    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().updateTask(tenantId, clientId, taskId, input);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const idx = full.tasks.findIndex((task) => task.id === taskId);
    if (idx < 0) return { ok: false, error: 'Aufgabe nicht gefunden.' };

    const now = new Date().toISOString();
    const updated = { ...full.tasks[idx], ...input, updatedAt: now };
    const tasks = [...full.tasks];
    tasks[idx] = updated;
    upsertDemoClientFullDetail({ ...full, tasks, updatedAt: now });
    return { ok: true, data: updated };
  }, { delayMs: 250 });
}

export async function deleteClientTask(
  tenantId: string,
  clientId: string,
  taskId: string,
): Promise<ServiceResult<void>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().deleteTask(tenantId, clientId, taskId);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const tasks = full.tasks.filter((task) => task.id !== taskId);
    if (tasks.length === full.tasks.length) {
      return { ok: false, error: 'Aufgabe nicht gefunden.' };
    }

    upsertDemoClientFullDetail({
      ...full,
      tasks,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, data: undefined };
  }, { delayMs: 250 });
}
