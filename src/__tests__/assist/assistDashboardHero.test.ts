import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildAssistDashboardKpis } from '@/lib/assist/assistDashboardStats';
import {
  buildAssistDashboardCheckpoints,
  buildAssistDashboardSystemStatus,
} from '@/lib/assist/assistDashboardSystemStatus';
import { isAssistExtensionLiveReady } from '@/lib/assist/assistModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const SAMPLE_STATS = {
  totalAssignments: 30,
  todayCount: 5,
  activeCount: 3,
  inProgressCount: 2,
  completedTodayCount: 1,
  upcomingCount: 12,
  atRiskCount: 3,
  incompleteCount: 4,
  openProofCount: 2,
  openProofReviewCount: 2,
  openSignatureCount: 1,
  openPortalReleaseCount: 1,
  openTripsCount: 2,
};

describe('Assist Dashboard Hero (UI Reality Fix)', () => {
  it('AssistDashboardHero nutzt SectionPanel statt PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/assist/AssistDashboardHero.tsx');
    expect(hero).toContain('SectionPanel');
    expect(hero).toContain('Kennzahlen');
    expect(hero).toContain('AdaptiveKpiGrid');
    expect(hero).not.toContain('PremiumListHeroFrame');
    expect(hero).not.toContain('Live Fahrtenbuch');
    expect(hero).not.toContain('ROLE_LABELS');
  });

  it('buildAssistDashboardKpis mappt Stats auf Kennzahlen', () => {
    const kpis = buildAssistDashboardKpis(SAMPLE_STATS);
    expect(kpis).toHaveLength(8);
    expect(kpis[0]?.label).toBe('Heute geplant');
    expect(kpis[0]?.value).toBe('5');
    expect(kpis[1]?.label).toBe('Läuft gerade');
    expect(kpis[1]?.value).toBe('5');
    expect(kpis[2]?.label).toBe('Dokumentation offen');
    expect(kpis[3]?.label).toBe('Signatur offen');
    expect(kpis[4]?.label).toBe('Nachweise zu prüfen');
    expect(kpis[5]?.label).toBe('Problemfälle');
    expect(kpis[6]?.label).toBe('Portal-Freigabe offen');
    expect(kpis[7]?.label).toBe('Fahrten offen');
    expect(kpis.find((k) => k.label === 'Unvollständig')).toBeUndefined();
    expect(kpis.find((k) => k.label.includes('TRACKING'))).toBeUndefined();
    expect(kpis[5]?.navigationTarget).toBe('/assist/qualitaet');
    expect(kpis.every((k) => k.variant === 'light')).toBe(true);
  });

  it('Systemstatus und Prüfpunkte sind kompakt modelliert', () => {
    expect(buildAssistDashboardSystemStatus()).toHaveLength(3);
    expect(buildAssistDashboardSystemStatus()[0]?.title).toBe('Speicherung aktiv');
    const open = buildAssistDashboardCheckpoints(SAMPLE_STATS);
    expect(open.length).toBeGreaterThan(0);
    expect(open.some((c) => c.label === 'Dokumentation offen')).toBe(true);
  });

  it('AssistIndexScreen nutzt Modul-Dashboard-Shell', () => {
    const screen = readSrc('src/screens/assist/AssistIndexScreen.tsx');
    expect(screen).toContain('ModuleDashboardShell');
    expect(screen).toContain('AssistDashboardView');
    expect(screen).toContain('Einsatzplanung, Durchführung und Leistungsnachweise');
    expect(screen).toContain('ASSIST_HEADER_PRIMARY_ACTIONS');
    expect(screen).not.toContain('AssistSetupHintsBanner');
    expect(screen).not.toContain('ScreenShell');
    expect(screen).not.toContain('CareLightScreen');
  });

  it('Erweiterungen sind demo-funktional', () => {
    expect(isAssistExtensionLiveReady()).toBe(true);
  });
});
