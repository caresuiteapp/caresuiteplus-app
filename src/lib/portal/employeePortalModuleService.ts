import type { RoleKey, ServiceResult } from '@/types';
import { employeePortalDemo } from '@/data/demo/domains/employeePortalDemo';
import { fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { employeePortalSupabaseRepository } from '@/lib/services/repositories/employeePortalRepository.supabase';

/** WP327 — Employee Portal Modul-Service */
export async function fetchEmployeePortalModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'portal.employee.profile.view',
    wp: 327,
    domain: 'employeePortal',
    demoRecords: employeePortalDemo.records,
    supabaseRepo: employeePortalSupabaseRepository,
  });
}
