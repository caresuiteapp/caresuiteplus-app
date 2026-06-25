import type { ServiceResult } from '@/types';
import type {
  EmployeeBackgroundCheckRecord,
  EmployeeDocumentRecord,
  EmployeePersonnelFile,
  EmployeeQualificationRecord,
} from '@/types/modules/employeePersonnelFile';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  EMPLOYEE_BASE_SELECT_COLUMNS,
  EMPLOYEE_DETAIL_SELECT_COLUMNS,
} from './employeeDetailMapper';
import {
  buildEmployeePersonnelFileFromLiveRows,
  mapEmployeeDocumentsLiveRows,
  mapInventoryAssignmentToWorkMaterial,
  type EmployeeDocumentLiveRow,
  type EmployeePersonnelLiveRow,
  type EmployeePortalAccountLiveRow,
  type InventoryAssignmentWorkMaterialRow,
} from './employeePersonnelFileMapper';
import { loadEmployeeHomeOfficeOverride } from './employeeHomeOfficeService';
import { loadEmployeeAuditEventsFromDb } from './employeePersonnelAuditService';

/** Columns known from migrations 0005 + 0132 (+ detail mapper extras when present). */
const EMPLOYEE_PERSONNEL_SAFE_SELECT = [
  EMPLOYEE_DETAIL_SELECT_COLUMNS,
  'date_of_birth',
  'employee_number',
  'country',
  'emergency_contact_name',
  'emergency_contact_phone',
  'entry_date',
  'exit_date',
  'cost_center',
  'notes',
  'start_date',
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

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    (msg.includes('column') && msg.includes('does not exist')) ||
    (msg.includes('Could not find the') && msg.includes('column'))
  );
}

async function loadEmployeeRow(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeePersonnelLiveRow>> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
  }

  const attempts = [
    EMPLOYEE_PERSONNEL_SAFE_SELECT,
    EMPLOYEE_DETAIL_SELECT_COLUMNS,
    EMPLOYEE_BASE_SELECT_COLUMNS,
  ];

  for (const select of attempts) {
    const { data, error } = await fromUnknownTable(supabase, 'employees')
      .select(select)
      .eq('tenant_id', tenantId)
      .eq('id', employeeId)
      .maybeSingle();

    if (!error && data) {
      return { ok: true, data: data as unknown as EmployeePersonnelLiveRow };
    }

    if (!error && !data) {
      return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
    }

    if (error && !isMissingColumnError(error)) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }
  }

  return { ok: false, error: 'Mitarbeitende:r nicht gefunden.' };
}

async function loadEmployeeDocuments(
  tenantId: string,
  employeeId: string,
): Promise<EmployeeDocumentLiveRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const tableAttempts: Array<{ table: string; select: string }> = [
    {
      table: 'employee_documents',
      select:
        'id, tenant_id, employee_id, category, title, file_name, storage_path, sensitive, released_to_portal, valid_until, created_at, updated_at',
    },
    {
      table: 'documents',
      select:
        'id, tenant_id, employee_id, title, file_name, file_path, visibility, released_to_employee_portal, created_at, updated_at',
    },
  ];

  for (const attempt of tableAttempts) {
    const { data, error } = await fromUnknownTable(supabase, attempt.table)
      .select(attempt.select)
      .eq('tenant_id', tenantId)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data as EmployeeDocumentLiveRow[];
    }

    if (error && !isSupabaseMissingTableError(error) && !isMissingColumnError(error)) {
      return [];
    }
  }

  return [];
}

async function loadEmployeeProfileRole(
  tenantId: string,
  profileId: string | null | undefined,
): Promise<import('@/types/core/auth').RoleKey | null> {
  if (!profileId) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await fromUnknownTable(supabase, 'profiles')
    .select('role_key')
    .eq('tenant_id', tenantId)
    .eq('id', profileId)
    .maybeSingle();

  if (error || !data) return null;
  const roleKey = (data as { role_key?: string | null }).role_key;
  return (roleKey as import('@/types/core/auth').RoleKey) ?? null;
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

type EmployeeQualificationLiveRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  qualification_type: string;
  title: string;
  issuing_organization?: string | null;
  issued_at?: string | null;
  valid_until?: string | null;
  document_id?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

async function loadEmployeeQualifications(
  tenantId: string,
  employeeId: string,
): Promise<EmployeeQualificationRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await fromUnknownTable(supabase, 'employee_qualifications')
    .select(
      'id, tenant_id, employee_id, qualification_type, title, issuing_organization, issued_at, valid_until, document_id, verified_by, verified_at, status, created_at, updated_at',
    )
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId);

  if (error || !data) return [];

  return (data as EmployeeQualificationLiveRow[]).map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    qualificationType: row.qualification_type as EmployeeQualificationRecord['qualificationType'],
    title: row.title,
    issuingOrganization: row.issuing_organization ?? null,
    issuedAt: row.issued_at ?? null,
    validUntil: row.valid_until ?? null,
    documentId: row.document_id ?? null,
    verifiedBy: row.verified_by ?? null,
    verifiedAt: row.verified_at ?? null,
    status: row.status as EmployeeQualificationRecord['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

type EmployeeBackgroundCheckLiveRow = {
  id: string;
  tenant_id: string;
  employee_id: string;
  present: boolean;
  issue_date?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  follow_up_due_at?: string | null;
  status: string;
  document_id?: string | null;
  created_at: string;
  updated_at: string;
};

async function loadEmployeeBackgroundCheck(
  tenantId: string,
  employeeId: string,
): Promise<EmployeeBackgroundCheckRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await fromUnknownTable(supabase, 'employee_background_checks')
    .select(
      'id, tenant_id, employee_id, present, issue_date, verified_at, verified_by, follow_up_due_at, status, document_id, created_at, updated_at',
    )
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as EmployeeBackgroundCheckLiveRow;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    present: row.present,
    issueDate: row.issue_date ?? null,
    verifiedAt: row.verified_at ?? null,
    verifiedBy: row.verified_by ?? null,
    followUpDueAt: row.follow_up_due_at ?? null,
    status: row.status as EmployeeBackgroundCheckRecord['status'],
    documentId: row.document_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadEmployeeWorkMaterials(
  tenantId: string,
  employeeId: string,
): Promise<import('@/types/modules/employeePersonnelFile').EmployeeWorkMaterialRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const select =
    'id, tenant_id, recipient_employee_id, status, issued_at, expected_return_at, created_at, updated_at, inventory_items(name, inventory_categories(group_key))';

  const { data, error } = await fromUnknownTable(supabase, 'inventory_assignments')
    .select(select)
    .eq('tenant_id', tenantId)
    .eq('recipient_employee_id', employeeId)
    .order('issued_at', { ascending: false, nullsFirst: false });

  if (error) {
    if (isSupabaseMissingTableError(error) || isMissingColumnError(error)) return [];
    return [];
  }

  return ((data ?? []) as InventoryAssignmentWorkMaterialRow[])
    .filter((row) => row.status !== 'returned' && row.status !== 'archived')
    .map(mapInventoryAssignmentToWorkMaterial);
}

function mapEmployeeDocumentsFromRows(rows: EmployeeDocumentLiveRow[]): EmployeeDocumentRecord[] {
  if (rows.some((row) => 'storage_path' in row || 'category' in row)) {
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      employeeId: row.employee_id ?? '',
      category: ((row as { category?: string }).category ?? 'other') as EmployeeDocumentRecord['category'],
      title: row.title?.trim() || row.file_name,
      fileName: row.file_name,
      storagePath: (row as { storage_path?: string | null }).storage_path ?? row.file_path ?? null,
      sensitive:
        (row as { sensitive?: boolean }).sensitive === true ||
        row.visibility === 'confidential' ||
        row.visibility === 'internal_only',
      releasedToPortal:
        (row as { released_to_portal?: boolean }).released_to_portal ??
        row.released_to_employee_portal ??
        false,
      validUntil: (row as { valid_until?: string | null }).valid_until ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  return mapEmployeeDocumentsLiveRows(rows);
}

export async function loadEmployeePersonnelFileLive(
  tenantId: string,
  employeeId: string,
): Promise<ServiceResult<EmployeePersonnelFile>> {
  const employeeResult = await loadEmployeeRow(tenantId, employeeId);
  if (!employeeResult.ok) return employeeResult;

  const [documents, portalAccount, qualifications, backgroundCheck, profileRoleKey, workMaterials, auditEvents] =
    await Promise.all([
    loadEmployeeDocuments(tenantId, employeeId),
    loadEmployeePortalAccount(tenantId, employeeId),
    loadEmployeeQualifications(tenantId, employeeId),
    loadEmployeeBackgroundCheck(tenantId, employeeId),
    loadEmployeeProfileRole(tenantId, employeeResult.data.profile_id),
    loadEmployeeWorkMaterials(tenantId, employeeId),
    loadEmployeeAuditEventsFromDb(tenantId, employeeId),
  ]);

  await loadEmployeeHomeOfficeOverride(tenantId, employeeId);

  const file = buildEmployeePersonnelFileFromLiveRows({
    employee: employeeResult.data,
    documents,
    portalAccount,
    profileRoleKey,
    qualifications: qualifications.length > 0 ? qualifications : undefined,
    backgroundCheck: backgroundCheck ?? undefined,
    workMaterials,
    auditEvents,
  });

  personnelFileCache.set(cacheKey(tenantId, employeeId), file);
  return { ok: true, data: file };
}
