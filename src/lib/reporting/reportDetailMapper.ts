import type { ServiceResult } from '@/types';
import type { DashboardKpi } from '@/types/dashboard';
import type { ReportDetail } from '@/types/reporting';
import {
  mapCompleteReportRow,
  rowDataMissingFields,
  REPORT_LIVE_SELECT_COLUMNS,
  type ReportLiveRow,
} from './reportListMapper';

/** Detail-Spalten aus Migration 0028 — SELECT nur wenn Migration angewendet. */
export const REPORT_DETAIL_SELECT_COLUMNS =
  `${REPORT_LIVE_SELECT_COLUMNS}, summary, kpi_snapshot`;

/** Für Detail zusätzlich erforderliche Schema-Spalten. */
export const REPORT_DETAIL_REQUIRED_FIELDS = ['summary', 'kpi_snapshot'] as const;

export type ReportDetailLiveRow = ReportLiveRow & {
  summary?: string | null;
  kpi_snapshot?: unknown;
};

function schemaMissingDetailFields(row: ReportDetailLiveRow): string[] {
  const missing: string[] = [];
  for (const field of REPORT_DETAIL_REQUIRED_FIELDS) {
    if (row[field] === undefined) {
      missing.push(field);
    }
  }
  return missing;
}

function parseKpiSnapshot(value: unknown): DashboardKpi[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is DashboardKpi =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as DashboardKpi).id === 'string' &&
      typeof (item as DashboardKpi).label === 'string' &&
      typeof (item as DashboardKpi).icon === 'string' &&
      typeof (item as DashboardKpi).accentColor === 'string' &&
      ((item as DashboardKpi).value !== undefined &&
        (typeof (item as DashboardKpi).value === 'string' ||
          typeof (item as DashboardKpi).value === 'number')),
  );
}

function mapCompleteReportDetailRow(row: ReportDetailLiveRow): ReportDetail {
  const listItem = mapCompleteReportRow(row);

  return {
    ...listItem,
    summary: row.summary!.trim(),
    kpiSnapshot: parseKpiSnapshot(row.kpi_snapshot),
  };
}

export function mapReportRowToDetail(
  row: ReportDetailLiveRow,
): ServiceResult<ReportDetail> {
  const schemaMissing = schemaMissingDetailFields(row);
  if (schemaMissing.length > 0) {
    const fields = schemaMissing.join(', ');
    return {
      ok: false,
      error: `Live-Berichtdetail: Supabase-Schema unvollständig (${fields} fehlen). Migration für reporting_reports erweitern.`,
    };
  }

  const listMissing = rowDataMissingFields(row);
  if (listMissing.length > 0) {
    const fields = listMissing.join(', ');
    return {
      ok: false,
      error: `Live-Berichtdetail: Pflichtfelder fehlen (${fields}).`,
    };
  }

  if (!row.summary?.trim()) {
    return {
      ok: false,
      error: 'Live-Berichtdetail: Zusammenfassung fehlt (summary).',
    };
  }

  return { ok: true, data: mapCompleteReportDetailRow(row) };
}
