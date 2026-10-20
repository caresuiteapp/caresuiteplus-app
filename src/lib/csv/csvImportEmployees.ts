import type { RoleKey, ServiceResult } from '@/types';
import type { CsvImportMode, CsvImportPreview } from '@/types/csv';
import type { EmployeeImportRow } from '@/types/employeeImport';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { appendImportRowErrors, createImportLog, updateImportLog } from './csvImportLogs';
import { insertEmployeeFromCsvRow } from './csvImportEmployeePersistence';

export async function executeEmployeeCsvImport(input: {
  tenantId: string;
  userId: string;
  actorProfileId?: string | null;
  actorRoleKey?: RoleKey | null;
  preview: CsvImportPreview<EmployeeImportRow>;
  importMode?: CsvImportMode;
  validRowsOnly?: boolean;
}): Promise<
  ServiceResult<{
    imported: number;
    skipped: number;
    failed: number;
    logId: string;
    status: 'imported' | 'partially_imported' | 'failed';
  }>
> {
  const deniedCreate = enforcePermission(input.actorRoleKey, 'office.employees.create');
  if (deniedCreate) return deniedCreate;
  const deniedCsv = enforcePermission(input.actorRoleKey, 'tenant.settings.csv.import.employees');
  if (deniedCsv) return deniedCsv;
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const logCreated = await createImportLog({
    tenantId: input.tenantId,
    userId: input.userId,
    importType: 'employees',
    fileName: input.preview.fileName,
    fileSize: input.preview.fileSize,
    actorRoleKey: input.actorRoleKey,
  });
  if (!logCreated.ok) return logCreated;

  const logId = logCreated.data.id;
  await updateImportLog(logId, {
    status: 'validated',
    totalRows: input.preview.summary.totalRows,
    validRows: input.preview.summary.validRows,
    invalidRows: input.preview.summary.invalidRows,
    rawMapping: input.preview.mapping,
    validationResult: input.preview.summary,
  });

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const importErrors = [...input.preview.allIssues];

  for (const row of input.preview.rows) {
    if (row.isDuplicate || (!row.isValid && input.validRowsOnly)) {
      skipped += 1;
      continue;
    }
    if (!row.isValid && !input.validRowsOnly) {
      skipped += 1;
      continue;
    }

    const result = await insertEmployeeFromCsvRow(input.tenantId, row.data, input.actorProfileId);
    if (!result.ok) {
      failed += 1;
      importErrors.push({
        rowNumber: row.rowNumber,
        fieldName: null,
        errorCode: 'INSERT_FAILED',
        errorMessage: result.error,
        rawValue: null,
        severity: 'error',
      });
    } else {
      imported += 1;
    }
  }

  const status =
    imported === 0 && failed > 0
      ? 'failed'
      : failed > 0 || skipped > 0
        ? 'partially_imported'
        : 'imported';

  await updateImportLog(logId, {
    status,
    importedRows: imported,
    skippedRows: skipped,
    failedRows: failed,
    finishedAt: new Date().toISOString(),
    errorSummary: failed > 0 ? `${failed} Zeile(n) fehlgeschlagen` : null,
  });

  await appendImportRowErrors(input.tenantId, logId, importErrors);

  return {
    ok: true,
    data: { imported, skipped, failed, logId, status },
  };
}
