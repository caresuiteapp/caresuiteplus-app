import type { RoleKey, ServiceResult } from '@/types';
import type { EmployeeFormData } from '@/types/forms/employeeForm';
import { createDemoEmployee } from '@/data/demo/employeeCreate';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { employeeSupabaseRepository } from '@/lib/services/repositories/employeeRepository.supabase';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import {
  persistEmployeeAvatarUrl,
  uploadEmployeeAvatar,
} from './employeeAvatarService';
import { validateEmployeeForm } from './employeeFormValidation';

async function persistProfilePhotoAfterCreate(
  tenantId: string,
  employeeId: string,
  form: EmployeeFormData,
): Promise<ServiceResult<void>> {
  const photo = form.profilePhoto;
  if (!photo || photo.removed || !photo.pending) {
    return { ok: true, data: undefined };
  }

  const uploaded = await uploadEmployeeAvatar(tenantId, employeeId, photo.pending);
  if (!uploaded.ok) return uploaded;

  return persistEmployeeAvatarUrl(tenantId, employeeId, uploaded.data.avatarUrl);
}

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
    const created = await employeeSupabaseRepository.create(tenantId, {
      firstName: form.firstName,
      lastName: form.lastName,
      jobTitle: form.jobTitle,
      email: form.email,
      phone: form.phone,
      department: form.department,
      status: form.status,
    });
    if (!created.ok) return created;

    const avatarResult = await persistProfilePhotoAfterCreate(tenantId, created.data.id, form);
    if (!avatarResult.ok) {
      return { ok: false, error: avatarResult.error };
    }

    return created;
  }

  await new Promise((r) => setTimeout(r, 350));
  const created = createDemoEmployee(form);
  return { ok: true, data: { id: created.id } };
}
