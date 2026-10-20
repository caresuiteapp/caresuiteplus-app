import type { RoleKey, ServiceResult } from '@/types';
import { officeDemo } from '@/data/demo/domains/officeDemo';
import { fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { officeSupabaseRepository } from '@/lib/services/repositories/officeRepository.supabase';

/** WP147 — Office Modul-Service */
export async function fetchOfficeModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'office.access',
    wp: 147,
    domain: 'office',
    demoRecords: officeDemo.records,
    supabaseRepo: officeSupabaseRepository,
  });
}
