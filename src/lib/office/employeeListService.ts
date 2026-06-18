import type { RoleKey, ServiceResult } from '@/types';
import type { EmployeeListItem } from '@/types/modules/employeeList';
import { demoEmployees } from '@/data/demo/employees';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { employeeSupabaseRepository } from '@/lib/services/repositories/employeeRepository.supabase';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

export async function fetchEmployeeList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<EmployeeListItem[]>> {
  const denied = enforcePermission<EmployeeListItem[]>(actorRoleKey, 'office.employees.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return employeeSupabaseRepository.list(tenantId);
  }

  await new Promise((r) => setTimeout(r, 280));
  return { ok: true, data: demoEmployees };
}
