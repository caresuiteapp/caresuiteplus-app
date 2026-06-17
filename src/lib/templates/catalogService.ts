import type { RoleKey, ServiceResult } from '@/types';
import type {
  CatalogEntry,
  CatalogType,
  CreateCatalogEntryInput,
  DropdownOption,
  UpdateCatalogEntryInput,
} from '@/types/templates';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { TEMPLATE_EDIT_PERMISSION, TEMPLATE_VIEW_PERMISSION } from './templatePermissions';
import { catalogDemoRepository } from './templateRepository.demo';
import { catalogSupabaseRepository } from './templateRepository.supabase';

function repo() {
  return getServiceMode() === 'supabase' ? catalogSupabaseRepository : catalogDemoRepository;
}

async function demoDelay(ms = 100): Promise<void> {
  if (getServiceMode() === 'demo') {
    await new Promise((r) => setTimeout(r, ms));
  }
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
  await demoDelay();
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
  await demoDelay(150);
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
  await demoDelay(120);
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
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return tenantErr;
  await demoDelay(80);
  const result = await repo().getDropdownOptions(tenantId, catalogType);
  if (result.ok) return result;
  if (getServiceMode() === 'supabase') {
    const fallback = await catalogDemoRepository.getDropdownOptions(tenantId, catalogType);
    if (fallback.ok && fallback.data.length > 0) return fallback;
  }
  return result;
}
