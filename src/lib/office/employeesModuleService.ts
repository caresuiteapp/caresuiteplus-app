import type { RoleKey, ServiceResult } from '@/types';
import { employeesDemo } from '@/data/demo/domains/employeesDemo';
import { adaptSnapshotListRepo, fetchDomainModuleSnapshot } from '@/lib/services/fetchDomainModuleSnapshot';
import { employeeSupabaseRepository } from '@/lib/services/repositories/employeeRepository.supabase';

/** WP187 — Employee Modul-Service */
export async function fetchEmployeeModuleSnapshot(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ wp: number; domain: string; recordCount: number; labels: string[] }>> {
  return fetchDomainModuleSnapshot(tenantId, actorRoleKey, {
    permission: 'office.employees.view',
    wp: 187,
    domain: 'employees',
    demoRecords: employeesDemo.records,
    supabaseRepo: adaptSnapshotListRepo(
      (id) => employeeSupabaseRepository.list(id),
      (employee) => `${employee.firstName} ${employee.lastName}`.trim(),
    ),
  });
}
