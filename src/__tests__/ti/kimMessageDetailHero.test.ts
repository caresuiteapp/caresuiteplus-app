import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isTILiveReady } from '@/lib/ti/tiModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('KIM Message Detail Hero (Sprint 86)', () => {
  it('KIMMessageDetailHero nutzt PremiumListHeroFrame mit KIM-KPIs', () => {
    const hero = readSrc('src/components/ti/KIMMessageDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('BUSINESS · KIM-NACHRICHT');
    expect(hero).toContain('buildKimMessageDetailKpis');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('KIMMessageDetailHero zeigt ehrliches TI preparedOnly-Badge', () => {
    const hero = readSrc('src/components/ti/KIMMessageDetailHero.tsx');
    expect(hero).toContain('isTILiveReady');
    expect(hero).toContain('TI in Vorbereitung');
    expect(isTILiveReady()).toBe(false);
  });

  it('KIMMessageDetailScreen nutzt Hero und InfoBanner', () => {
    const screen = readSrc('src/screens/ti/KIMMessageDetailScreen.tsx');
    expect(screen).toContain('KIMMessageDetailHero');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('TI_PREPARED_MESSAGE');
  });

  it('buildKimMessageDetailKpis liefert Empfangen, Anhänge und Import offen', () => {
    const stats = readSrc('src/lib/ti/kimMessageDetailStats.ts');
    expect(stats).toContain('buildKimMessageDetailKpis');
    expect(stats).toContain('Anhänge');
    expect(stats).toContain('Import offen');
  });

  it('ResidentDetailHero zeigt ehrliches Live-Badge', () => {
    const hero = readSrc('src/components/stationaer/ResidentDetailHero.tsx');
    expect(hero).toContain('isStationaerResidentsLiveReady');
    expect(hero).toContain('Demo / preparedOnly');
  });

  it('CourseDetailHero zeigt ehrliches Live-Badge', () => {
    const hero = readSrc('src/components/akademie/CourseDetailHero.tsx');
    expect(hero).toContain('isAkademieCoursesLiveReady');
    expect(hero).toContain('Demo / preparedOnly');
  });
});
