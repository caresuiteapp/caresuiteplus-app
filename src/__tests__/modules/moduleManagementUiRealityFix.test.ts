import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { buildModuleHubKpis } from '@/lib/modules/moduleHubStats';
import {
  buildModuleStatusChips,
  resolveModuleActivityStatus,
  resolveModuleCostLabel,
  resolveModuleTypeLabel,
} from '@/lib/modules/moduleManagementLabels';
import {
  getEffectiveModuleAccess,
  initializeModuleAccessStore,
  resetModuleAccessStore,
} from '@/lib/modules/moduleAccessService';
import { calculateBillingItems } from '@/lib/modules/moduleEntitlementService';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Module Management UI Reality Fix', () => {
  it('ModuleOverviewScreen zeigt Titel Module & Lizenzen ohne Free Platform', () => {
    const screen = readSrc('src/screens/ModuleOverviewScreen.tsx');
    expect(screen).toContain('Module & Lizenzen');
    expect(screen).toContain('Module verwalten, freischalten und Mandantenfunktionen steuern');
    expect(screen).not.toContain('Free Platform');
    expect(screen).not.toContain('preparedOnly');
    expect(screen).not.toContain('INTAKE_NEW_ROUTE');
  });

  it('BusinessModuleHubHero nutzt kompakte KPI-Section ohne Gradient-Hero', () => {
    const hero = readSrc('src/components/modules/BusinessModuleHubHero.tsx');
    const stats = readSrc('src/lib/modules/moduleHubStats.ts');
    expect(hero).toContain('SectionPanel');
    expect(hero).toContain('buildModuleHubKpis');
    expect(stats).toContain('Aktive Module');
    expect(stats).toContain('Verfügbare Module');
    expect(stats).toContain('Enthaltene Basismodule');
    expect(stats).toContain('Erweiterungen');
    expect(hero).not.toContain('FREE PLATFORM');
    expect(hero).not.toContain('PremiumListHeroFrame');
  });

  it('ModuleCard zeigt max. drei Status-Chips und Confirm-Flow', () => {
    const card = readSrc('src/components/modules/ModuleCard.tsx');
    expect(card).toContain('buildModuleStatusChips');
    expect(card).toContain('confirmAction');
    expect(card).toContain('Modul öffnen');
    expect(card).toContain('Kostenlos aktivieren');
    expect(card).toContain('Office ist das Basismodul');
    expect(card).toContain('sanitizeUserFacingError');
    expect(card).not.toContain('preparedOnly');
  });

  it('PremiumPreparedNotice zeigt In Vorbereitung statt preparedOnly', () => {
    const notice = readSrc('src/components/billing/PremiumPreparedNotice.tsx');
    expect(notice).toContain('Erweiterungen in Vorbereitung');
    expect(notice).toContain('IN_PREPARATION_LABEL');
    expect(notice).not.toContain('preparedOnly');
  });

  it('Breadcrumb für /business/modules ist Start › Office › Module & Lizenzen', () => {
    const breadcrumbs = readSrc('src/lib/navigation/breadcrumbs.ts');
    expect(breadcrumbs).toContain("normalized === '/business/modules'");
    expect(breadcrumbs).toContain("'Module & Lizenzen'");
    expect(breadcrumbs).toContain("label: 'Office'");
  });

  it('buildModuleHubKpis liefert vier fachliche Kennzahlen', () => {
    resetModuleAccessStore();
    initializeModuleAccessStore(DEMO_TENANT_ID);
    const modules = getEffectiveModuleAccess(DEMO_TENANT_ID);
    const billing = calculateBillingItems(DEMO_TENANT_ID);
    const kpis = buildModuleHubKpis(modules, billing);
    expect(kpis).toHaveLength(4);
    expect(kpis.map((kpi) => kpi.label)).toEqual([
      'Aktive Module',
      'Verfügbare Module',
      'Enthaltene Basismodule',
      'Erweiterungen',
    ]);
  });

  it('Office-Modul-Chips sind Basismodul / Aktiv / Kostenlos enthalten', () => {
    resetModuleAccessStore();
    initializeModuleAccessStore(DEMO_TENANT_ID);
    const office = getEffectiveModuleAccess(DEMO_TENANT_ID).find((module) => module.productKey === 'office');
    expect(office).toBeTruthy();
    if (!office) return;

    expect(resolveModuleTypeLabel(office.productKey)).toBe('Basismodul');
    expect(resolveModuleActivityStatus(office)).toBe('Aktiv');
    expect(resolveModuleCostLabel(office)).toBe('Kostenlos enthalten');
    expect(buildModuleStatusChips(office).map((chip) => chip.label)).toEqual([
      'Aktiv',
      'Basismodul',
      'Kostenlos enthalten',
    ]);
  });

  it('sanitizeUserFacingError entfernt technische Route-Fehler', () => {
    const uiVisibility = readSrc('src/lib/ui/uiVisibility.ts');
    expect(uiVisibility).toContain('sanitizeUserFacingError');
    expect(uiVisibility).toContain('INTAKE_NEW_ROUTE');
  });

  it('clientRoutes exportiert INTAKE_NEW_ROUTE Alias', () => {
    const routes = readSrc('src/lib/navigation/clientRoutes.ts');
    expect(routes).toContain('export const INTAKE_NEW_ROUTE = CLIENT_INTAKE_NEW_ROUTE');
  });
});
