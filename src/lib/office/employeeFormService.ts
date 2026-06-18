import type { RoleKey, ServiceResult } from '@/types';
import type { EmployeeDetail } from '@/types/modules/employeeDetail';
import { updateDemoEmployeeDetail } from '@/data/demo/employeeDetails';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';

export type EmployeeEditInput = {
  jobTitle: string;
  phone: string;
  department: string;
  notes: string;
};

export async function updateEmployee(
  employeeId: string,
  tenantId: string,
  input: EmployeeEditInput,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<EmployeeDetail>> {
  const denied = enforcePermission<EmployeeDetail>(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;

  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' };
  }

  await new Promise((r) => setTimeout(r, 350));

  const updated = updateDemoEmployeeDetail(employeeId, {
    jobTitle: input.jobTitle.trim() || null,
    phone: input.phone.trim() || null,
    department: input.department.trim() || null,
    notes: input.notes.trim() || null,
  });

  if (!updated) {
    return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
  }

  return { ok: true, data: updated };
}
