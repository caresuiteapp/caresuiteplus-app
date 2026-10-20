import type { RoleKey, ServiceResult } from '@/types';
import type {
  CsvFieldMapping,
  CsvImportLogRecord,
  CsvImportLogStatus,
  CsvImportType,
  CsvRowIssue,
  CsvValidationSummary,
} from '@/types/csv';
import { enforcePermission } from '@/lib/permissions';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { enrichCsvRowIssues } from './csvFieldHints';

function mapLogRow(row: Record<string, unknown>): CsvImportLogRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    userId: String(row.user_id),
    importType: row.import_type as CsvImportType,
    fileName: (row.file_name as string | null) ?? null,
    fileSize: row.file_size != null ? Number(row.file_size) : null,
    totalRows: Number(row.total_rows ?? 0),
    validRows: Number(row.valid_rows ?? 0),
    invalidRows: Number(row.invalid_rows ?? 0),
    importedRows: Number(row.imported_rows ?? 0),
    skippedRows: Number(row.skipped_rows ?? 0),
    updatedRows: Number(row.updated_rows ?? 0),
    failedRows: Number(row.failed_rows ?? 0),
    status: row.status as CsvImportLogStatus,
    rawMapping: (row.raw_mapping as CsvFieldMapping[] | null) ?? null,
    validationResult: (row.validation_result as CsvValidationSummary | null) ?? null,
    errorSummary: (row.error_summary as string | null) ?? null,
    startedAt: (row.started_at as string | null) ?? null,
    finishedAt: (row.finished_at as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export async function createImportLog(input: {
  tenantId: string;
  userId: string;
  importType: CsvImportType;
  fileName: string;
  fileSize: number;
  actorRoleKey?: RoleKey | null;
}): Promise<ServiceResult<{ id: string }>> {
  const perm =
    input.importType === 'clients'
      ? ('tenant.settings.csv.import.clients' as const)
      : ('tenant.settings.csv.import.employees' as const);
  const denied = enforcePermission<{ id: string }>(input.actorRoleKey, perm);
  if (denied) return denied;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const now = new Date().toISOString();
  const { data, error } = await fromUnknownTable(supabase, 'csv_import_logs')
    .insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      import_type: input.importType,
      file_name: input.fileName,
      file_size: input.fileSize,
      status: 'uploaded',
      started_at: now,
    })
    .select('id')
    .single();

  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: String((data as { id: string }).id) } };
}

export async function updateImportLog(
  logId: string,
  patch: Partial<{
    status: CsvImportLogStatus;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    importedRows: number;
    skippedRows: number;
    updatedRows: number;
    failedRows: number;
    rawMapping: CsvFieldMapping[];
    validationResult: CsvValidationSummary;
    errorSummary: string | null;
    finishedAt: string;
  }>,
): Promise<ServiceResult<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const payload: Record<string, unknown> = {};
  if (patch.status) payload.status = patch.status;
  if (patch.totalRows != null) payload.total_rows = patch.totalRows;
  if (patch.validRows != null) payload.valid_rows = patch.validRows;
  if (patch.invalidRows != null) payload.invalid_rows = patch.invalidRows;
  if (patch.importedRows != null) payload.imported_rows = patch.importedRows;
  if (patch.skippedRows != null) payload.skipped_rows = patch.skippedRows;
  if (patch.updatedRows != null) payload.updated_rows = patch.updatedRows;
  if (patch.failedRows != null) payload.failed_rows = patch.failedRows;
  if (patch.rawMapping) payload.raw_mapping = patch.rawMapping;
  if (patch.validationResult) payload.validation_result = patch.validationResult;
  if (patch.errorSummary !== undefined) payload.error_summary = patch.errorSummary;
  if (patch.finishedAt) payload.finished_at = patch.finishedAt;

  const { error } = await fromUnknownTable(supabase, 'csv_import_logs').update(payload).eq('id', logId);
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: undefined };
}

export async function appendImportRowErrors(
  tenantId: string,
  importLogId: string,
  issues: CsvRowIssue[],
): Promise<ServiceResult<void>> {
  if (issues.length === 0) return { ok: true, data: undefined };
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const rows = issues.map((i) => ({
    import_log_id: importLogId,
    tenant_id: tenantId,
    row_number: i.rowNumber,
    field_name: i.fieldName,
    error_code: i.errorCode,
    error_message: i.errorMessage,
    raw_value: i.rawValue,
    severity: i.severity,
  }));

  const { error } = await fromUnknownTable(supabase, 'csv_import_row_errors').insert(rows);
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: undefined };
}

export async function listImportLogs(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<CsvImportLogRecord[]>> {
  const denied = enforcePermission<CsvImportLogRecord[]>(actorRoleKey, 'tenant.settings.csv.logs.view');
  if (denied) return denied;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data, error } = await fromUnknownTable(supabase, 'csv_import_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: (data ?? []).map((row) => mapLogRow(row as Record<string, unknown>)) };
}

export async function getImportLogDetail(
  tenantId: string,
  logId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ log: CsvImportLogRecord; errors: CsvRowIssue[] }>> {
  const denied = enforcePermission<{ log: CsvImportLogRecord; errors: CsvRowIssue[] }>(
    actorRoleKey,
    'tenant.settings.csv.logs.view',
  );
  if (denied) return denied;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { data: logRow, error: logError } = await fromUnknownTable(supabase, 'csv_import_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', logId)
    .maybeSingle();

  if (logError || !logRow) return { ok: false, error: 'Importprotokoll nicht gefunden.' };

  const { data: errorRows, error: errorsError } = await fromUnknownTable(supabase, 'csv_import_row_errors')
    .select('*')
    .eq('import_log_id', logId)
    .order('row_number', { ascending: true });

  if (errorsError) return { ok: false, error: toGermanSupabaseError(errorsError) };

  const errors: CsvRowIssue[] = enrichCsvRowIssues(
    (errorRows ?? []).map((row) => ({
      rowNumber: Number((row as { row_number: number }).row_number),
      fieldName: (row as { field_name: string | null }).field_name,
      errorCode: String((row as { error_code: string }).error_code),
      errorMessage: String((row as { error_message: string }).error_message),
      rawValue: (row as { raw_value: string | null }).raw_value,
      severity: (row as { severity: CsvRowIssue['severity'] }).severity,
    })),
    { importType: (logRow as { import_type: CsvImportType }).import_type },
  );

  return {
    ok: true,
    data: {
      log: mapLogRow(logRow as Record<string, unknown>),
      errors,
    },
  };
}

export async function createExportLog(input: {
  tenantId: string;
  userId: string;
  exportType: 'clients' | 'employees';
  filters: Record<string, unknown>;
  numberOfRecords: number;
  fileName: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  actorRoleKey?: RoleKey | null;
}): Promise<ServiceResult<void>> {
  const perm =
    input.exportType === 'clients'
      ? ('tenant.settings.csv.export.clients' as const)
      : ('tenant.settings.csv.export.employees' as const);
  const denied = enforcePermission<void>(input.actorRoleKey, perm);
  if (denied) return denied;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase nicht verfügbar.' };

  const { error } = await fromUnknownTable(supabase, 'csv_export_logs').insert({
    tenant_id: input.tenantId,
    user_id: input.userId,
    export_type: input.exportType,
    filters: input.filters,
    number_of_records: input.numberOfRecords,
    file_name: input.fileName,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  });

  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: undefined };
}
