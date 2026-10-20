import type { ServiceResult } from '@/types';
import type { WorkflowStatus } from '@/types/core/base';
import type { ReportCategory, ReportListItem } from '@/types/reporting';

const VALID_CATEGORIES: ReportCategory[] = ['pdl', 'quality', 'finance', 'operations'];

/** Spalten aus Migration 0027 (Basis-Listen-Tabelle). */
export const REPORT_BASE_SELECT_COLUMNS =
  'id, tenant_id, title, category, period, status, created_at, updated_at';

/** Live-Listen-Spalten — identisch mit Basis nach Migration 0027. */
export const REPORT_LIVE_SELECT_COLUMNS = REPORT_BASE_SELECT_COLUMNS;

export type ReportLiveRow = {
  id: string;
  tenant_id: string;
  title: string;
  category?: string | null;
  period?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function isValidCategory(value: string): value is ReportCategory {
  return VALID_CATEGORIES.includes(value as ReportCategory);
}

export function rowDataMissingFields(row: ReportLiveRow): string[] {
  const missing: string[] = [];
  if (!row.title?.trim()) missing.push('title');
  if (!row.category?.trim() || !isValidCategory(row.category.trim())) {
    missing.push('category');
  }
  if (!row.period?.trim()) missing.push('period');
  if (!row.status?.trim()) missing.push('status');
  return missing;
}

export function mapCompleteReportRow(row: ReportLiveRow): ReportListItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title.trim(),
    category: row.category!.trim() as ReportCategory,
    period: row.period!.trim(),
    status: row.status as WorkflowStatus,
    updatedAt: row.updated_at,
  };
}

export function mapReportRowsToListItems(
  rows: ReportLiveRow[],
): ServiceResult<ReportListItem[]> {
  if (rows.length === 0) {
    return { ok: true, data: [] };
  }

  const data = rows
    .filter((row) => rowDataMissingFields(row).length === 0)
    .map(mapCompleteReportRow);

  return { ok: true, data };
}
