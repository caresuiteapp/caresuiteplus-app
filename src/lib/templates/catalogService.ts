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
import { SYSTEM_CATALOG_ENTRIES } from '@/data/demo/templates/seeds';

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
  const result = await repo().list(tenantId, catalogType);
  if (!result.ok) return result;

  // Systemkataloge gehören zur Anwendung und müssen auch dann verfügbar sein,
  // wenn die optionale catalog_entries-Tabelle noch keine Seed-Zeilen enthält.
  // Mandanteneinträge überschreiben gleichnamige Systemwerte gezielt.
  const systemEntries = SYSTEM_CATALOG_ENTRIES.filter(
    (entry) => entry.isActive && (!catalogType || entry.catalogType === catalogType),
  );
  const merged = new Map<string, CatalogEntry>();
  for (const entry of systemEntries) {
    merged.set(`${entry.catalogType}:${entry.valueKey}`, entry);
  }
  for (const entry of result.data) {
    merged.set(`${entry.catalogType}:${entry.valueKey}`, entry);
  }

  return {
    ok: true,
    data: [...merged.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'de'),
    ),
  };
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
