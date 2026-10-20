import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Akademie Dashboard Hero (Sprint 76)', () => {
  it('AkademieDashboardHero nutzt PremiumListHeroFrame mit KPIs', () => {
    const hero = readSrc('src/components/akademie/AkademieDashboardHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Schulungen & Zertifikate');
    expect(hero).toContain('AdaptiveKpiGrid');
  });

  it('buildAkademieDashboardKpis mappt Stats ehrlich', () => {
    const statsModule = readSrc('src/lib/akademie/akademieDashboardStats.ts');
    expect(statsModule).toContain('activeCoursesCount');
    expect(statsModule).toContain('mandatoryCount');
    expect(statsModule).toContain('totalEnrollments');
  });

  it('AkademieIndexScreen nutzt ModuleDashboardShell (Lern-Cockpit)', () => {
    const screen = readSrc('src/screens/akademie/AkademieIndexScreen.tsx');
    expect(screen).toContain('ModuleDashboardShell');
    expect(screen).toContain('AkademieDashboardView');
    expect(screen).toContain('InfoBanner');
    expect(screen).not.toContain('CareLightModuleDashboard');
    expect(screen).not.toContain('StatTile');
  });

  it('AkademieIndexScreen zeigt Vorschaudaten bei fehlender Live-Tabelle', () => {
    const screen = readSrc('src/screens/akademie/AkademieIndexScreen.tsx');
    expect(screen).toContain('isPreviewData');
    expect(screen).toContain('PREVIEW_DATA_BANNER_MESSAGE');
  });

  it('Erweiterungen sind demo-funktional', () => {
    const config = readSrc('src/lib/akademie/akademieModuleConfig.ts');
    expect(config).toContain('isAkademieExtensionLiveReady');
    expect(config).toContain('return true');
  });
});
