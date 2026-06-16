import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { buildModuleHubKpis } from '@/lib/modules/moduleHubStats';
import {
  calculateBillingItems,
  getEffectiveModuleAccess,
  initializeModuleAccessStore,
  resetModuleAccessStore,
} from '@/lib/modules';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Business Module Hub Hero (Sprint 63)', () => {
  it('BusinessModuleHubHero nutzt PremiumListHeroFrame mit Modul-KPIs', () => {
    const hero = readSrc('src/components/modules/BusinessModuleHubHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Module aktivieren');
    expect(hero).toContain('buildModuleHubKpis');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('BusinessModuleHubHero zeigt keine Preise', () => {
    const hero = readSrc('src/components/modules/BusinessModuleHubHero.tsx');
    expect(hero).not.toMatch(/€/);
    expect(hero.toLowerCase()).not.toContain('kostenlos');
  });

  it('ModuleOverviewScreen nutzt Hero, ModuleCard und PremiumPreparedNotice', () => {
    const screen = readSrc('src/screens/ModuleOverviewScreen.tsx');
    expect(screen).toContain('BusinessModuleHubHero');
    expect(screen).toContain('ModuleCard');
    expect(screen).toContain('PremiumPreparedNotice');
    expect(screen).toContain('/business/office/access/module-permissions');
  });

  it('ModuleCard zeigt Aktivieren / Modul öffnen', () => {
    const card = readSrc('src/components/modules/ModuleCard.tsx');
    expect(card).toContain('Aktivieren');
    expect(card).toContain('Modul öffnen');
    expect(card).not.toMatch(/Kaufen/i);
  });

  it('buildModuleHubKpis berechnet Kennzahlen aus Demo-Modulen', () => {
    resetModuleAccessStore();
    initializeModuleAccessStore(DEMO_TENANT_ID);
    const modules = getEffectiveModuleAccess(DEMO_TENANT_ID);
    const billing = calculateBillingItems(DEMO_TENANT_ID);
    const kpis = buildModuleHubKpis(modules, billing);
    expect(kpis.length).toBe(4);
    expect(kpis.some((k) => k.id === 'active')).toBe(true);
    expect(kpis.some((k) => k.id === 'free')).toBe(true);
  });

  it('UserModulePermissionsScreen zeigt ehrliche Demo-Vorschau', () => {
    const screen = readSrc('src/screens/office/access/UserModulePermissionsScreen.tsx');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('Demo-Vorschau');
    expect(screen).not.toContain('service_role');
  });
});
