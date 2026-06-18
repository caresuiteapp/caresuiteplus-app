import type { EmployeeEditFormData } from '@/types/forms/employeeEditForm';
import type { EmployeeProfilePhotoValue } from '@/types/forms/employeeForm';
import { EMPTY_EMPLOYEE_PROFILE_PHOTO } from '@/types/forms/employeeForm';
import { saveEmployeeEdit } from './employeeEditService';

/** @deprecated Use EmployeeEditFormData from employeeEditForm.ts */
export type EmployeeEditInput = EmployeeEditFormData;

export async function updateEmployee(
  employeeId: string,
  tenantId: string,
  input: EmployeeEditFormData,
  actorRoleKey?: Parameters<typeof saveEmployeeEdit>[3],
  currentAvatarUrl: string | null = null,
) {
  return saveEmployeeEdit(employeeId, tenantId, input, actorRoleKey, currentAvatarUrl);
}

export { EMPTY_EMPLOYEE_PROFILE_PHOTO };
export type { EmployeeProfilePhotoValue };
