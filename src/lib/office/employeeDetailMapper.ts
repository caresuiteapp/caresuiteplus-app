import type { ServiceResult } from '@/types';
import type { EmployeeDetail } from '@/types/modules/employeeDetail';
import type { EmployeeListItem } from '@/types/modules/employeeList';
import { mapDbStatusToCatalogStatus } from './employeeStatusMapping';

/** Live Supabase base columns (role_title + employee_status enum). */
export const EMPLOYEE_BASE_SELECT_COLUMNS =
  'id, tenant_id, first_name, last_name, role_title, email, phone, status, created_at, updated_at';

/** Detail columns on live schema (internal_notes, entry_date; avatar from 0074; department from 0075). */
export const EMPLOYEE_DETAIL_SELECT_COLUMNS = [
  EMPLOYEE_BASE_SELECT_COLUMNS,
  'department',
  'internal_notes',
  'entry_date',
  'avatar_url',
  'mobile',
  'street',
  'house_number',
  'postal_code',
  'city',
  'employment_type',
  'weekly_hours',
  'has_first_aid_certificate',
  'has_driver_license',
  'driver_license_class',
  'has_police_clearance',
  'police_clearance_date',
].join(', ');

export type EmployeeDetailLiveRow = {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  role_title?: string | null;
  /** Legacy migration 0005 — not present on live FlutterFlow schema. */
  job_title?: string | null;
  email?: string | null;
  phone?: string | null;
  status: string;
  /** Katalog employee_department (0075 live). */
  department?: string | null;
  entry_date?: string | null;
  start_date?: string | null;
  internal_notes?: string | null;
  notes?: string | null;
  avatar_url?: string | null;
  mobile?: string | null;
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  employment_type?: string | null;
  weekly_hours?: number | null;
  has_first_aid_certificate?: boolean | null;
  has_driver_license?: boolean | null;
  driver_license_class?: string | null;
  has_police_clearance?: boolean | null;
  police_clearance_date?: string | null;
  created_at: string;
  updated_at: string;
};

function resolveJobTitle(row: EmployeeDetailLiveRow): string {
  return String(row.role_title ?? row.job_title ?? '');
}

function resolveNotes(row: EmployeeDetailLiveRow): string | null {
  return (row.internal_notes ?? row.notes)?.trim() || null;
}

function resolveStartDate(row: EmployeeDetailLiveRow): string | null {
  return (row.entry_date ?? row.start_date)?.trim() || null;
}

function mapListFields(row: EmployeeDetailLiveRow): EmployeeListItem {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    jobTitle: resolveJobTitle(row),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    status: mapDbStatusToCatalogStatus(row.status) as EmployeeListItem['status'],
    updatedAt: String(row.updated_at),
    avatarUrl: row.avatar_url?.trim() || null,
  };
}

function mapCompleteEmployeeDetailRow(row: EmployeeDetailLiveRow): EmployeeDetail {
  const listItem = mapListFields(row);

  return {
    ...listItem,
    createdAt: String(row.created_at ?? row.updated_at),
    department: row.department?.trim() || null,
    startDate: resolveStartDate(row),
    notes: resolveNotes(row),
    avatarUrl: row.avatar_url?.trim() || null,
    mobile: row.mobile?.trim() || null,
    street: row.street?.trim() || null,
    houseNumber: row.house_number?.trim() || null,
    postalCode: row.postal_code?.trim() || null,
    city: row.city?.trim() || null,
    employmentType: row.employment_type?.trim() || null,
    weeklyHours: row.weekly_hours ?? null,
    hasFirstAidCertificate: row.has_first_aid_certificate === true,
    hasDriverLicense: row.has_driver_license === true,
    driverLicenseClass: row.driver_license_class?.trim() || null,
    hasPoliceClearance: row.has_police_clearance === true,
    policeClearanceDate: row.police_clearance_date?.trim() || null,
  };
}

export function mapEmployeeRowToDetail(
  row: EmployeeDetailLiveRow,
): ServiceResult<EmployeeDetail> {
  return { ok: true, data: mapCompleteEmployeeDetailRow(row) };
}
