import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildLivingAreasListKpis } from '@/lib/stationaer/livingAreasStats';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('LivingAreas List Hero (Sprint 78)', () => {
  it('LivingAreasListHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/stationaer/LivingAreasListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Wohnbereiche & Zimmer');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('buildLivingAreasListKpis berechnet Belegung ehrlich', () => {
    const kpis = buildLivingAreasListKpis([
      {
        id: '1',
        name: 'A',
        wing: 'Nord',
        capacity: 10,
        occupiedBeds: 8,
        freeBeds: 2,
        status: 'aktiv',
      },
      {
        id: '2',
        name: 'B',
        wing: 'Süd',
        capacity: 10,
        occupiedBeds: 5,
        freeBeds: 5,
        status: 'aktiv',
      },
    ]);
    expect(kpis[0]?.value).toBe('2');
    expect(kpis[1]?.value).toBe('13');
    expect(kpis[2]?.value).toBe('7');
  });

  it('LivingAreasListView nutzt Hero und InfoBanner statt PreparedModeBanner allein', () => {
    const listView = readSrc('src/components/stationaer/LivingAreasListView.tsx');
    expect(listView).toContain('LivingAreasListHero');
    expect(listView).toContain('InfoBanner');
    expect(listView).not.toContain('PreparedModeBanner');
    expect(readSrc('src/screens/stationaer/LivingAreasScreen.tsx')).toContain('LivingAreasListView');
  });
});
