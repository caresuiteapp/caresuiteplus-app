import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isIntegrationsLiveReady } from '@/lib/integrations/integrationsModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Integration Detail Hero (Sprint 86)', () => {
  it('IntegrationDetailHero nutzt PremiumListHeroFrame mit Provider-KPIs', () => {
    const hero = readSrc('src/components/integrations/IntegrationDetailHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('BUSINESS · INTEGRATION');
    expect(hero).toContain('buildIntegrationDetailKpis');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('IntegrationDetailHero zeigt ehrliches preparedOnly-Badge', () => {
    const hero = readSrc('src/components/integrations/IntegrationDetailHero.tsx');
    expect(hero).toContain('isIntegrationsLiveReady');
    expect(hero).toContain('Live-Sync in Vorbereitung');
    expect(isIntegrationsLiveReady()).toBe(false);
  });

  it('IntegrationDetailScreen nutzt Hero und InfoBanner', () => {
    const screen = readSrc('src/screens/integrations/IntegrationDetailScreen.tsx');
    expect(screen).toContain('IntegrationDetailHero');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('INTEGRATIONS_PREPARED_MESSAGE');
  });

  it('buildIntegrationDetailKpis liefert Vault, Webhook und Sync', () => {
    const stats = readSrc('src/lib/integrations/integrationDetailStats.ts');
    expect(stats).toContain('buildIntegrationDetailKpis');
    expect(stats).toContain('Vault');
    expect(stats).toContain('Letzter Sync');
  });
});
