import type { RoleKey, ServiceResult } from '@/types';
import { pflegeDemo } from '@/data/demo/domains/pflegeDemo';
import { fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { pflegeSupabaseRepository } from '@/lib/services/repositories/pflegeRepository.supabase';

/** WP367 — CarePlan Modul-Service */
export async function fetchCarePlanModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'pflege.plans.view',
    wp: 367,
    domain: 'pflege',
    demoRecords: pflegeDemo.records,
    supabaseRepo: pflegeSupabaseRepository,
  });
}
