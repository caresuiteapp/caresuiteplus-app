import type { ServiceResult } from '@/types';
import type { ClientTask } from '@/types/modules/client';
import { TASK_CATALOG } from '@/data/demo/clients/taskCatalog';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';

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
