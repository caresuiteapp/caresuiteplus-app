import type { RoleKey, ServiceResult } from '@/types';
import type { WorkflowStatus } from '@/types/core/base';
import type { EmployeeListItem } from '@/types/modules/employeeList';
import { demoEmployees } from '@/data/demo/employees';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { employeeSupabaseRepository } from '@/lib/services/repositories/employeeRepository.supabase';

const ASSIGNABLE_EMPLOYEE_STATUSES = new Set<WorkflowStatus>([
  'aktiv',
  'in_bearbeitung',
  'abgeschlossen',
]);

function filterAssignableEmployees(employees: EmployeeListItem[]): EmployeeListItem[] {
  return employees.filter((employee) => ASSIGNABLE_EMPLOYEE_STATUSES.has(employee.status));
}

/** Mitarbeitende für Einsatzplanung — Berechtigung über Assist, nicht Office-Stammdaten. */
export async function fetchAssignmentEmployeeList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<EmployeeListItem[]>> {
  const denied = enforcePermission<EmployeeListItem[]>(actorRoleKey, 'assist.assignments.manage');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await employeeSupabaseRepository.list(tenantId);
    if (!result.ok) return result;
    return { ok: true, data: filterAssignableEmployees(result.data) };
  }

  await new Promise((r) => setTimeout(r, 280));
  return { ok: true, data: filterAssignableEmployees(demoEmployees as EmployeeListItem[]) };
}
