import type { EmployeeAvatarPending } from '@/lib/office/employeeAvatarService';

export type EmployeeFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  status?: string;
  profilePhoto?: EmployeeProfilePhotoValue | null;
};

export type EmployeeFormErrors = Partial<Record<keyof EmployeeFormData, string>>;

export const EMPTY_EMPLOYEE_FORM: EmployeeFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  jobTitle: '',
  department: '',
};

export type EmployeeProfilePhotoValue = {
  displayUri: string | null;
  pending: EmployeeAvatarPending | null;
  removed: boolean;
};

export const EMPTY_EMPLOYEE_PROFILE_PHOTO: EmployeeProfilePhotoValue = {
  displayUri: null,
  pending: null,
  removed: false,
};
