import type { RoleKey, ServiceResult } from '@/types';
import type { ClientImportRow } from '@/types/clientImport';
import type { CsvImportMode, CsvImportPreview } from '@/types/csv';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { appendImportRowErrors, createImportLog, updateImportLog } from './csvImportLogs';
import { insertClientFromCsvRow } from './csvImportClientPersistence';

export async function executeClientCsvImport(input: {
  tenantId: string;
  userId: string;
  actorProfileId?: string | null;
  actorRoleKey?: RoleKey | null;
  preview: CsvImportPreview<ClientImportRow>;
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
  const deniedCreate = enforcePermission(input.actorRoleKey, 'office.clients.create');
  if (deniedCreate) return deniedCreate;
  const deniedCsv = enforcePermission(input.actorRoleKey, 'tenant.settings.csv.import.clients');
  if (deniedCsv) return deniedCsv;
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  const logCreated = await createImportLog({
    tenantId: input.tenantId,
    userId: input.userId,
    importType: 'clients',
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
    const shouldSkip =
      row.isDuplicate ||
      !row.isValid ||
      (input.validRowsOnly && !row.isValid);

    if (row.isDuplicate || (!row.isValid && input.validRowsOnly)) {
      skipped += 1;
      continue;
    }

    if (!row.isValid && !input.validRowsOnly) {
      skipped += 1;
      continue;
    }

    if (input.importMode !== 'create_only' && input.importMode) {
      skipped += 1;
      continue;
    }

    const result = await insertClientFromCsvRow(input.tenantId, row.data, input.actorProfileId);
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
