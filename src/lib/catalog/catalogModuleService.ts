import type { RoleKey, ServiceResult } from '@/types';
import { catalogDemo } from '@/data/demo/domains/catalogDemo';
import { fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { catalogSupabaseRepository } from '@/lib/services/repositories/catalogRepository.supabase';

/** WP447 — Catalog Modul-Service */
export async function fetchCatalogModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'office.catalogs.view',
    wp: 447,
    domain: 'catalog',
    demoRecords: catalogDemo.records,
    supabaseRepo: catalogSupabaseRepository,
  });
}
