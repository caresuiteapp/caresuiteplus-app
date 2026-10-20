import type { RoleKey, ServiceResult } from '@/types';
import type { AssistAssignmentTaskDraft, CatalogItem } from '@/types/assistCatalog';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { loadCatalogItems } from './assistCatalogService';
import { catalogItemsToTaskDrafts } from './assistAssignmentOptionsService';

export async function loadAssistTaskPackages(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogItem[]>> {
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  const res = await loadCatalogItems(tenantId, 'assist.task.packages', {}, actorRoleKey);
  if (!res.ok) return res;
  return { ok: true, data: res.data.filter((i) => !i.parentItemId && i.isActive) };
}

export async function loadTaskPackageItems(
  tenantId: string,
  packageItemId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssistAssignmentTaskDraft[]>> {
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  const res = await loadCatalogItems(tenantId, 'assist.task.packages', { includeInactive: false }, actorRoleKey);
  if (!res.ok) return res;
  const children = res.data.filter((i) => i.parentItemId === packageItemId);
  return { ok: true, data: catalogItemsToTaskDrafts(children) };
}

export function mergeTaskDrafts(
  packageTasks: AssistAssignmentTaskDraft[],
  additionalTasks: AssistAssignmentTaskDraft[],
  removedKeys: Set<string>,
): AssistAssignmentTaskDraft[] {
  const merged = packageTasks.filter((t) => !removedKeys.has(t.itemKey));
  for (const task of additionalTasks) {
    if (!merged.some((m) => m.itemKey === task.itemKey)) merged.push(task);
  }
  return merged
    .map((t, i) => ({ ...t, sortOrder: i }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function reorderTaskDrafts(tasks: AssistAssignmentTaskDraft[], from: number, to: number): AssistAssignmentTaskDraft[] {
  const next = [...tasks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((t, i) => ({ ...t, sortOrder: i }));
}

export async function loadAssistTaskItemsByCategory(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<Record<string, CatalogItem[]>>> {
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  const res = await loadCatalogItems(tenantId, 'assist.task.items', {}, actorRoleKey);
  if (!res.ok) return res;
  const grouped: Record<string, CatalogItem[]> = {};
  for (const item of res.data.filter((i) => !i.parentItemId)) {
    const cat = String(item.payloadJson.category ?? 'sonstiges');
    grouped[cat] = grouped[cat] ?? [];
    grouped[cat].push(item);
  }
  return { ok: true, data: grouped };
}
