import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mapCourseRowToDetail } from '@/lib/akademie/courseDetailMapper';
import type { CourseDetailLiveRow } from '@/lib/akademie/courseDetailMapper';
import { mapCourseRowsToListItems } from '@/lib/akademie/courseListMapper';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('catalogs live detail mapping', () => {
  const completeRow: CourseDetailLiveRow = {
    id: 'course-001',
    tenant_id: DEMO_TENANT_ID,
    title: 'Hygiene und Infektionsschutz',
    catalog_type: 'course',
    status: 'aktiv',
    category: 'Pflichtschulung',
    duration_minutes: 90,
    is_mandatory: true,
    starts_at: '2026-04-01T09:00:00.000Z',
    enrollment_count: 12,
    description: 'Pflichtschulung gemäß IfSG.',
    ends_at: '2026-07-01T17:00:00.000Z',
    instructor_name: 'Dr. Petra Weber',
    completion_rate_percent: 75,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-06-11T00:00:00.000Z',
  };

  it('Migration 0026 fügt Detail-Felder mit IF NOT EXISTS hinzu', () => {
    const sql = readSrc('supabase/migrations/0026_catalogs_live_detail_fields.sql');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS description');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS ends_at');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS instructor_name');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS completion_rate_percent');
    expect(sql).not.toMatch(/^\s*DROP\b/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
  });

  it('mapCourseRowsToListItems mappt vollständige Zeilen', () => {
    const result = mapCourseRowsToListItems([completeRow]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]?.title).toBe('Hygiene und Infektionsschutz');
      expect(result.data[0]?.enrollmentCount).toBe(12);
    }
  });

  it('mapCourseRowToDetail mappt vollständige Zeile', () => {
    const result = mapCourseRowToDetail(completeRow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.instructorName).toBe('Dr. Petra Weber');
      expect(result.data.completionRatePercent).toBe(75);
      expect(result.data.nextActionHint).toBeTruthy();
    }
  });

  it('mapCourseRowToDetail meldet fehlendes Schema ehrlich', () => {
    const incomplete: CourseDetailLiveRow = {
      ...completeRow,
      instructor_name: undefined,
    };
    const result = mapCourseRowToDetail(incomplete);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Schema unvollständig');
      expect(result.error).toContain('instructor_name');
    }
  });

  it('akademieRepository nutzt COURSE_DETAIL_SELECT_COLUMNS und getDetailMapped', () => {
    const source = readSrc('src/lib/services/repositories/akademieRepository.supabase.ts');
    expect(source).toContain('COURSE_DETAIL_SELECT_COLUMNS');
    expect(source).toContain('getDetailMapped');
    expect(source).toContain("eq('catalog_type', 'course')");
  });

  it('fetchCourseDetail nutzt Supabase-Repo ohne Demo-Fallback in Live-Pfad', () => {
    const source = readSrc('src/lib/akademie/courseDetailService.ts');
    expect(source).toContain('getDetailMapped');
    expect(source).toMatch(
      /fetchCourseDetail[\s\S]*getServiceMode\(\) === 'supabase'[\s\S]*getDetailMapped/,
    );
  });
});
