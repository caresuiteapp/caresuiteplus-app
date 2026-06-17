import type { RoleKey, ServiceResult } from '@/types';
import type { EmployeeDetail } from '@/types/modules/employeeDetail';
import type { EmployeeEditFormData } from '@/types/forms/employeeEditForm';
import type { EmployeeProfilePhotoValue } from '@/types/forms/employeeForm';
import { updateDemoEmployeeDetail } from '@/data/demo/employeeDetails';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { employeeSupabaseRepository } from '@/lib/services/repositories/employeeRepository.supabase';
import {
  buildEmployeeEditUpdatePayload,
  mapEmployeeDetailToEditForm,
} from './employeeEditFormMappers';
import { fetchEmployeeDetail } from './employeeDetailService';
import {
  persistEmployeeAvatarUrl,
  uploadEmployeeAvatar,
} from './employeeAvatarService';

export type EmployeeEditLoadResult = {
  employee: EmployeeDetail;
  form: EmployeeEditFormData;
};

async function resolveAvatarUrlForSave(
  tenantId: string,
  employeeId: string,
  profilePhoto: EmployeeProfilePhotoValue,
  currentAvatarUrl: string | null,
): Promise<ServiceResult<string | null>> {
  if (profilePhoto.removed) {
    if (getServiceMode() === 'supabase') {
      const cleared = await persistEmployeeAvatarUrl(tenantId, employeeId, null);
      if (!cleared.ok) return cleared;
    }
    return { ok: true, data: null };
  }

  if (profilePhoto.pending) {
    const uploaded = await uploadEmployeeAvatar(tenantId, employeeId, profilePhoto.pending);
    if (!uploaded.ok) return uploaded;
    if (getServiceMode() === 'supabase') {
      const persisted = await persistEmployeeAvatarUrl(tenantId, employeeId, uploaded.data.avatarUrl);
      if (!persisted.ok) return persisted;
    }
    return { ok: true, data: uploaded.data.avatarUrl };
  }

  return { ok: true, data: currentAvatarUrl };
}

export async function fetchEmployeeEditData(
  employeeId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<EmployeeEditLoadResult>> {
  const detail = await fetchEmployeeDetail(employeeId, tenantId, actorRoleKey);
  if (!detail.ok) return detail;

  return {
    ok: true,
    data: {
      employee: detail.data,
      form: mapEmployeeDetailToEditForm(detail.data),
    },
  };
}

export async function saveEmployeeEdit(
  employeeId: string,
  tenantId: string,
  form: EmployeeEditFormData,
  actorRoleKey?: RoleKey | null,
  currentAvatarUrl: string | null = null,
): Promise<ServiceResult<EmployeeDetail>> {
  const denied = enforcePermission<EmployeeDetail>(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const avatarResult = await resolveAvatarUrlForSave(
    tenantId,
    employeeId,
    form.profilePhoto,
    currentAvatarUrl,
  );
  if (!avatarResult.ok) return avatarResult;

  const patch = buildEmployeeEditUpdatePayload(form);
  patch.avatar_url = avatarResult.data;

  if (getServiceMode() === 'supabase') {
    const updated = await employeeSupabaseRepository.update(tenantId, employeeId, patch);
    if (!updated.ok) return updated;
    return employeeSupabaseRepository.getDetailMapped(tenantId, employeeId);
  }

  await new Promise((r) => setTimeout(r, 350));

  const updated = updateDemoEmployeeDetail(employeeId, {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    jobTitle: form.roleKey.trim(),
    phone: form.phone.trim() || null,
    mobile: form.mobile.trim() || null,
    department: form.departmentKey.trim() || null,
    status: form.status as EmployeeDetail['status'],
    notes: form.notes.trim() || null,
    avatarUrl: avatarResult.data,
    startDate: form.entryDate || null,
    employmentType: form.employmentType.trim() || null,
    weeklyHours: form.weeklyHours.trim() ? Number(form.weeklyHours.replace(',', '.')) : null,
    street: form.street.trim() || null,
    houseNumber: form.houseNumber.trim() || null,
    postalCode: form.postalCode.trim() || null,
    city: form.city.trim() || null,
    hasFirstAidCertificate: form.hasFirstAidCertificate,
    hasDriverLicense: form.hasDriverLicense,
    driverLicenseClass: form.driverLicenseClass.trim() || null,
    hasPoliceClearance: form.hasPoliceClearance,
    policeClearanceDate: form.policeClearanceDate.trim() || null,
  });

  if (!updated) {
    return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
  }

  return { ok: true, data: updated };
}
