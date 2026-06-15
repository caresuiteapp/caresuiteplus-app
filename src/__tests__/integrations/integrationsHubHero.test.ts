import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildIntegrationListKpis } from '@/lib/integrations/integrationListStats';
import { getDemoIntegrations } from '@/data/demo/integrations';
import { isIntegrationsLiveReady } from '@/lib/integrations/integrationsModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Integrations Hub Hero (Sprint 62)', () => {
  it('IntegrationsHubHero nutzt PremiumListHeroFrame mit Provider-KPIs', () => {
    const hero = readSrc('src/components/integrations/IntegrationsHubHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Anbieter & Schnittstellen');
    expect(hero).toContain('buildIntegrationListKpis');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('IntegrationsHubHero zeigt ehrliches preparedOnly-Badge', () => {
    const hero = readSrc('src/components/integrations/IntegrationsHubHero.tsx');
    const config = readSrc('src/lib/integrations/integrationsModuleConfig.ts');
    expect(config).toContain('isIntegrationsLiveReady');
    expect(hero).toContain('isIntegrationsLiveReady');
    expect(hero).toContain('Live-Sync in Vorbereitung');
    expect(isIntegrationsLiveReady()).toBe(false);
  });

  it('IntegrationsListScreen nutzt Hero und InfoBanner', () => {
    const screen = readSrc('src/screens/integrations/IntegrationsListScreen.tsx');
    expect(screen).toContain('IntegrationsHubHero');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('INTEGRATIONS_PREPARED_MESSAGE');
    expect(screen).toContain('LockedActionBanner');
  });

  it('buildIntegrationListKpis berechnet Kennzahlen aus Demo-Providern', () => {
    const items = getDemoIntegrations();
    const kpis = buildIntegrationListKpis(items);
    expect(kpis.length).toBe(4);
    expect(kpis.some((k) => k.id === 'active')).toBe(true);
    expect(kpis.some((k) => k.id === 'pending')).toBe(true);
  });

  it('Integration-Service bleibt Demo-only ohne service_role', () => {
    const service = readSrc('src/lib/integrations/integrationService.ts');
    expect(service).toContain('getDemoIntegrations');
    expect(service).not.toContain('service_role');
  });
});
