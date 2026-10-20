import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildCaseDetailKpis } from '@/lib/beratung/caseDetailStats';
import { getDemoCounselingCaseListItems } from '@/data/demo/counselingCases';
import { fetchCounselingCaseDetail } from '@/lib/beratung/caseDetailService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Beratung Case Detail Hero (Sprint 61)', () => {
  it('CaseDetailHero nutzt PremiumListHeroFrame mit Fall-KPIs', () => {
    const hero = readSrc('src/components/beratung/CaseDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('buildCaseDetailKpis');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('CaseDetailScreen ersetzt flache PremiumCard durch Hero', () => {
    const screen = readSrc('src/screens/beratung/CaseDetailScreen.tsx');
    expect(screen).toContain('CaseDetailHero');
    expect(screen).not.toContain('PremiumCard');
    expect(screen).toContain('LockedActionBanner');
  });

  it('buildCaseDetailKpis berechnet Offen-seit und Termin-KPIs', async () => {
    const list = getDemoCounselingCaseListItems();
    const firstId = list[0]?.id;
    expect(firstId).toBeTruthy();

    const result = await fetchCounselingCaseDetail(firstId!, DEMO_TENANT_ID, 'counselor');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const kpis = buildCaseDetailKpis(result.data);
    expect(kpis.some((k) => k.id === 'days-open')).toBe(true);
    expect(kpis.some((k) => k.id === 'next-appointment')).toBe(true);
    expect(kpis.some((k) => k.id === 'category')).toBe(true);
  });

  it('caseDetailService nutzt guardServiceTenant ohne service_role', () => {
    const service = readSrc('src/lib/beratung/caseDetailService.ts');
    expect(service).toContain('guardServiceTenant');
    expect(service).not.toContain('service_role');
  });
});
