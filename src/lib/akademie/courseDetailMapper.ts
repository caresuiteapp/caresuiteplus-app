import type { ServiceResult } from '@/types';
import type { WorkflowStatus } from '@/types/core/base';
import type { CourseDetail } from '@/types/modules/akademie';
import { CLIENT_STATUS_HINTS } from '@/lib/services';
import {
  mapCompleteCourseRow,
  rowDataMissingFields,
  COURSE_LIVE_REQUIRED_FIELDS,
  COURSE_LIVE_SELECT_COLUMNS,
  type CourseLiveRow,
} from './courseListMapper';

/** Detail-Spalten aus Migration 0026 — SELECT nur wenn Migration angewendet. */
export const COURSE_DETAIL_SELECT_COLUMNS =
  `${COURSE_LIVE_SELECT_COLUMNS}, description, ends_at, instructor_name, completion_rate_percent`;

/** Für Detail zusätzlich erforderliche Schema-Spalten. */
export const COURSE_DETAIL_REQUIRED_FIELDS = [
  'description',
  'instructor_name',
  'completion_rate_percent',
] as const;

export type CourseDetailLiveRow = CourseLiveRow & {
  description?: string | null;
  ends_at?: string | null;
  instructor_name?: string | null;
  completion_rate_percent?: number | null;
};

function schemaMissingDetailFields(row: CourseDetailLiveRow): string[] {
  const missing: string[] = [];
  for (const field of COURSE_DETAIL_REQUIRED_FIELDS) {
    if (row[field] === undefined) {
      missing.push(field);
    }
  }
  return missing;
}

function mapCompleteCourseDetailRow(row: CourseDetailLiveRow): CourseDetail {
  const listItem = mapCompleteCourseRow(row);

  return {
    ...listItem,
    description: row.description?.trim() || null,
    endsAt: row.ends_at?.trim() || null,
    enrollmentCount: listItem.enrollmentCount,
    completionRatePercent: Number(row.completion_rate_percent ?? 0),
    instructorName: row.instructor_name!.trim(),
    nextActionHint: CLIENT_STATUS_HINTS[row.status as WorkflowStatus],
    createdAt: row.created_at,
  };
}

export function mapCourseRowToDetail(
  row: CourseDetailLiveRow,
): ServiceResult<CourseDetail> {
  const schemaMissing = schemaMissingDetailFields(row);
  if (schemaMissing.length > 0) {
    const fields = schemaMissing.join(', ');
    return {
      ok: false,
      error: `Live-Kursdetail: Supabase-Schema unvollständig (${fields} fehlen). Migration für catalogs erweitern.`,
    };
  }

  for (const field of COURSE_LIVE_REQUIRED_FIELDS) {
    if (row[field] === undefined) {
      return {
        ok: false,
        error: `Live-Kursdetail: Supabase-Schema unvollständig (${field} fehlen). Migration für catalogs erweitern.`,
      };
    }
  }

  const listMissing = rowDataMissingFields(row);
  if (listMissing.length > 0) {
    const fields = listMissing.join(', ');
    return {
      ok: false,
      error: `Live-Kursdetail: Pflichtfelder fehlen (${fields}).`,
    };
  }

  if (!row.instructor_name?.trim()) {
    return {
      ok: false,
      error: 'Live-Kursdetail: Dozent:in fehlt (instructor_name).',
    };
  }

  return { ok: true, data: mapCompleteCourseDetailRow(row) };
}
