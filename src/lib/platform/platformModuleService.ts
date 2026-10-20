import type { RoleKey, ServiceResult } from '@/types';
import { platformDemo } from '@/data/demo/domains/platformDemo';
import { fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { platformSupabaseRepository } from '@/lib/services/repositories/platformRepository.supabase';

/** WP467 — Platform Modul-Service */
export async function fetchPlatformModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'platform.ai.manage',
    wp: 467,
    domain: 'platform',
    demoRecords: platformDemo.records,
    supabaseRepo: platformSupabaseRepository,
  });
}
