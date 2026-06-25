import type { RoleKey, ServiceResult } from '@/types';
import type {
  AssistCatalogHubStats,
  CatalogAuditEvent,
  CatalogDefinition,
  CatalogGroup,
  CatalogItem,
  CatalogListFilters,
  CreateCatalogItemInput,
  TemplateBinding,
  UpdateCatalogItemInput,
} from '@/types/assistCatalog';
import { enforcePermission } from '@/lib/permissions';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { assistCatalogSupabaseRepository as repo } from './assistCatalogRepository.supabase';

const VIEW = 'office.catalogs.view';
const EDIT = 'office.catalogs.edit';

export async function loadCatalogGroups(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogGroup[]>> {
  const denied = enforcePermission<CatalogGroup[]>(actorRoleKey, VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return repo.listGroups(tenantId);
}

export async function loadCatalogs(
  tenantId: string,
  filters: CatalogListFilters = {},
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogDefinition[]>> {
  const denied = enforcePermission<CatalogDefinition[]>(actorRoleKey, VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return repo.listDefinitions(tenantId, filters);
}

export async function loadCatalogItems(
  tenantId: string,
  catalogKey: string,
  filters: CatalogListFilters = {},
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogItem[]>> {
  let denied = enforcePermission<CatalogItem[]>(actorRoleKey, VIEW);
  if (denied && catalogKey.startsWith('assist.')) {
    denied = enforcePermission<CatalogItem[]>(actorRoleKey, 'assist.assignment.use_templates');
    if (denied) {
      denied = enforcePermission<CatalogItem[]>(actorRoleKey, 'assist.assignments.manage');
    }
  }
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return repo.listItems(tenantId, catalogKey, filters);
}

export async function createCatalogItem(
  tenantId: string,
  input: CreateCatalogItemInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogItem>> {
  const denied = enforcePermission<CatalogItem>(actorRoleKey, EDIT);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return repo.createItem(tenantId, input);
}

export async function updateCatalogItem(
  tenantId: string,
  itemId: string,
  patch: UpdateCatalogItemInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogItem>> {
  const denied = enforcePermission<CatalogItem>(actorRoleKey, EDIT);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return repo.updateItem(tenantId, itemId, patch);
}

export async function deactivateCatalogItem(
  tenantId: string,
  itemId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogItem>> {
  const denied = enforcePermission<CatalogItem>(actorRoleKey, EDIT);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return repo.deactivateItem(tenantId, itemId);
}

export async function restoreCatalogItem(
  tenantId: string,
  itemId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogItem>> {
  return updateCatalogItem(tenantId, itemId, { isActive: true }, actorRoleKey);
}

export async function copySystemCatalogToTenant(
  tenantId: string,
  catalogKey: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogDefinition>> {
  const denied = enforcePermission<CatalogDefinition>(actorRoleKey, EDIT);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return repo.copySystemCatalogToTenant(tenantId, catalogKey);
}

export async function loadTemplateBindings(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<TemplateBinding[]>> {
  const denied = enforcePermission<TemplateBinding[]>(actorRoleKey, VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return repo.listBindings(tenantId);
}

export async function loadCatalogAuditEvents(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogAuditEvent[]>> {
  const denied = enforcePermission<CatalogAuditEvent[]>(actorRoleKey, VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return repo.listAudit(tenantId);
}

export async function loadAssistCatalogHubStats(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<AssistCatalogHubStats>> {
  const denied = enforcePermission<AssistCatalogHubStats>(actorRoleKey, VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;

  const [packages, tasks, blocks, intake, inactive, audit] = await Promise.all([
    repo.listItems(tenantId, 'assist.task.packages', { includeInactive: false }),
    repo.listItems(tenantId, 'assist.task.items', { includeInactive: false }),
    repo.listItems(tenantId, 'assist.documentation.quick_blocks'),
    repo.listItems(tenantId, 'assist.intake.templates'),
    repo.listItems(tenantId, 'assist.assignment.subjects', { includeInactive: true }),
    repo.listAudit(tenantId),
  ]);

  const packageRoots = (packages.ok ? packages.data : []).filter((i) => !i.parentItemId);
  const taskRoots = (tasks.ok ? tasks.data : []).filter((i) => !i.parentItemId);
  const inactiveCount = (inactive.ok ? inactive.data : []).filter((i) => !i.isActive).length;

  return {
    ok: true,
    data: {
      activeAssignmentTemplates: (inactive.ok ? inactive.data.filter((i) => i.isActive).length : 0),
      activeTaskPackages: packageRoots.filter((i) => i.isActive).length,
      activeTaskItems: taskRoots.filter((i) => i.isActive).length,
      documentationBlocks: blocks.ok ? blocks.data.length : 0,
      documentTemplates: 0,
      intakeTemplates: intake.ok ? intake.data.length : 0,
      inactiveEntries: inactiveCount,
      lastChangedAt: audit.ok && audit.data[0] ? audit.data[0].createdAt : null,
    },
  };
}

export async function exportCatalogAsJson(
  tenantId: string,
  catalogKey: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ catalogKey: string; items: CatalogItem[] }>> {
  const items = await loadCatalogItems(tenantId, catalogKey, { includeInactive: true }, actorRoleKey);
  if (!items.ok) return items;
  return { ok: true, data: { catalogKey, items: items.data } };
}

export async function importCatalogFromJson(
  tenantId: string,
  catalogKey: string,
  items: CreateCatalogItemInput[],
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ imported: number }>> {
  const denied = enforcePermission<{ imported: number }>(actorRoleKey, EDIT);
  if (denied) return denied;
  const defs = await loadCatalogs(tenantId, { catalogKey }, actorRoleKey);
  if (!defs.ok) return defs;
  const def = defs.data[0];
  if (!def) return { ok: false, error: 'Katalog nicht gefunden.' };

  let imported = 0;
  for (const item of items) {
    const res = await createCatalogItem(tenantId, { ...item, catalogId: def.id }, actorRoleKey);
    if (res.ok) imported += 1;
  }
  return { ok: true, data: { imported } };
}
