import type { RoleKey, ServiceResult } from '@/types';
import { stationaerDemo } from '@/data/demo/domains/stationaerDemo';
import { fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { stationaerSupabaseRepository } from '@/lib/services/repositories/stationaerRepository.supabase';

/** WP387 — Stationär Modul-Service */
export async function fetchResidentModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'stationaer.residents.view',
    wp: 387,
    domain: 'stationaer',
    demoRecords: stationaerDemo.records,
    supabaseRepo: stationaerSupabaseRepository,
  });
}
