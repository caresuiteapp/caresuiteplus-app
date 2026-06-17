import type { RoleKey, ServiceResult } from '@/types';
import type { EmployeeFormData } from '@/types/forms/employeeForm';
import { createDemoEmployee } from '@/data/demo/employeeCreate';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { employeeSupabaseRepository } from '@/lib/services/repositories/employeeRepository.supabase';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { validateEmployeeForm } from './employeeFormValidation';

export async function createEmployee(
  tenantId: string,
  form: EmployeeFormData,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ id: string }>> {
  const denied = enforcePermission<{ id: string }>(actorRoleKey, 'office.employees.create');
  if (denied) return denied;

  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  const errors = validateEmployeeForm(form);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: 'Bitte Pflichtfelder ausfüllen.' };
  }

  if (getServiceMode() === 'supabase') {
    return employeeSupabaseRepository.create(tenantId, {
      firstName: form.firstName,
      lastName: form.lastName,
      jobTitle: form.jobTitle,
      email: form.email,
      phone: form.phone,
      department: form.department,
      status: form.status,
    });
  }

  await new Promise((r) => setTimeout(r, 350));
  const created = createDemoEmployee(form);
  return { ok: true, data: { id: created.id } };
}
