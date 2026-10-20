import type { RoleKey, ServiceResult } from '@/types';
import { createDemoCatalog, updateDemoCatalogName } from '@/data/demo/catalogs';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { catalogSupabaseRepository } from '@/lib/services/repositories/catalogRepository.supabase';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';

export async function createCatalog(
  tenantId: string,
  name: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (!name.trim()) return { ok: false, error: 'Name erforderlich.' };

  if (getServiceMode() === 'supabase') {
    return catalogSupabaseRepository.create(tenantId, { title: name.trim() });
  }

  await new Promise((r) => setTimeout(r, 280));
  const created = createDemoCatalog(name.trim());
  return { ok: true, data: { id: created.id } };
}

export async function updateCatalog(
  catalogId: string,
  tenantId: string,
  name: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'office.catalogs.edit');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (!name.trim()) return { ok: false, error: 'Name erforderlich.' };

  if (getServiceMode() === 'supabase') {
    return { ok: false, error: 'Katalog-Bearbeitung im Live-Modus noch nicht angebunden.' };
  }

  await new Promise((r) => setTimeout(r, 280));
  const updated = updateDemoCatalogName(catalogId, name.trim());
  if (!updated) return { ok: false, error: 'Katalog nicht gefunden.' };
  return { ok: true, data: { id: catalogId } };
}
