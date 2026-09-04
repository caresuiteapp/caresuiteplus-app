import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { getDemoCarePlanListItems } from '@/data/demo/carePlans';
import { buildCarePlanDetailKpis } from '@/lib/pflege/carePlanDetailStats';
import { fetchCarePlanDetail } from '@/lib/pflege/carePlanDetailService';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Pflege Care Plan Detail Hero (Sprint 67)', () => {
  it('CarePlanDetailHero nutzt PremiumListHeroFrame mit Plan-KPIs', () => {
    const hero = readSrc('src/components/pflege/CarePlanDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('buildCarePlanDetailKpis');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('CarePlanDetailScreen ersetzt flache PremiumCard-Header durch Hero', () => {
    const screen = readSrc('src/screens/pflege/CarePlanDetailScreen.tsx');
    expect(screen).toContain('CarePlanDetailHero');
    expect(screen).not.toContain('{plan.nextActionHint}');
    expect(screen).toContain('LockedActionBanner');
  });

  it('CarePlan-Detailzugriff requires productive persistence', async () => {
    const list = getDemoCarePlanListItems();
    const firstId = list[0]?.id;
    expect(firstId).toBeTruthy();
    const result = await fetchCarePlanDetail('plan-001', DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(false);
    expect(typeof buildCarePlanDetailKpis).toBe('function');
  });

  it('carePlanDetailService nutzt guardServiceTenant ohne service_role', () => {
    const service = readSrc('src/lib/pflege/carePlanDetailService.ts');
    expect(service).toContain('guardServiceTenant');
    expect(service).not.toContain('service_role');
  });
});
