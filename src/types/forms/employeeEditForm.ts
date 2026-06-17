import type { EmployeeProfilePhotoValue } from '@/types/forms/employeeForm';
import { EMPTY_EMPLOYEE_PROFILE_PHOTO } from '@/types/forms/employeeForm';

export type EmployeeEditFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  roleKey: string;
  departmentKey: string;
  status: string;
  notes: string;
  profilePhoto: EmployeeProfilePhotoValue;
  entryDate: string;
  employmentType: string;
  weeklyHours: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  hasFirstAidCertificate: boolean;
  hasDriverLicense: boolean;
  driverLicenseClass: string;
  hasPoliceClearance: boolean;
  policeClearanceDate: string;
};

export type EmployeeEditFormErrors = Partial<Record<keyof EmployeeEditFormData, string>>;

export const EMPTY_EMPLOYEE_EDIT_FORM: EmployeeEditFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  mobile: '',
  roleKey: '',
  departmentKey: '',
  status: 'aktiv',
  notes: '',
  profilePhoto: EMPTY_EMPLOYEE_PROFILE_PHOTO,
  entryDate: '',
  employmentType: '',
  weeklyHours: '',
  street: '',
  houseNumber: '',
  postalCode: '',
  city: '',
  hasFirstAidCertificate: false,
  hasDriverLicense: false,
  driverLicenseClass: '',
  hasPoliceClearance: false,
  policeClearanceDate: '',
};
