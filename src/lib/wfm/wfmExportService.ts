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

export type WfmExportRow = {
  workDate: string;
  employeeId: string;
  status: string;
  statusLabel: string;
  grossMinutes: number;
  netMinutes: number;
  pauseMinutes: number;
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

function simpleChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash * 31 + content.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export async function exportWfmSessionsCsv(
  tenantId: string,
  actorRoleKey: RoleKey | null,
  year: number,
  month: number,
): Promise<ServiceResult<{ csv: string; rowCount: number; checksum: string }>> {
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

  const csv = buildCsv(rows);
  return { ok: true, data: { csv, rowCount: rows.length, checksum: simpleChecksum(csv) } };
}

export async function createWfmExportJob(
  tenantId: string,
  userId: string,
  actorRoleKey: RoleKey | null,
  year: number,
  month: number,
  format: 'csv' | 'pdf' = 'csv',
): Promise<ServiceResult<{ jobId: string; csv: string; rowCount: number; checksum: string }>> {
  const exportResult = await exportWfmSessionsCsv(tenantId, actorRoleKey, year, month);
  if (!exportResult.ok) return exportResult;

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
        row_count: exportResult.data.rowCount,
        checksum: exportResult.data.checksum,
        completed_at: new Date().toISOString(),
      });
      if (error && !isSupabaseMissingTableError(error)) {
        return { ok: false, error: toGermanSupabaseError(error) };
      }
    }
  }

  return {
    ok: true,
    data: {
      jobId,
      csv: exportResult.data.csv,
      rowCount: exportResult.data.rowCount,
      checksum: exportResult.data.checksum,
    },
  };
}

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
    '',
    'PDF-Generierung wird in einer späteren Version ergänzt.',
    'Bitte verwenden Sie vorerst den CSV-Export.',
  ].join('\n');
}
