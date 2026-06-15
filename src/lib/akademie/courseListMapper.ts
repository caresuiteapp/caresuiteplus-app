import type { ServiceResult } from '@/types';
import type { WorkflowStatus } from '@/types/core/base';
import type { CourseListItem } from '@/types/modules/akademie';

/** Felder, die für vollständige Live-Listen-Mappings erforderlich sind. */
export const COURSE_LIVE_REQUIRED_FIELDS = [
  'category',
  'duration_minutes',
  'is_mandatory',
  'starts_at',
  'enrollment_count',
] as const;

/** Spalten aus Migration 0007 (Basis). */
export const COURSE_BASE_SELECT_COLUMNS =
  'id, tenant_id, title, catalog_type, status, created_at, updated_at';

/** Live-Spalten aus Migration 0025 — SELECT nur wenn Migration angewendet. */
export const COURSE_LIVE_SELECT_COLUMNS =
  `${COURSE_BASE_SELECT_COLUMNS}, category, duration_minutes, is_mandatory, starts_at, enrollment_count`;

export type CourseLiveRow = {
  id: string;
  tenant_id: string;
  title: string;
  catalog_type: string;
  status: string;
  category?: string | null;
  duration_minutes?: number | null;
  is_mandatory?: boolean | null;
  starts_at?: string | null;
  enrollment_count?: number | null;
  created_at: string;
  updated_at: string;
};

function schemaMissingFields(rows: CourseLiveRow[]): string[] {
  const missing = new Set<string>();
  for (const row of rows) {
    for (const field of COURSE_LIVE_REQUIRED_FIELDS) {
      if (row[field] === undefined) {
        missing.add(field);
      }
    }
  }
  return [...missing].sort();
}

export function rowDataMissingFields(row: CourseLiveRow): string[] {
  const missing: string[] = [];
  if (!row.category?.trim()) missing.push('category');
  if (row.duration_minutes == null || row.duration_minutes <= 0) {
    missing.push('duration_minutes');
  }
  if (row.is_mandatory === undefined || row.is_mandatory === null) {
    missing.push('is_mandatory');
  }
  if (!row.starts_at?.trim()) missing.push('starts_at');
  if (row.enrollment_count === undefined || row.enrollment_count === null) {
    missing.push('enrollment_count');
  }
  return missing;
}

export function mapCompleteCourseRow(row: CourseLiveRow): CourseListItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title.trim(),
    category: row.category!.trim(),
    durationMinutes: Number(row.duration_minutes),
    isMandatory: Boolean(row.is_mandatory),
    status: row.status as WorkflowStatus,
    startsAt: row.starts_at!,
    updatedAt: row.updated_at,
    enrollmentCount: Number(row.enrollment_count),
  };
}

export function mapCourseRowsToListItems(
  rows: CourseLiveRow[],
): ServiceResult<CourseListItem[]> {
  if (rows.length === 0) {
    return { ok: true, data: [] };
  }

  const schemaMissing = schemaMissingFields(rows);
  if (schemaMissing.length > 0) {
    const fields = schemaMissing.join(', ');
    return {
      ok: false,
      error: `Live-Kursliste: Supabase-Schema unvollständig (${fields} fehlen). Migration für catalogs erweitern.`,
    };
  }

  const data = rows
    .filter((row) => rowDataMissingFields(row).length === 0)
    .map(mapCompleteCourseRow);

  return { ok: true, data };
}
