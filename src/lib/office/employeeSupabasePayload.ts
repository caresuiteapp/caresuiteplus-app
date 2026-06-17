import { mapCatalogStatusToDbStatus } from './employeeStatusMapping';

export type EmployeeWriteInput = {
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  department?: string;
  status?: string;
  notes?: string | null;
  avatarUrl?: string | null;
  entryDate?: string | null;
  employmentType?: string | null;
  weeklyHours?: number | null;
  street?: string | null;
  houseNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  hasFirstAidCertificate?: boolean;
  hasDriverLicense?: boolean;
  driverLicenseClass?: string | null;
  hasPoliceClearance?: boolean;
  policeClearanceDate?: string | null;
};

/** INSERT/UPDATE payload aligned with live Supabase schema (role_title + employee_status enum). */
export function buildEmployeeInsertPayload(
  tenantId: string,
  input: EmployeeWriteInput & { firstName: string; lastName: string },
): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    role_title: input.jobTitle?.trim() ?? null,
    email: input.email?.trim() ?? null,
    phone: input.phone?.trim() || null,
    mobile: input.mobile?.trim() || null,
    department: input.department?.trim() || null,
    status: mapCatalogStatusToDbStatus(input.status),
    avatar_url: input.avatarUrl?.trim() || null,
    internal_notes: input.notes?.trim() || null,
    entry_date: input.entryDate || null,
    employment_type: input.employmentType?.trim() || null,
    weekly_hours: input.weeklyHours ?? null,
    street: input.street?.trim() || null,
    house_number: input.houseNumber?.trim() || null,
    postal_code: input.postalCode?.trim() || null,
    city: input.city?.trim() || null,
    has_first_aid_certificate: input.hasFirstAidCertificate ?? false,
    has_driver_license: input.hasDriverLicense ?? false,
    driver_license_class: input.driverLicenseClass?.trim() || null,
    has_police_clearance: input.hasPoliceClearance ?? false,
    police_clearance_date: input.policeClearanceDate || null,
  };
}

export function buildEmployeeUpdatePayload(
  input: Partial<EmployeeWriteInput>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (input.firstName !== undefined) patch.first_name = input.firstName.trim();
  if (input.lastName !== undefined) patch.last_name = input.lastName.trim();
  if (input.jobTitle !== undefined) patch.role_title = input.jobTitle?.trim() || null;
  if (input.email !== undefined) patch.email = input.email?.trim() || null;
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.mobile !== undefined) patch.mobile = input.mobile?.trim() || null;
  if (input.department !== undefined) patch.department = input.department?.trim() || null;
  if (input.notes !== undefined) patch.internal_notes = input.notes?.trim() || null;
  if (input.status !== undefined) patch.status = mapCatalogStatusToDbStatus(input.status);
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl?.trim() || null;
  if (input.entryDate !== undefined) patch.entry_date = input.entryDate || null;
  if (input.employmentType !== undefined) {
    patch.employment_type = input.employmentType?.trim() || null;
  }
  if (input.weeklyHours !== undefined) patch.weekly_hours = input.weeklyHours;
  if (input.street !== undefined) patch.street = input.street?.trim() || null;
  if (input.houseNumber !== undefined) patch.house_number = input.houseNumber?.trim() || null;
  if (input.postalCode !== undefined) patch.postal_code = input.postalCode?.trim() || null;
  if (input.city !== undefined) patch.city = input.city?.trim() || null;
  if (input.hasFirstAidCertificate !== undefined) {
    patch.has_first_aid_certificate = input.hasFirstAidCertificate;
  }
  if (input.hasDriverLicense !== undefined) patch.has_driver_license = input.hasDriverLicense;
  if (input.driverLicenseClass !== undefined) {
    patch.driver_license_class = input.driverLicenseClass?.trim() || null;
  }
  if (input.hasPoliceClearance !== undefined) patch.has_police_clearance = input.hasPoliceClearance;
  if (input.policeClearanceDate !== undefined) {
    patch.police_clearance_date = input.policeClearanceDate || null;
  }

  return patch;
}
