import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildBeratungReportsKpis,
  buildBeratungSettingsKpis,
  buildFollowUpListKpis,
  buildProtocolListKpis,
} from '@/lib/beratung/beratungExtensionStats';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Beratung Extension Heroes (Sprint 89)', () => {
  it('ProtocolsListHero nutzt PremiumListHeroFrame mit preparedOnly', () => {
    const hero = readSrc('src/components/beratung/ProtocolsListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Beratungsprotokolle');
    expect(hero).toContain('isBeratungExtensionLiveReady');
  });

  it('FollowUpsListHero und BeratungReportsHero nutzen PremiumListHeroFrame', () => {
    const followUps = readSrc('src/components/beratung/FollowUpsListHero.tsx');
    const reports = readSrc('src/components/beratung/BeratungReportsHero.tsx');
    const settings = readSrc('src/components/beratung/BeratungSettingsHero.tsx');
    expect(followUps).toContain('Wiedervorlagen');
    expect(reports).toContain('Auswertungen');
    expect(settings).toContain('Modul-Einstellungen');
  });

  it('Extension-Screens nutzen neue Heroes statt PreparedModeBanner', () => {
    expect(readSrc('src/components/beratung/ProtocolsListView.tsx')).toContain('ProtocolsListHero');
    expect(readSrc('src/components/beratung/FollowUpsListView.tsx')).toContain('FollowUpsListHero');
    expect(readSrc('src/screens/beratung/BeratungReportsScreen.tsx')).toContain('BeratungReportsHero');
    expect(readSrc('src/screens/beratung/BeratungSettingsScreen.tsx')).toContain('BeratungSettingsHero');

    expect(readSrc('src/components/beratung/ProtocolsListView.tsx')).not.toContain('PreparedModeBanner');
    expect(readSrc('src/components/beratung/FollowUpsListView.tsx')).not.toContain('PreparedModeBanner');
    expect(readSrc('src/screens/beratung/BeratungReportsScreen.tsx')).not.toContain('PreparedModeBanner');
    expect(readSrc('src/screens/beratung/BeratungSettingsScreen.tsx')).not.toContain('PreparedModeBanner');
  });

  it('buildProtocolListKpis zählt Protokolle', () => {
    const kpis = buildProtocolListKpis([
      {
        id: '1',
        tenantId: 't1',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        caseId: 'c1',
        caseSubject: 'Fall A',
        content: 'Text',
        recordedAt: new Date().toISOString(),
        status: 'aktiv',
        visibility: 'team',
        sensitivity: 'internal',
      },
    ]);
    expect(kpis[0]?.value).toBe('1');
  });

  it('buildFollowUpListKpis zählt Wiedervorlagen', () => {
    const kpis = buildFollowUpListKpis([
      {
        id: '1',
        tenantId: 't1',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        caseId: 'c1',
        caseSubject: 'Fall A',
        dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        assigneeName: 'Berater',
        status: 'aktiv',
        note: null,
      },
    ]);
    expect(kpis[0]?.value).toBe('1');
  });

  it('buildBeratungReportsKpis liefert Kennzahlen', () => {
    const kpis = buildBeratungReportsKpis({
      openCases: 4,
      protocolsThisMonth: 7,
      followUpsDue: 2,
      closedThisMonth: 1,
      avgCaseDurationDays: 12,
    });
    expect(kpis[0]?.value).toBe('4');
    expect(kpis[2]?.value).toBe('12 Tage');
  });

  it('buildBeratungSettingsKpis zählt aktive Optionen', () => {
    const kpis = buildBeratungSettingsKpis({
      protocolsRequired: true,
      followUpReminders: true,
      relativePortalSharing: false,
      careGradeTemplates: true,
      anonymCasesAllowed: false,
    });
    expect(kpis[0]?.value).toBe('3');
  });
});
