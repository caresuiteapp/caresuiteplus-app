import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Office Dashboard Hero + AdaptiveModuleDashboard (Sprint 96)', () => {
  it('OfficeDashboardHero nutzt PremiumListHeroFrame und isOfficeDashboardLiveReady', () => {
    const hero = readSrc('src/components/office/OfficeDashboardHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('isOfficeDashboardLiveReady');
    expect(hero).toContain('AdaptiveKpiGrid');
  });

  it('OfficeIndexScreen nutzt ModuleDashboardShell mit ActionToolbar', () => {
    const screen = readSrc('src/screens/office/OfficeIndexScreen.tsx');
    expect(screen).toContain('ModuleDashboardShell');
    expect(screen).toContain('ActionToolbar');
    expect(screen).toContain('useOfficeDashboard');
    expect(screen).not.toContain('AdaptiveModuleDashboard');
    expect(screen).not.toContain('OfficeDashboardHero');
  });

  it('officeModuleConfig exportiert preparedOnly-Hinweis', () => {
    const config = readSrc('src/lib/office/officeModuleConfig.ts');
    expect(config).toContain('isOfficeDashboardLiveReady');
    expect(config).toContain('OFFICE_DASHBOARD_PREPARED_MESSAGE');
  });
});
