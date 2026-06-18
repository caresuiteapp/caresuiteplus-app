import type { RoleKey, ServiceResult } from '@/types';
import type { EmployeeDetail } from '@/types/modules/employeeDetail';
import { getDemoEmployeeDetail } from '@/data/demo/employeeDetails';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { isDemoEmployeeDeleted } from '@/lib/office/demoDeleteStore';
import { employeeSupabaseRepository } from '@/lib/services/repositories/employeeRepository.supabase';

export async function fetchEmployeeDetail(
  employeeId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<EmployeeDetail>> {
  const denied = enforcePermission<EmployeeDetail>(actorRoleKey, 'office.employees.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() === 'supabase') {
    return employeeSupabaseRepository.getDetailMapped(tenantId, employeeId);
  }

  await new Promise((r) => setTimeout(r, 260));

  if (isDemoEmployeeDeleted(employeeId)) {
    return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
  }

  const detail = getDemoEmployeeDetail(employeeId);
  if (!detail) {
    return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
  }

  return { ok: true, data: detail };
}
