import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildHandoverReportListKpis } from '@/lib/stationaer/handoverReportStats';
import { buildStationaerReportsKpis } from '@/lib/stationaer/stationaerReportStats';
import { buildStationaerSettingsKpis } from '@/lib/stationaer/stationaerSettingsStats';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Stationär Extension Heroes (Sprint 87)', () => {
  it('StationaerReportsHero nutzt PremiumListHeroFrame mit preparedOnly', () => {
    const hero = readSrc('src/components/stationaer/StationaerReportsHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('isStationaerExtensionLiveReady');
    expect(hero).toContain('buildStationaerReportsKpis');
  });

  it('StationaerSettingsHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/stationaer/StationaerSettingsHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Modul-Einstellungen');
    expect(hero).toContain('buildStationaerSettingsKpis');
  });

  it('HandoverReportListHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/stationaer/HandoverReportListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Übergabeberichte');
    expect(hero).toContain('buildHandoverReportListKpis');
  });

  it('Extension-Screens nutzen neue Heroes statt PreparedModeBanner allein', () => {
    const reports = readSrc('src/screens/stationaer/StationaerReportsScreen.tsx');
    const settings = readSrc('src/screens/stationaer/StationaerSettingsScreen.tsx');
    const handover = readSrc('src/components/stationaer/HandoverReportsListView.tsx');
    expect(reports).toContain('StationaerReportsHero');
    expect(reports).not.toContain('PreparedModeBanner');
    expect(settings).toContain('StationaerSettingsHero');
    expect(settings).not.toContain('PreparedModeBanner');
    expect(handover).toContain('HandoverReportListHero');
    expect(handover).not.toContain('PreparedModeBanner');
  });

  it('buildStationaerReportsKpis liefert Belegung und Übergaben', () => {
    const kpis = buildStationaerReportsKpis({
      occupancyPercent: 85,
      activeResidents: 42,
      handoversThisWeek: 7,
      openRisks: 3,
      newAdmissionsMonth: 2,
    });
    expect(kpis[0]?.value).toBe('85 %');
    expect(kpis[1]?.value).toBe('7');
  });

  it('buildHandoverReportListKpis zählt Berichte', () => {
    const kpis = buildHandoverReportListKpis([
      {
        id: '1',
        tenantId: 't1',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        shiftLabel: 'Früh',
        handoverAt: new Date().toISOString(),
        authorName: 'A',
        wing: 'Nord',
        content: 'Test',
        status: 'aktiv',
        authorProfileId: 'p1',
      },
    ]);
    expect(kpis[0]?.value).toBe('1');
  });

  it('buildStationaerSettingsKpis zählt aktive Optionen', () => {
    const kpis = buildStationaerSettingsKpis({
      occupancyAlerts: true,
      mealPlanningEnabled: false,
      activityPlanningEnabled: true,
      relativeCommunication: false,
      handoverRequired: true,
      riskDocumentation: false,
    });
    expect(kpis[0]?.value).toBe('3');
  });
});

describe('Portal Profile Heroes (Sprint 87)', () => {
  it('PortalEmployeeProfileHero nutzt PremiumListHeroFrame mit preparedOnly', () => {
    const hero = readSrc('src/components/portal/PortalEmployeeProfileHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('isPortalProfileLiveReady');
    expect(hero).toContain('buildEmployeePortalProfileKpis');
  });

  it('PortalClientProfileHero nutzt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/portal/PortalClientProfileHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('buildClientPortalProfileKpis');
  });

  it('Profil-Screens nutzen Profile-Heroes', () => {
    const employee = readSrc('src/screens/portal/EmployeeProfileScreen.tsx');
    const client = readSrc('src/screens/portal/ClientPortalProfileScreen.tsx');
    expect(employee).toContain('PortalEmployeeProfileHero');
    expect(client).toContain('PortalClientProfileHero');
  });

  it('portalModuleConfig exportiert ehrliches isPortalProfileLiveReady', () => {
    const config = readSrc('src/lib/portal/portalModuleConfig.ts');
    expect(config).toContain('isPortalProfileLiveReady');
    expect(config).toContain('return false');
    expect(config).toContain('PORTAL_PROFILE_PREPARED_MESSAGE');
  });
});
