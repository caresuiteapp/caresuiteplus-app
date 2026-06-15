import type { RoleKey, ServiceResult } from '@/types';
import type { CatalogListItem, CatalogDetail, CatalogItemListItem } from '@/types/modules/catalog';
import {
  getDemoCatalogDetail,
  getDemoCatalogItems,
  getDemoCatalogListItems,
} from '@/data/demo/catalogs';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { catalogSupabaseRepository } from '@/lib/services/repositories/catalogRepository.supabase';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { runService } from '@/lib/services/serviceRunner';

const DELAY = 300;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchCatalogList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogListItem[]>> {
  const denied = enforcePermission<CatalogListItem[]>(actorRoleKey, 'office.catalogs.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    const result = await catalogSupabaseRepository.list(tenantId);
    if (!result.ok) return result;
    const data: CatalogListItem[] = result.data.map((row) => ({
      id: row.id,
      name: row.title,
      catalogType: 'service',
      description: null,
      itemCount: 0,
      status: row.status as CatalogListItem['status'],
      updatedAt: row.updated_at,
    }));
    return { ok: true, data };
  }

  return runService(async () => {
    await delay(DELAY);
    return { ok: true, data: getDemoCatalogListItems() };
  });
}

export async function fetchCatalogDetail(
  catalogId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogDetail>> {
  const denied = enforcePermission<CatalogDetail>(actorRoleKey, 'office.catalogs.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    const result = await catalogSupabaseRepository.getById(tenantId, catalogId);
    if (!result.ok) return result;
    if (!result.data) return { ok: false, error: 'Katalog nicht gefunden.' };
    return {
      ok: true,
      data: {
        id: result.data.id,
        name: result.data.title,
        catalogType: 'service',
        description: null,
        itemCount: 0,
        status: result.data.status as CatalogDetail['status'],
        updatedAt: result.data.updated_at,
        createdAt: result.data.created_at ?? result.data.updated_at,
        usageCount: 0,
      },
    };
  }

  return runService(async () => {
    await delay(DELAY);
    const detail = getDemoCatalogDetail(catalogId);
    if (!detail) return { ok: false, error: 'Katalog nicht gefunden.' };
    return { ok: true, data: detail };
  });
}

export async function fetchCatalogItems(
  catalogId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CatalogItemListItem[]>> {
  const denied = enforcePermission<CatalogItemListItem[]>(actorRoleKey, 'office.catalogs.view');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  if (getServiceMode() === 'supabase') {
    return { ok: true, data: [] };
  }

  return runService(async () => {
    await delay(DELAY);
    return { ok: true, data: getDemoCatalogItems(catalogId) };
  });
}

export function formatCatalogPrice(cents: number | null): string {
  if (cents == null) return '—';
  return `${(cents / 100).toFixed(2)} €`;
}
