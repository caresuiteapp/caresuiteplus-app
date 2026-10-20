import type { EmployeeDetail } from '@/types/modules/employeeDetail';
import type { EmployeeEditFormData } from '@/types/forms/employeeEditForm';
import { EMPTY_EMPLOYEE_EDIT_FORM } from '@/types/forms/employeeEditForm';
import {
  resolveEmployeeCatalogLabel,
  resolveEmployeeDepartmentLabel,
  resolveEmployeeRoleLabel,
  resolveEmploymentTypeLabel,
} from './employeeCatalogLabels';
import { buildEmployeeUpdatePayload } from './employeeSupabasePayload';

export type EmployeeEditExtendedFields = {
  mobile?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  employmentType?: string | null;
  weeklyHours?: number | null;
  hasFirstAidCertificate?: boolean;
  hasDriverLicense?: boolean;
  driverLicenseClass?: string | null;
  hasPoliceClearance?: boolean;
  policeClearanceDate?: string | null;
};

export function mapEmployeeDetailToEditForm(
  employee: EmployeeDetail,
  extended: EmployeeEditExtendedFields = {},
): EmployeeEditFormData {
  return {
    ...EMPTY_EMPLOYEE_EDIT_FORM,
    firstName: employee.firstName ?? '',
    lastName: employee.lastName ?? '',
    email: employee.email ?? '',
    phone: employee.phone ?? '',
    mobile: extended.mobile?.trim() ?? employee.mobile?.trim() ?? '',
    roleKey: employee.jobTitle?.trim() ?? '',
    departmentKey: employee.department?.trim() ?? '',
    status: employee.status ?? 'aktiv',
    notes: employee.notes ?? '',
    profilePhoto: {
      displayUri: employee.avatarUrl,
      pending: null,
      removed: false,
    },
    entryDate: employee.startDate ?? '',
    employmentType: extended.employmentType?.trim() ?? employee.employmentType?.trim() ?? '',
    weeklyHours:
      extended.weeklyHours != null
        ? String(extended.weeklyHours)
        : employee.weeklyHours != null
          ? String(employee.weeklyHours)
          : '',
    street: extended.street?.trim() ?? employee.street?.trim() ?? '',
    houseNumber: extended.houseNumber?.trim() ?? employee.houseNumber?.trim() ?? '',
    postalCode: extended.postalCode?.trim() ?? employee.postalCode?.trim() ?? '',
    city: extended.city?.trim() ?? employee.city?.trim() ?? '',
    hasFirstAidCertificate:
      extended.hasFirstAidCertificate ?? employee.hasFirstAidCertificate ?? false,
    hasDriverLicense: extended.hasDriverLicense ?? employee.hasDriverLicense ?? false,
    driverLicenseClass:
      extended.driverLicenseClass?.trim() ?? employee.driverLicenseClass?.trim() ?? '',
    hasPoliceClearance: extended.hasPoliceClearance ?? employee.hasPoliceClearance ?? false,
    policeClearanceDate:
      extended.policeClearanceDate?.trim() ?? employee.policeClearanceDate?.trim() ?? '',
  };
}

export function buildEmployeeEditUpdatePayload(form: EmployeeEditFormData): Record<string, unknown> {
  const weeklyHoursRaw = form.weeklyHours?.trim() ?? '';
  const weeklyHours = weeklyHoursRaw ? Number(weeklyHoursRaw.replace(',', '.')) : null;

  return buildEmployeeUpdatePayload({
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone,
    mobile: form.mobile,
    jobTitle: form.roleKey,
    department: form.departmentKey,
    status: form.status,
    notes: form.notes,
    entryDate: form.entryDate || null,
    employmentType: form.employmentType || null,
    weeklyHours: Number.isFinite(weeklyHours) ? weeklyHours : null,
    street: form.street,
    houseNumber: form.houseNumber,
    postalCode: form.postalCode,
    city: form.city,
    hasFirstAidCertificate: form.hasFirstAidCertificate,
    hasDriverLicense: form.hasDriverLicense,
    driverLicenseClass: form.driverLicenseClass,
    hasPoliceClearance: form.hasPoliceClearance,
    policeClearanceDate: form.policeClearanceDate || null,
  });
}

export function formatEmployeeEditSummary(form: EmployeeEditFormData): {
  label: string;
  value: string;
}[] {
  return [
    { label: 'Name', value: `${form.firstName} ${form.lastName}`.trim() || '—' },
    { label: 'E-Mail', value: form.email.trim() || '—' },
    { label: 'Telefon', value: form.phone.trim() || '—' },
    { label: 'Mobil', value: form.mobile.trim() || '—' },
    { label: 'Rolle', value: resolveEmployeeRoleLabel(form.roleKey) },
    { label: 'Abteilung', value: resolveEmployeeDepartmentLabel(form.departmentKey) },
    {
      label: 'Status',
      value: resolveEmployeeCatalogLabel('employee_status', form.status),
    },
    { label: 'Eintritt', value: form.entryDate || '—' },
    {
      label: 'Vertragsart',
      value: resolveEmploymentTypeLabel(form.employmentType),
    },
    { label: 'Wochenstunden', value: form.weeklyHours.trim() || '—' },
    {
      label: 'Adresse',
      value: [form.street, form.houseNumber, form.postalCode, form.city].filter(Boolean).join(', ') || '—',
    },
    {
      label: 'Qualifikationen',
      value: [
        form.hasFirstAidCertificate ? 'Erste Hilfe' : null,
        form.hasDriverLicense ? 'Führerschein' : null,
      ]
        .filter(Boolean)
        .join(' · ') || '—',
    },
    {
      label: 'Führungszeugnis',
      value: form.hasPoliceClearance ? 'Vorhanden' : 'Nicht erfasst',
    },
  ];
}
