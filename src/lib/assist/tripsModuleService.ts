import type { RoleKey, ServiceResult } from '@/types';
import { tripsDemo } from '@/data/demo/domains/tripsDemo';
import { fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { tripSupabaseRepository } from '@/lib/services/repositories/tripRepository.supabase';

/** WP307 — Trips Modul-Service */
export async function fetchTripModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'assist.trips.view',
    wp: 307,
    domain: 'trips',
    demoRecords: tripsDemo.records,
    supabaseRepo: tripSupabaseRepository,
  });
}
