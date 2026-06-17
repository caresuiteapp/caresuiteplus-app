import type { ServiceResult } from '@/types';
import type { ClientTask, TaskCategory } from '@/types/modules/client';
import type { AssistLeistungsbereichKey } from '@/types/modules/assist/assistTaskCatalog';
import {
  ASSIST_CATALOG_TASKS,
  ASSIST_TASK_PACKAGES,
  getAssistCatalogTaskById,
  getAssistTaskPackageById,
  getAssistTasksByPackage,
  getAssistPackagesByLeistungsbereich,
} from '@/data/assist/assistTaskCatalog';
import { validateAssistTaskTitle } from '@/lib/assist/assistTaskGuardService';
import {
  addClientTaskFromCatalog,
  createClientTask,
  type ClientTaskInput,
} from '@/lib/clients/clientTasksService';
import { mapLeistungsbereichToTaskCategory } from '@/lib/assist/assistTaskCategoryMapper';

export {
  ASSIST_CATALOG_TASKS,
  ASSIST_TASK_PACKAGES,
  getAssistCatalogTaskById,
  getAssistTaskPackageById,
  getAssistTasksByPackage,
  getAssistPackagesByLeistungsbereich,
};

export function getAssistTaskCatalog() {
  return ASSIST_CATALOG_TASKS;
}

export function getAssistTaskPackages() {
  return ASSIST_TASK_PACKAGES;
}

export function catalogTaskToClientTaskInput(
  catalogTaskId: string,
  overrides: Partial<ClientTaskInput> = {},
): ServiceResult<ClientTaskInput> {
  const template = getAssistCatalogTaskById(catalogTaskId);
  if (!template) {
    return { ok: false, error: 'Aufgabe nicht im Assist-Katalog gefunden.' };
  }

  const validation = validateAssistTaskTitle(template.title, template.description);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const input: ClientTaskInput = {
    category: mapLeistungsbereichToTaskCategory(template.leistungsbereich),
    title: template.title,
    description: template.description,
    frequency: 'woechentlich',
    durationMinutes: template.plannedDurationMinutes,
    isActive: true,
    catalogTaskId: template.id,
    assignedEmployeeIds: [],
    moduleKey: 'assist',
    leistungsbereich: template.leistungsbereich,
    subcategory: template.subcategory,
    packageId: template.packageId,
    leistungsart: template.leistungsart,
    isMandatory: template.isMandatory,
    proofRequired: template.proofRequired,
    documentationRequired: template.documentationRequired,
    billingRelevant: template.billingRelevant,
    visibleToClient: template.visibleToClient,
    ...overrides,
  };

  return { ok: true, data: input };
}

export async function addAssistCatalogTaskToClient(
  tenantId: string,
  clientId: string,
  catalogTaskId: string,
): Promise<ServiceResult<ClientTask>> {
  const inputResult = catalogTaskToClientTaskInput(catalogTaskId);
  if (!inputResult.ok) return inputResult;

  return createClientTask(tenantId, clientId, inputResult.data);
}

export async function addAssistPackageToClient(
  tenantId: string,
  clientId: string,
  packageId: string,
): Promise<ServiceResult<ClientTask[]>> {
  const pkg = getAssistTaskPackageById(packageId);
  if (!pkg) {
    return { ok: false, error: 'Aufgabenpaket nicht im Assist-Katalog gefunden.' };
  }

  const tasks = getAssistTasksByPackage(packageId);
  const created: ClientTask[] = [];

  for (const template of tasks) {
    const validation = validateAssistTaskTitle(template.title, template.description);
    if (!validation.ok) {
      return { ok: false, error: validation.error };
    }

    const result = await addAssistCatalogTaskToClient(tenantId, clientId, template.id);
    if (!result.ok) return result;
    created.push(result.data);
  }

  return { ok: true, data: created };
}

export function groupPackagesByLeistungsbereich(): Record<
  AssistLeistungsbereichKey,
  typeof ASSIST_TASK_PACKAGES
> {
  const grouped = {} as Record<AssistLeistungsbereichKey, typeof ASSIST_TASK_PACKAGES>;
  for (const pkg of ASSIST_TASK_PACKAGES) {
    if (!grouped[pkg.leistungsbereich]) {
      grouped[pkg.leistungsbereich] = [];
    }
    grouped[pkg.leistungsbereich].push(pkg);
  }
  return grouped;
}

/** @deprecated Legacy-Katalog — nutzt weiterhin TASK_CATALOG, bevorzugt Assist-Katalog */
export async function addLegacyCatalogTaskToClient(
  tenantId: string,
  clientId: string,
  catalogTaskId: string,
): Promise<ServiceResult<ClientTask>> {
  return addClientTaskFromCatalog(tenantId, clientId, catalogTaskId);
}
