import type { RoleKey, ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { demoEmployees } from '@/data/demo/employees';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { employeeSupabaseRepository } from '@/lib/services/repositories/employeeRepository.supabase';
import { markDemoEmployeeDeleted } from './demoDeleteStore';
import { assertNoActiveAssignmentsForEmployee } from './officeDeleteGuard';
import { resetEmployeePersonnelFileLiveCache } from './employeePersonnelFileLiveLoader';

export async function deleteEmployee(
  employeeId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  actorProfileId?: string | null,
  actorDisplayName?: string | null,
): Promise<ServiceResult<void>> {
  const denied = enforcePermission<void>(actorRoleKey, 'office.employees.delete');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    const result = await employeeSupabaseRepository.delete(tenantId, employeeId, {
      actorProfileId,
      actorDisplayName,
    });
    if (result.ok) {
      resetEmployeePersonnelFileLiveCache();
    }
    return result;
  }

  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' };
  }

  const exists = demoEmployees.some((e) => e.id === employeeId);
  if (!exists) {
    return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
  }

  const assignmentBlock = await assertNoActiveAssignmentsForEmployee(tenantId, employeeId);
  if (assignmentBlock) return assignmentBlock;

  markDemoEmployeeDeleted(employeeId);
  return { ok: true, data: undefined };
}
