import type { Profile, RoleKey, ServiceResult } from '@/types';
import type { EmployeeListItem } from '@/types/modules/employeeList';
import { demoEmployees } from '@/data/demo/employees';
import { enforceWithActor } from '@/lib/permissions/actorPermissions';
import { getServiceMode } from '@/lib/services/mode';
import { employeeSupabaseRepository } from '@/lib/services/repositories/employeeRepository.supabase';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { isDemoEmployeeDeleted } from '@/lib/office/demoDeleteStore';

export async function fetchEmployeeList(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  actorProfile?: Profile | null,
): Promise<ServiceResult<EmployeeListItem[]>> {
  const denied = await enforceWithActor<EmployeeListItem[]>(
    actorRoleKey,
    tenantId,
    actorProfile,
    'office.employees.view',
  );
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return employeeSupabaseRepository.list(tenantId);
  }

  await new Promise((r) => setTimeout(r, 280));
  return {
    ok: true,
    data: demoEmployees
      .filter((employee) => !isDemoEmployeeDeleted(employee.id))
      .map((employee) => ({ ...employee, avatarUrl: null })),
  };
}
