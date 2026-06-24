import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { getDemoResidentListItems } from '@/data/demo/residents';
import { buildResidentDetailKpis } from '@/lib/stationaer/residentDetailStats';
import { fetchResidentDetail } from '@/lib/stationaer/residentDetailService';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Stationär Resident Detail Hero (Sprint 66)', () => {
  it('ResidentDetailHero nutzt PremiumListHeroFrame mit Bewohner-KPIs', () => {
    const hero = readSrc('src/components/stationaer/ResidentDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('buildResidentDetailKpis');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('ResidentDetailScreen ersetzt flache PremiumCard durch Hero', () => {
    const screen = readSrc('src/screens/stationaer/ResidentDetailScreen.tsx');
    expect(screen).toContain('ResidentDetailHero');
    expect(screen).not.toContain('PremiumCard');
    expect(screen).toContain('InactiveModuleBanner');
  });

  it('buildResidentDetailKpis berechnet Aufenthalt, Zimmer und Pflegegrad', async () => {
    const list = getDemoResidentListItems();
    const firstId = list[0]?.id;
    expect(firstId).toBeTruthy();

    const result = await fetchResidentDetail(firstId!, DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const kpis = buildResidentDetailKpis(result.data);
    expect(kpis.some((k) => k.id === 'stay-days')).toBe(true);
    expect(kpis.some((k) => k.id === 'room')).toBe(true);
    expect(kpis.some((k) => k.id === 'care-level')).toBe(true);
  });

  it('residentDetailService nutzt guardServiceTenant ohne service_role', () => {
    const service = readSrc('src/lib/stationaer/residentDetailService.ts');
    expect(service).toContain('guardServiceTenant');
    expect(service).not.toContain('service_role');
  });
});
