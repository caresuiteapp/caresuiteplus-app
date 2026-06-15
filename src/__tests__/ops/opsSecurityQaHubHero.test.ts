import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildOpsHubKpis } from '@/lib/ops/opsHubStats';
import { isOpsLiveReady } from '@/lib/ops/opsModuleConfig';
import { isQaLiveReady } from '@/lib/qa/qaModuleConfig';
import { isSecurityLiveReady } from '@/lib/security/securityModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Security Hub Hero (Sprint 65)', () => {
  it('SecurityHubHero nutzt PremiumListHeroFrame mit Security-KPIs', () => {
    const hero = readSrc('src/components/security/SecurityHubHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Security & DSGVO');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('SecurityHubHero zeigt ehrliches preparedOnly-Badge', () => {
    const hero = readSrc('src/components/security/SecurityHubHero.tsx');
    const config = readSrc('src/lib/security/securityModuleConfig.ts');
    expect(config).toContain('isSecurityLiveReady');
    expect(hero).toContain('isSecurityLiveReady');
    expect(hero).toContain('Live-Monitoring in Vorbereitung');
    expect(isSecurityLiveReady()).toBe(false);
  });

  it('SecurityHubScreen nutzt Hero und InfoBanner', () => {
    const screen = readSrc('src/screens/security/SecurityHubScreen.tsx');
    expect(screen).toContain('SecurityHubHero');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('SECURITY_PREPARED_MESSAGE');
    expect(screen).not.toContain('service_role');
  });
});

describe('QA Hub Hero (Sprint 65)', () => {
  it('QaHubHero nutzt PremiumListHeroFrame mit QA-KPIs', () => {
    const hero = readSrc('src/components/qa/QaHubHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('QA & Pilotbetrieb');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('QaHubHero zeigt ehrliches preparedOnly-Badge', () => {
    const hero = readSrc('src/components/qa/QaHubHero.tsx');
    const config = readSrc('src/lib/qa/qaModuleConfig.ts');
    expect(config).toContain('isQaLiveReady');
    expect(hero).toContain('isQaLiveReady');
    expect(hero).toContain('Live-Triage in Vorbereitung');
    expect(isQaLiveReady()).toBe(false);
  });

  it('QaHubScreen nutzt Hero und InfoBanner', () => {
    const screen = readSrc('src/screens/qa/QaHubScreen.tsx');
    expect(screen).toContain('QaHubHero');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('QA_PREPARED_MESSAGE');
    expect(screen).not.toContain('service_role');
  });
});

describe('Ops Hub Hero (Sprint 65)', () => {
  it('OpsHubHero nutzt PremiumListHeroFrame mit Ops-KPIs', () => {
    const hero = readSrc('src/components/ops/OpsHubHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Operations-Hub');
    expect(hero).toContain('buildOpsHubKpis');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('OpsHubHero zeigt ehrliches preparedOnly-Badge', () => {
    const hero = readSrc('src/components/ops/OpsHubHero.tsx');
    const config = readSrc('src/lib/ops/opsModuleConfig.ts');
    expect(config).toContain('isOpsLiveReady');
    expect(hero).toContain('isOpsLiveReady');
    expect(hero).toContain('Live-Orchestrierung in Vorbereitung');
    expect(isOpsLiveReady()).toBe(false);
  });

  it('OpsHubScreen nutzt Hero und InfoBanner', () => {
    const screen = readSrc('src/screens/ops/OpsHubScreen.tsx');
    expect(screen).toContain('OpsHubHero');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('OPS_PREPARED_MESSAGE');
    expect(screen).toContain('OPS_HUB_MODULES');
    expect(screen).not.toContain('service_role');
  });

  it('buildOpsHubKpis berechnet Kennzahlen aus Ops-Modulen', () => {
    const kpis = buildOpsHubKpis();
    expect(kpis.length).toBe(3);
    expect(kpis.some((k) => k.id === 'modules')).toBe(true);
    expect(kpis.some((k) => k.id === 'pilot')).toBe(true);
  });
});
