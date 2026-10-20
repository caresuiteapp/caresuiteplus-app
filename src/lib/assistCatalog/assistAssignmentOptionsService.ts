import type { RoleKey, ServiceResult } from '@/types';
import type { AssistAssignmentOptions, AssistAssignmentTaskDraft, CatalogItem } from '@/types/assistCatalog';
import { enforcePermission } from '@/lib/permissions';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { loadCatalogItems } from './assistCatalogService';

const USE_TEMPLATES = 'assist.assignment.use_templates';

async function loadActiveItems(
  tenantId: string,
  catalogKey: string,
  actorRoleKey?: RoleKey | null,
): Promise<{ items: CatalogItem[]; error?: string }> {
  const res = await loadCatalogItems(tenantId, catalogKey, {}, actorRoleKey);
  if (!res.ok) return { items: [], error: res.error };
  return { items: res.data.filter((i) => i.isActive) };
}

export async function loadAssistAssignmentOptions(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssistAssignmentOptions>> {
  const denied = enforcePermission<AssistAssignmentOptions>(actorRoleKey, USE_TEMPLATES);
  if (denied) {
    const viewDenied = enforcePermission<AssistAssignmentOptions>(actorRoleKey, 'assist.assignments.manage');
    if (viewDenied) return viewDenied;
  }
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;

  const results = await Promise.all([
    loadActiveItems(tenantId, 'assist.assignment.subjects', actorRoleKey),
    loadActiveItems(tenantId, 'assist.assignment.types', actorRoleKey),
    loadActiveItems(tenantId, 'assist.service.categories', actorRoleKey),
    loadActiveItems(tenantId, 'assist.task.packages', actorRoleKey),
    loadActiveItems(tenantId, 'assist.task.items', actorRoleKey),
    loadActiveItems(tenantId, 'assist.documentation.quick_blocks', actorRoleKey),
    loadActiveItems(tenantId, 'assist.billing.budget_sources', actorRoleKey),
    loadActiveItems(tenantId, 'assist.risk_flags', actorRoleKey),
    loadActiveItems(tenantId, 'assist.task.not_completed_reasons', actorRoleKey),
    loadActiveItems(tenantId, 'assist.assignment.abort_reasons', actorRoleKey),
    loadActiveItems(tenantId, 'assist.assignment.cancellation_reasons', actorRoleKey),
  ]);

  const firstError = results.find((r) => r.error)?.error;
  if (firstError) {
    return { ok: false, error: firstError };
  }

  const [
    subjects,
    assignmentTypes,
    serviceCategories,
    taskPackages,
    taskItems,
    documentationBlocks,
    budgetSources,
    riskFlags,
    notCompletedReasons,
    abortReasons,
    cancellationReasons,
  ] = results.map((r) => r.items);

  return {
    ok: true,
    data: {
      subjects,
      assignmentTypes,
      serviceCategories,
      taskPackages: taskPackages.filter((p) => !p.parentItemId),
      taskItems: taskItems.filter((i) => !i.payloadJson.notExecutable),
      documentationBlocks,
      budgetSources,
      riskFlags,
      notCompletedReasons,
      abortReasons,
      cancellationReasons,
    },
  };
}

export async function loadAssistDocumentationBlocks(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogItem[]>> {
  const denied = enforcePermission<CatalogItem[]>(actorRoleKey, 'assist.documentation.use_quick_blocks');
  if (denied) {
    const alt = enforcePermission<CatalogItem[]>(actorRoleKey, 'assist.assignments.manage');
    if (alt) return alt;
  }
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return loadCatalogItems(tenantId, 'assist.documentation.quick_blocks', {}, actorRoleKey);
}

export async function loadAssistIntakeCatalog(
  tenantId: string,
  catalogKey: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogItem[]>> {
  const denied = enforcePermission<CatalogItem[]>(actorRoleKey, 'assist.intake.use_templates');
  if (denied) {
    const alt = enforcePermission<CatalogItem[]>(actorRoleKey, 'office.clients.create');
    if (alt) return alt;
  }
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return loadCatalogItems(tenantId, catalogKey, {}, actorRoleKey);
}

export function catalogItemsToTaskDrafts(items: CatalogItem[]): AssistAssignmentTaskDraft[] {
  return items.map((item, index) => ({
    catalogItemId: item.id,
    itemKey: item.itemKey,
    title: item.label,
    isRequired: Boolean(item.payloadJson.isMandatory),
    isOptional: Boolean(item.payloadJson.isOptional),
    sortOrder: item.sortOrder ?? index,
    defaultDurationMinutes: item.defaultDurationMinutes,
    requiresNoteIfNotDone: Boolean(item.payloadJson.requiresNote),
    notExecutable: Boolean(item.payloadJson.notExecutable),
  }));
}
