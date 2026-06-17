import type { ServiceResult } from '@/types';
import type { EmployeePersonnelFile } from '@/types/modules/employeePersonnelFile';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  buildEmployeePersonnelFileFromLiveRows,
  type EmployeeDocumentLiveRow,
  type EmployeePersonnelLiveRow,
  type EmployeePortalAccountLiveRow,
} from './employeePersonnelFileMapper';

const EMPLOYEE_PERSONNEL_SELECT = [
  'id',
  'tenant_id',
  'first_name',
  'last_name',
  'date_of_birth',
  'employee_number',
  'street',
  'house_number',
  'postal_code',
  'city',
  'country',
  'phone',
  'mobile',
  'email',
  'emergency_contact_name',
  'emergency_contact_phone',
  'entry_date',
  'exit_date',
  'status',
  'role_title',
  'employment_type',
  'weekly_hours',
  'portal_enabled',
  'profile_id',
  'has_police_clearance',
  'police_clearance_date',
  'police_clearance_valid_until',
  'has_first_aid_certificate',
  'first_aid_valid_until',
  'has_driver_license',
  'driver_license_class',
  'qualification',
  'qualification_notes',
  'internal_notes',
  'created_at',
  'updated_at',
].join(', ');

const personnelFileCache = new Map<string, EmployeePersonnelFile>();

function cacheKey(tenantId: string, employeeId: string): string {
  return `${tenantId}:${employeeId}`;
}

export function getCachedEmployeePersonnelFile(
  tenantId: string,
  employeeId: string,
): EmployeePersonnelFile | null {
  return personnelFileCache.get(cacheKey(tenantId, employeeId)) ?? null;
}

export function resetEmployeePersonnelFileLiveCache(): void {
  personnelFileCache.clear();
}

async function loadEmployeeDocuments(
  tenantId: string,
  employeeId: string,
): Promise<EmployeeDocumentLiveRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await fromUnknownTable(supabase, 'documents')
    .select(
      'id, tenant_id, employee_id, title, file_name, file_path, visibility, released_to_employee_portal, created_at, updated_at',
    )
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as EmployeeDocumentLiveRow[];
}

async function loadEmployeePortalAccount(
  tenantId: string,
  employeeId: string,
): Promise<EmployeePortalAccountLiveRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await fromUnknownTable(supabase, 'employee_portal_accounts')
    .select('last_login_at, first_login_completed, status')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  if (error || !data) return null;
  return data as EmployeePortalAccountLiveRow;
}

export async function loadEmployeePersonnelFileLive(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeePersonnelFile>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  }

  const { data, error } = await fromUnknownTable(supabase, 'employees')
    .select(EMPLOYEE_PERSONNEL_SELECT)
    .eq('tenant_id', tenantId)
    .eq('id', employeeId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (!data) {
    return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
  }

  const row = data as EmployeePersonnelLiveRow;
  const [documents, portalAccount] = await Promise.all([
    loadEmployeeDocuments(tenantId, employeeId),
    loadEmployeePortalAccount(tenantId, employeeId),
  ]);

  const file = buildEmployeePersonnelFileFromLiveRows({
    employee: row,
    documents,
    portalAccount,
  });

  personnelFileCache.set(cacheKey(tenantId, employeeId), file);
  return { ok: true, data: file };
}
