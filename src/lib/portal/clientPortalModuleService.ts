import type { RoleKey, ServiceResult } from '@/types';
import { clientPortalDemo } from '@/data/demo/domains/clientPortalDemo';
import { fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { clientPortalSupabaseRepository } from '@/lib/services/repositories/clientPortalRepository.supabase';

/** WP347 — Client Portal Modul-Service */
export async function fetchClientPortalModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'portal.client.profile.view',
    wp: 347,
    domain: 'clientPortal',
    demoRecords: clientPortalDemo.records,
    supabaseRepo: clientPortalSupabaseRepository,
  });
}
