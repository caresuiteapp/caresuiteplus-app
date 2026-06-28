import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { formatWfmStatusLabel } from './wfmClockService';
import { listSessionsForDate } from './wfmWorkSessionRepository';

export type WfmExportFormat = 'csv' | 'pdf' | 'datev';

export type WfmExportRow = {
  workDate: string;
  employeeId: string;
  status: string;
  statusLabel: string;
  grossMinutes: number;
  netMinutes: number;
  pauseMinutes: number;
};

export type WfmExportResult = {
  jobId: string;
  format: WfmExportFormat;
  content: string;
  mimeType: string;
  fileName: string;
  rowCount: number;
  checksum: string;
};

function buildCsv(rows: WfmExportRow[]): string {
  const header = 'Datum;Mitarbeiter-ID;Status;Status-Text;Brutto-Min;Netto-Min;Pause-Min';
  const body = rows
    .map(
      (r) =>
        `${r.workDate};${r.employeeId};${r.status};${r.statusLabel};${r.grossMinutes};${r.netMinutes};${r.pauseMinutes}`,
    )
    .join('\n');
  return `${header}\n${body}`;
}

/**
 * DATEV LOHN & Gehalt — minimales EXTF-kompatibles ASCII-Format.
 * Felder: PersonalNr (= employeeId-Kurzform), Datum (TTMMJJJJ), Stunden (Dezimal).
 */
function buildDatev(rows: WfmExportRow[], year: number, month: number): string {
  const periodLabel = `${String(month).padStart(2, '0')}${year}`;
  const header = [
    '"EXTF";700;21;"LOHN";"CareSuite+ WFM";"";"";"";"";""',
    `"BeraterNr";"MandantNr";"PersonalNr";"Datum";"StundenArt";"Stunden";"PauseMin"`,
  ].join('\r\n');

  const body = rows
    .map((r) => {
      const [y, m, d] = r.workDate.split('-');
      const datevDate = `${d}${m}${y}`;
      const hours = (r.netMinutes / 60).toFixed(2).replace('.', ',');
      const personalNr = r.employeeId.slice(0, 8).toUpperCase();
      const stundenArt = r.status === 'homeoffice' ? 'HO' : r.status === 'office' ? 'BU' : 'AZ';
      return `"1001";"1";"${personalNr}";"${datevDate}";"${stundenArt}";"${hours}";"${r.pauseMinutes}"`;
    })
    .join('\r\n');

  return `${header}\r\n${body}\r\n;Zeitraum ${periodLabel};Datensätze ${rows.length}`;
}

function simpleChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash * 31 + content.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

async function collectExportRows(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  year: number,
  month: number,
): Promise<ServiceResult<WfmExportRow[]>> {
  const denied = enforcePermission(actorRoleKey, 'time.tracking.admin.export');
  if (denied) return denied;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const daysInMonth = new Date(year, month, 0).getDate();
  const rows: WfmExportRow[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const workDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const sessionsResult = await listSessionsForDate(tenantId, workDate);
    if (!sessionsResult.ok) continue;
    for (const session of sessionsResult.data) {
      rows.push({
        workDate,
        employeeId: session.employeeId,
        status: session.status,
        statusLabel: formatWfmStatusLabel(session),
        grossMinutes: session.grossMinutes,
        netMinutes: session.netMinutes,
        pauseMinutes: session.pauseMinutes,
      });
    }
  }

  return { ok: true, data: rows };
}

export async function exportWfmSessionsCsv(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  year: number,
  month: number,
): Promise<ServiceResult<{ csv: string; rowCount: number; checksum: string }>> {
  const rowsResult = await collectExportRows(tenantId, actorRoleKey, year, month);
  if (!rowsResult.ok) return rowsResult;
  const csv = buildCsv(rowsResult.data);
  return { ok: true, data: { csv, rowCount: rowsResult.data.length, checksum: simpleChecksum(csv) } };
}

export async function exportWfmSessionsDatev(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  year: number,
  month: number,
): Promise<ServiceResult<{ datev: string; rowCount: number; checksum: string }>> {
  const rowsResult = await collectExportRows(tenantId, actorRoleKey, year, month);
  if (!rowsResult.ok) return rowsResult;
  const datev = buildDatev(rowsResult.data, year, month);
  return { ok: true, data: { datev, rowCount: rowsResult.data.length, checksum: simpleChecksum(datev) } };
}

async function renderWfmPdfText(rows: WfmExportRow[], year: number, month: number, tenantId: string): Promise<string> {
  if (typeof document === 'undefined') {
    const { buildWfmPdfPlainText } = await import('./wfmPdfWeb');
    return buildWfmPdfPlainText(rows, year, month, tenantId);
  }

  try {
    const { renderWfmPdfDataUri, buildWfmPdfPlainText } = await import('./wfmPdfWeb');
    return await renderWfmPdfDataUri(rows, year, month, tenantId);
  } catch {
    const { buildWfmPdfPlainText } = await import('./wfmPdfWeb');
    return buildWfmPdfPlainText(rows, year, month, tenantId);
  }
}

export async function exportWfmSessionsPdf(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  year: number,
  month: number,
): Promise<ServiceResult<{ pdf: string; rowCount: number; checksum: string }>> {
  const rowsResult = await collectExportRows(tenantId, actorRoleKey, year, month);
  if (!rowsResult.ok) return rowsResult;
  const pdf = await renderWfmPdfText(rowsResult.data, year, month, tenantId);
  return { ok: true, data: { pdf, rowCount: rowsResult.data.length, checksum: simpleChecksum(pdf) } };
}

/** @deprecated Nutzen Sie exportWfmSessionsPdf */
export function buildWfmPdfStub(
  tenantId: string,
  year: number,
  month: number,
  rowCount: number,
): string {
  return [
    'CareSuite+ Arbeitszeit-Export',
    `Mandant: ${tenantId}`,
    `Zeitraum: ${String(month).padStart(2, '0')}/${year}`,
    `Datensätze: ${rowCount}`,
  ].join('\n');
}

export async function createWfmExportJob(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  year: number,
  month: number,
  format: WfmExportFormat = 'csv',
): Promise<ServiceResult<WfmExportResult>> {
  let content = '';
  let rowCount = 0;
  let checksum = '';
  let mimeType = 'text/csv';
  let fileName = `arbeitszeit-${year}-${String(month).padStart(2, '0')}.csv`;

  if (format === 'csv') {
    const exportResult = await exportWfmSessionsCsv(tenantId, actorRoleKey, year, month);
    if (!exportResult.ok) return exportResult;
    content = exportResult.data.csv;
    rowCount = exportResult.data.rowCount;
    checksum = exportResult.data.checksum;
  } else if (format === 'datev') {
    const exportResult = await exportWfmSessionsDatev(tenantId, actorRoleKey, year, month);
    if (!exportResult.ok) return exportResult;
    content = exportResult.data.datev;
    rowCount = exportResult.data.rowCount;
    checksum = exportResult.data.checksum;
    mimeType = 'text/plain';
    fileName = `datev-lohn-${year}-${String(month).padStart(2, '0')}.csv`;
  } else {
    const exportResult = await exportWfmSessionsPdf(tenantId, actorRoleKey, year, month);
    if (!exportResult.ok) return exportResult;
    content = exportResult.data.pdf;
    rowCount = exportResult.data.rowCount;
    checksum = exportResult.data.checksum;
    mimeType = content.startsWith('data:application/pdf') ? 'application/pdf' : 'text/plain';
    fileName = `arbeitszeit-${year}-${String(month).padStart(2, '0')}.pdf`;
  }

  const jobId =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `export-${Date.now()}`;

  if (getServiceMode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await fromUnknownTable(supabase, 'workforce_export_jobs').insert({
        id: jobId,
        tenant_id: tenantId,
        requested_by: userId,
        export_format: format,
        period_year: year,
        period_month: month,
        status: 'completed',
        row_count: rowCount,
        checksum,
        completed_at: new Date().toISOString(),
      });
      if (error && !isSupabaseMissingTableError(error)) {
        return { ok: false, error: toGermanSupabaseError(error) };
      }
    }
  }

  return {
    ok: true,
    data: { jobId, format, content, mimeType, fileName, rowCount, checksum },
  };
}
