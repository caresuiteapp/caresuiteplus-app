import type { RoleKey, ServiceResult } from '@/types';
import type { EmployeeDetail } from '@/types/modules/employeeDetail';
import type { EmployeeProfilePhotoValue } from '@/types/forms/employeeForm';
import { updateDemoEmployeeDetail } from '@/data/demo/employeeDetails';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { getServiceMode } from '@/lib/services/mode';
import { employeeSupabaseRepository } from '@/lib/services/repositories/employeeRepository.supabase';
import {
  persistEmployeeAvatarUrl,
  uploadEmployeeAvatar,
} from './employeeAvatarService';

export type EmployeeEditInput = {
  jobTitle: string;
  phone: string;
  department: string;
  notes: string;
  profilePhoto: EmployeeProfilePhotoValue;
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

export async function updateEmployee(
  employeeId: string,
  tenantId: string,
  input: EmployeeEditInput,
  actorRoleKey?: RoleKey | null,
  currentAvatarUrl: string | null = null,
): Promise<ServiceResult<EmployeeDetail>> {
  const denied = enforcePermission<EmployeeDetail>(actorRoleKey, 'office.employees.edit');
  if (denied) return denied;

  if (getServiceMode() === 'supabase') {
    const avatarResult = await resolveAvatarUrlForSave(
      tenantId,
      employeeId,
      input.profilePhoto,
      currentAvatarUrl,
    );
    if (!avatarResult.ok) return avatarResult;

    const updated = await employeeSupabaseRepository.update(tenantId, employeeId, {
      jobTitle: input.jobTitle.trim() || null,
      phone: input.phone.trim() || null,
      department: input.department.trim() || null,
      notes: input.notes.trim() || null,
      avatarUrl: avatarResult.data,
    });
    if (!updated.ok) return updated;

    return employeeSupabaseRepository.getDetailMapped(tenantId, employeeId);
  }

  if (tenantId !== DEMO_TENANT_ID) {
    return { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' };
  }

  await new Promise((r) => setTimeout(r, 350));

  const nextAvatarUrl = input.profilePhoto.removed
    ? null
    : input.profilePhoto.pending?.localUri ?? input.profilePhoto.displayUri ?? currentAvatarUrl;

  const updated = updateDemoEmployeeDetail(employeeId, {
    jobTitle: input.jobTitle.trim() || null,
    phone: input.phone.trim() || null,
    department: input.department.trim() || null,
    notes: input.notes.trim() || null,
    avatarUrl: nextAvatarUrl,
  });

  if (!updated) {
    return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
  }

  return { ok: true, data: updated };
}
