import type { RoleKey, ServiceResult } from '@/types';
import { akademieDemo } from '@/data/demo/domains/akademieDemo';
import { fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { akademieSupabaseRepository } from '@/lib/services/repositories/akademieRepository.supabase';

/** WP427 — Akademie Modul-Service */
export async function fetchCourseModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'akademie.courses.view',
    wp: 427,
    domain: 'akademie',
    demoRecords: akademieDemo.records,
    supabaseRepo: akademieSupabaseRepository,
  });
}
