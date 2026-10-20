import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isPdlCockpitLiveReady } from '@/lib/reporting/reportingModuleConfig';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('PDL-Cockpit Hero (Sprint 91)', () => {
  it('PdlCockpitHero nutzt PremiumListHeroFrame mit Live-Badge', () => {
    const hero = readSrc('src/components/reporting/PdlCockpitHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('PDL-Cockpit');
    expect(hero).toContain('isPdlCockpitLiveReady');
    expect(hero).toContain('AdaptiveKpiGrid');
  });

  it('PdlCockpitScreen nutzt PdlCockpitHero statt inline KPI-Grid', () => {
    const screen = readSrc('src/screens/reporting/PdlCockpitScreen.tsx');
    expect(screen).toContain('PdlCockpitHero');
    expect(screen).not.toContain('PremiumKpiCard');
    expect(screen).toContain('PDL_COCKPIT_PREPARED_MESSAGE');
  });

  it('isPdlCockpitLiveReady folgt Service-Mode', () => {
    expect(typeof isPdlCockpitLiveReady()).toBe('boolean');
  });
});
