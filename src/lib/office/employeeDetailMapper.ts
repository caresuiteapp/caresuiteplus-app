import type { ServiceResult } from '@/types';
import type { EmployeeDetail } from '@/types/modules/employeeDetail';
import type { EmployeeListItem } from '@/types/modules/employeeList';

/** Basis-Spalten aus Migration 0005. */
export const EMPLOYEE_BASE_SELECT_COLUMNS =
  'id, tenant_id, first_name, last_name, job_title, email, phone, status, created_at, updated_at';

/** Detail-Spalten aus Migration 0033 — SELECT nur wenn Migration angewendet. */
export const EMPLOYEE_DETAIL_SELECT_COLUMNS =
  `${EMPLOYEE_BASE_SELECT_COLUMNS}, department, start_date, notes`;

export const EMPLOYEE_DETAIL_REQUIRED_FIELDS = ['department', 'start_date', 'notes'] as const;

export type EmployeeDetailLiveRow = {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  job_title?: string | null;
  email?: string | null;
  phone?: string | null;
  status: string;
  department?: string | null;
  start_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

function schemaMissingDetailFields(row: EmployeeDetailLiveRow): string[] {
  const missing: string[] = [];
  for (const field of EMPLOYEE_DETAIL_REQUIRED_FIELDS) {
    if (row[field] === undefined) {
      missing.push(field);
    }
  }
  return missing;
}

function mapListFields(row: EmployeeDetailLiveRow): EmployeeListItem {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    jobTitle: String(row.job_title ?? ''),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    status: row.status as EmployeeListItem['status'],
    updatedAt: String(row.updated_at),
  };
}

function mapCompleteEmployeeDetailRow(row: EmployeeDetailLiveRow): EmployeeDetail {
  const listItem = mapListFields(row);

  return {
    ...listItem,
    createdAt: String(row.created_at ?? row.updated_at),
    department: row.department?.trim() || null,
    startDate: row.start_date?.trim() || null,
    notes: row.notes?.trim() || null,
  };
}

export function mapEmployeeRowToDetail(
  row: EmployeeDetailLiveRow,
): ServiceResult<EmployeeDetail> {
  const schemaMissing = schemaMissingDetailFields(row);
  if (schemaMissing.length > 0) {
    const fields = schemaMissing.join(', ');
    return {
      ok: false,
      error: `Live-Mitarbeitenden-Detail: Supabase-Schema unvollständig (${fields} fehlen). Migration 0033 für employees anwenden.`,
    };
  }

  return { ok: true, data: mapCompleteEmployeeDetailRow(row) };
}
