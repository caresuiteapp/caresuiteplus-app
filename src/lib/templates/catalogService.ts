import type { RoleKey, ServiceResult } from '@/types';
import type {
  CatalogEntry,
  CatalogType,
  CreateCatalogEntryInput,
  DropdownOption,
  UpdateCatalogEntryInput,
} from '@/types/templates';
import { enforcePermission } from '@/lib/permissions';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { TEMPLATE_EDIT_PERMISSION, TEMPLATE_VIEW_PERMISSION } from './templatePermissions';
import { getCatalogDefaults } from './catalogDefaults';
import { catalogSupabaseRepository } from './templateRepository.supabase';

function repo() {
  return catalogSupabaseRepository;
}

export async function listCatalogEntries(
  tenantId: string,
  catalogType?: CatalogType,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogEntry[]>> {
  const denied = enforcePermission<CatalogEntry[]>(actorRoleKey, TEMPLATE_VIEW_PERMISSION);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return repo().list(tenantId, catalogType);
}

export async function createCatalogEntry(
  tenantId: string,
  input: CreateCatalogEntryInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogEntry>> {
  const denied = enforcePermission<CatalogEntry>(actorRoleKey, TEMPLATE_EDIT_PERMISSION);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return repo().create(tenantId, input);
}

export async function updateCatalogEntry(
  tenantId: string,
  entryId: string,
  patch: UpdateCatalogEntryInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogEntry>> {
  const denied = enforcePermission<CatalogEntry>(actorRoleKey, TEMPLATE_EDIT_PERMISSION);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return repo().update(tenantId, entryId, patch);
}

export async function archiveCatalogEntry(
  tenantId: string,
  entryId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogEntry>> {
  const denied = enforcePermission<CatalogEntry>(actorRoleKey, TEMPLATE_EDIT_PERMISSION);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  return repo().archive(tenantId, entryId);
}

export async function getDropdownOptions(
  tenantId: string,
  catalogType: CatalogType,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<DropdownOption[]>> {
  const denied = enforcePermission<DropdownOption[]>(actorRoleKey, TEMPLATE_VIEW_PERMISSION);
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) {
    const defaults = getCatalogDefaults(catalogType);
    if (defaults.length > 0) return { ok: true, data: defaults };
    return tenantErr;
  }
  if (denied) {
    const defaults = getCatalogDefaults(catalogType);
    if (defaults.length > 0) return { ok: true, data: defaults };
    return denied;
  }
  return repo().getDropdownOptions(tenantId, catalogType);
}
