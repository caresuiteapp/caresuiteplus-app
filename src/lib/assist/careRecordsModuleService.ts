import type { RoleKey, ServiceResult } from '@/types';
import { careRecordsDemo } from '@/data/demo/domains/careRecordsDemo';
import { fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { careRecordSupabaseRepository } from '@/lib/services/repositories/careRecordRepository.supabase';

/** WP287 — Care Records Modul-Service */
export async function fetchCareRecordModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'assist.records.view',
    wp: 287,
    domain: 'careRecords',
    demoRecords: careRecordsDemo.records,
    supabaseRepo: careRecordSupabaseRepository,
  });
}
