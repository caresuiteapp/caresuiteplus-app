import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { getDemoCourseListItems } from '@/data/demo/courses';
import { buildCourseDetailKpis } from '@/lib/akademie/courseDetailStats';
import { fetchCourseDetail } from '@/lib/akademie/courseDetailService';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Akademie Course Detail Hero (Sprint 68)', () => {
  it('CourseDetailHero nutzt PremiumListHeroFrame mit Kurs-KPIs', () => {
    const hero = readSrc('src/components/akademie/CourseDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('buildCourseDetailKpis');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('CourseDetailScreen ersetzt flache PremiumCard-Header durch Hero', () => {
    const screen = readSrc('src/screens/akademie/CourseDetailScreen.tsx');
    expect(screen).toContain('CourseDetailHero');
    expect(screen).not.toContain('{course.nextActionHint}');
    expect(screen).not.toContain('PremiumCard');
    expect(screen).toContain('LockedActionBanner');
  });

  it('buildCourseDetailKpis berechnet Dauer, Teilnehmer und Abschlussquote', async () => {
    const list = getDemoCourseListItems();
    const firstId = list[0]?.id;
    expect(firstId).toBeTruthy();

    const result = await fetchCourseDetail(firstId!, DEMO_TENANT_ID, 'akademie_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const kpis = buildCourseDetailKpis(result.data);
    expect(kpis.some((k) => k.id === 'duration')).toBe(true);
    expect(kpis.some((k) => k.id === 'enrollments')).toBe(true);
    expect(kpis.some((k) => k.id === 'completion')).toBe(true);
  });

  it('courseDetailService nutzt guardServiceTenant ohne service_role', () => {
    const service = readSrc('src/lib/akademie/courseDetailService.ts');
    expect(service).toContain('guardServiceTenant');
    expect(service).not.toContain('service_role');
  });
});
