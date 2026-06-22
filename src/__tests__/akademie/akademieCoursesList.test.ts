import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildCourseListKpis } from '@/lib/akademie/courseListStats';
import { getDemoCourseListItems } from '@/data/demo/courses';
import { fetchCourseList } from '@/lib/akademie/courseListService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';
import { COURSE_SORT_OPTIONS, COURSE_STATUS_FILTERS } from '@/hooks/useCourseList';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Akademie Kurse list', () => {
  it('enforcePermission schützt Course-List-Service', () => {
    expect(enforcePermission(null, 'akademie.courses.view' as never)).not.toBeNull();
  });

  it('fetchCourseList liefert Demo-Kurse', async () => {
    const result = await fetchCourseList(DEMO_TENANT_ID, 'akademie_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.title).toBeTruthy();
    }
  });

  it('buildCourseListKpis berechnet Kennzahlen aus Demo-Daten', () => {
    const items = getDemoCourseListItems();
    const kpis = buildCourseListKpis(items);
    expect(kpis.length).toBe(3);
    expect(kpis.some((k) => k.id === 'courses-kpi-active')).toBe(true);
  });

  it('Status- und Sortierfilter sind vollständig definiert', () => {
    expect(COURSE_STATUS_FILTERS.some((f) => f.key === 'aktiv')).toBe(true);
    expect(COURSE_SORT_OPTIONS.some((o) => o.key === 'title_asc')).toBe(true);
  });

  it('CoursesListView hat Suche, Filter und States', () => {
    const source = readSrc('src/components/akademie/CoursesListView.tsx');
    expect(source).toContain('PremiumInput');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('EmptyState');
    expect(source).not.toContain('Coming Soon');
  });

  it('CoursesAdaptiveScreen nutzt MasterDetailLayout mit Summary-Panel', () => {
    const source = readSrc('src/screens/akademie/CoursesAdaptiveScreen.tsx');
    expect(source).toContain('MasterDetailLayout');
    expect(source).toContain('CourseDetailSummaryPanel');
  });

  it('CourseListCard unterstützt Auswahlzustand für Master-Detail', () => {
    const source = readSrc('src/components/akademie/CourseListCard.tsx');
    expect(source).toContain('selected');
    expect(source).toContain('cardSelected');
  });

  it('courseListService nutzt guardServiceTenant und Live-Repo', () => {
    const source = readSrc('src/lib/akademie/courseListService.ts');
    expect(source).toContain('guardServiceTenant');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('akademieSupabaseRepository');
    expect(source).toContain('listMapped');
    expect(source).not.toContain('blockDemoOnlyInLiveMode');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
  });

  it('courseDetailService nutzt guardServiceTenant und Live-Repo', () => {
    const source = readSrc('src/lib/akademie/courseDetailService.ts');
    expect(source).toContain('guardServiceTenant');
    expect(source).toContain('getDetailMapped');
  });

  it('Kurse-Tab nutzt CoursesAdaptiveScreen', () => {
    const source = readSrc('app/akademie/(tabs)/courses.tsx');
    expect(source).toContain('CoursesAdaptiveScreen');
  });

  it('CoursesListView nutzt Desktop-Tabellenansicht ab desktop breakpoint', () => {
    const source = readSrc('src/components/akademie/CoursesListView.tsx');
    expect(source).toContain('useDeviceClass');
    expect(source).toContain('isDesktopClass');
    expect(source).toContain('CoursesListTable');
  });

  it('CoursesListTable hat Spalten Titel, Status, Kategorie, Dauer, Teilnehmende, Start, Aktionen', () => {
    const source = readSrc('src/components/akademie/CoursesListTable.tsx');
    expect(source).toContain("label: 'Titel'");
    expect(source).toContain("label: 'Status'");
    expect(source).toContain("label: 'Kategorie'");
    expect(source).toContain("label: 'Dauer'");
    expect(source).toContain("label: 'Teilnehmende'");
    expect(source).toContain("label: 'Start'");
    expect(source).toContain("label: 'Aktionen'");
    expect(source).toContain('PremiumDataTable');
  });

  it('CoursesListTable nutzt sortierbare Spalten', () => {
    const source = readSrc('src/components/akademie/CoursesListTable.tsx');
    expect(source).toContain('sortable: true');
    expect(source).toContain('onSortColumn');
  });
});
