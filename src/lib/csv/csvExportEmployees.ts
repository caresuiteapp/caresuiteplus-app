import type { RoleKey, ServiceResult } from '@/types';
import type { CsvEmployeeExportFilters } from '@/types/csv';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { createExportLog } from './csvImportLogs';
import {
  employeeStatusToLabel,
  employmentTypeToLabel,
  formatBooleanGerman,
  formatDateGerman,
} from './csvValueUtils';
import { buildExportFileName, triggerCsvDownload } from './csvDownload';
import { serializeCsv } from './csvParser';
import { EMPLOYEE_IMPORT_ALL_FIELDS } from '@/types/employeeImport';

type EmployeeRow = {
  employee_number: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  role_title: string | null;
  employment_type: string | null;
  entry_date: string | null;
  exit_date: string | null;
  weekly_hours: number | null;
  status: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  qualification: string | null;
  has_police_clearance: boolean | null;
  police_clearance_date: string | null;
  has_driver_license: boolean | null;
  first_aid_valid_until: string | null;
  internal_notes: string | null;
};

export async function exportEmployeesCsv(input: {
  tenantId: string;
  userId: string;
  filters: CsvEmployeeExportFilters;
  actorRoleKey?: RoleKey | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  download?: boolean;
}): Promise<ServiceResult<{ csv: string; fileName: string; count: number }>> {
  const denied = enforcePermission(input.actorRoleKey, 'tenant.settings.csv.export.employees');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  let query = supabase
    .from('employees')
    .select(
      'employee_number, first_name, last_name, date_of_birth, email, phone, mobile, street, house_number, postal_code, city, role_title, employment_type, entry_date, exit_date, weekly_hours, status, emergency_contact_name, emergency_contact_phone, qualification, has_police_clearance, police_clearance_date, has_driver_license, first_aid_valid_until, internal_notes',
    )
    .eq('tenant_id', input.tenantId)
    .is('deleted_at', null);

  if (input.filters.statusFilter === 'active') query = query.eq('status', 'active');
  if (input.filters.statusFilter === 'inactive') query = query.eq('status', 'inactive');
  if (input.filters.statusFilter === 'terminated') query = query.eq('status', 'terminated');
  if (input.filters.role) query = query.ilike('role_title', `%${input.filters.role}%`);
  if (input.filters.employmentType) query = query.eq('employment_type', input.filters.employmentType as never);
  if (input.filters.city) query = query.ilike('city', `%${input.filters.city}%`);
  if (input.filters.entryFrom) query = query.gte('entry_date', input.filters.entryFrom);
  if (input.filters.entryTo) query = query.lte('entry_date', input.filters.entryTo);

  const { data, error } = await query.order('last_name', { ascending: true });
  if (error) return { ok: false, error: toGermanSupabaseError(error) };

  let rows = (data ?? []) as EmployeeRow[];
  if (input.filters.einsatzbereich) {
    const needle = input.filters.einsatzbereich.toLowerCase();
    rows = rows.filter((r) => (r.internal_notes ?? '').toLowerCase().includes(needle));
  }

  const scopes = new Set(input.filters.scopes);
  const wantsSensitive = scopes.has('abrechnung');
  const canSensitive = !enforcePermission(input.actorRoleKey, 'office.employees.view_sensitive');
  if (wantsSensitive && !canSensitive) {
    return { ok: false, error: 'Keine Berechtigung für sensible Mitarbeiter:innen-Daten im Export.' };
  }

  const headers = [...EMPLOYEE_IMPORT_ALL_FIELDS] as string[];
  const csvRows = rows.map((row) => [
    row.employee_number ?? '',
    '',
    '',
    row.first_name,
    row.last_name,
    formatDateGerman(row.date_of_birth),
    scopes.has('kontakt') || scopes.has('basis') ? row.email ?? '' : '',
    row.phone ?? '',
    row.mobile ?? '',
    row.street ?? '',
    row.house_number ?? '',
    row.postal_code ?? '',
    row.city ?? '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    formatDateGerman(row.entry_date),
    row.role_title ?? '',
    employmentTypeToLabel(row.employment_type),
    row.weekly_hours != null ? String(row.weekly_hours) : '',
    '',
    '',
    '',
    formatDateGerman(row.exit_date),
    scopes.has('notfall') ? row.emergency_contact_name ?? '' : '',
    scopes.has('notfall') ? '' : '',
    scopes.has('notfall') ? row.emergency_contact_phone ?? '' : '',
    formatBooleanGerman(row.has_police_clearance),
    formatDateGerman(row.police_clearance_date),
    scopes.has('qualifikation') ? row.qualification ?? '' : '',
    '',
    formatDateGerman(row.first_aid_valid_until),
    formatBooleanGerman(row.has_driver_license),
    '',
    scopes.has('beschaeftigung') ? '' : '',
    scopes.has('notizen') && canSensitive ? row.internal_notes ?? '' : '',
    employeeStatusToLabel(row.status),
  ]);

  const fileName = buildExportFileName('employees');
  const csv = serializeCsv(headers, csvRows, ';');

  await createExportLog({
    tenantId: input.tenantId,
    userId: input.userId,
    exportType: 'employees',
    filters: input.filters as unknown as Record<string, unknown>,
    numberOfRecords: csvRows.length,
    fileName,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    actorRoleKey: input.actorRoleKey,
  });

  if (input.download !== false) triggerCsvDownload(csv, fileName);

  return { ok: true, data: { csv, fileName, count: csvRows.length } };
}

export async function loadEmployeeRoleOptions(tenantId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data: catalogRows } = await supabase
    .from('catalog_entries')
    .select('label')
    .eq('catalog_type', 'employee_role')
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .eq('is_active', true);

  const fromCatalog = (catalogRows ?? []).map((r) => String(r.label)).filter(Boolean);

  const { data: employees } = await supabase
    .from('employees')
    .select('role_title')
    .eq('tenant_id', tenantId)
    .not('role_title', 'is', null);

  const fromEmployees = (employees ?? [])
    .map((r) => String(r.role_title ?? '').trim())
    .filter(Boolean);

  return [...new Set([...fromCatalog, ...fromEmployees])].sort((a, b) => a.localeCompare(b, 'de'));
}
