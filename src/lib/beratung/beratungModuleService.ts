import type { RoleKey, ServiceResult } from '@/types';
import { beratungDemo } from '@/data/demo/domains/beratungDemo';
import { fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { beratungSupabaseRepository } from '@/lib/services/repositories/beratungRepository.supabase';

/** WP407 — Case Modul-Service */
export async function fetchCaseModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'beratung.cases.view',
    wp: 407,
    domain: 'beratung',
    demoRecords: beratungDemo.records,
    supabaseRepo: beratungSupabaseRepository,
  });
}
