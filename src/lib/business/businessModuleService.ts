import type { RoleKey, ServiceResult } from '@/types';
import { businessDemo } from '@/data/demo/domains/businessDemo';
import { fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { businessSupabaseRepository } from '@/lib/services/repositories/businessRepository.supabase';

/** WP127 — Business Modul-Service */
export async function fetchBusinessModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'dashboard.view',
    wp: 127,
    domain: 'business',
    demoRecords: businessDemo.records,
    supabaseRepo: businessSupabaseRepository,
  });
}
