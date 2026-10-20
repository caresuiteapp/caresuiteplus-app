import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getPermissionsForRole } from '@/lib/permissions/staticRolePermissions';
import {
  CONNECT_CATEGORY_ROADMAP,
  assertRoadmapIsDisplayOnly,
  compareRoadmapPriority,
  doesRoadmapEnableFeatures,
  getConnectAdminRoadmapEntries,
  getConnectAdminRoadmapEntriesByPhase,
  getConnectCategories,
  getConnectCategoryRoadmap,
  getConnectIntegrationRoadmap,
  getConnectUserFacingComingSoonText,
  getCriticalComplianceRoadmapEntries,
  getHighestPriorityPhase1Integrations,
  isConnectIntegrationExecutable,
  canActivateConnectIntegration,
} from '@/lib/connect';
import { getConnectUserDisplayHint } from '@/lib/connect/connectPresentation';

const ADMIN = 'business_admin' as const;
const MANAGER = 'business_manager' as const;

describe('Connect Roadmap', () => {
  it('Roadmap aktiviert keine Features automatisch', () => {
    expect(doesRoadmapEnableFeatures()).toBe(false);
    assertRoadmapIsDisplayOnly(getConnectCategories());
  });

  it('Phase-1-Einträge haben höhere Priorität als Phase-2/3', () => {
    const phase1 = getConnectAdminRoadmapEntriesByPhase(1);
    const phase2 = getConnectAdminRoadmapEntriesByPhase(2);
    const phase3 = getConnectAdminRoadmapEntriesByPhase(3);
    expect(phase1.length).toBeGreaterThan(0);
    expect(phase2.length).toBeGreaterThan(0);
    expect(phase3.length).toBeGreaterThan(0);

    const topPhase1 = phase1[0]!;
    const topPhase2 = phase2[0]!;
    expect(compareRoadmapPriority(topPhase1, topPhase2)).toBeLessThan(0);

    const billing = getConnectCategoryRoadmap('billing')!;
    const tiKim = getConnectCategoryRoadmap('ti_kim')!;
    expect(compareRoadmapPriority(billing, tiKim)).toBeLessThan(0);
  });

  it('Kostenträgerdateien und ICD-10-GM sind Phase-1-Prioritäten', () => {
    const kostentraeger = getConnectIntegrationRoadmap('billing', 'kostentraegerdateien')!;
    const icd10 = getConnectIntegrationRoadmap('medical_data', 'icd10_gm')!;
    expect(kostentraeger.phase).toBe(1);
    expect(icd10.phase).toBe(1);
    expect(kostentraeger.priority).toBeLessThan(20);
    expect(icd10.priority).toBeLessThan(30);

    const topPhase1 = getHighestPriorityPhase1Integrations();
    const keys = topPhase1.map((entry) => `${entry.categoryKey}.${entry.integrationKey}`);
    expect(keys).toContain('billing.kostentraegerdateien');
    expect(kostentraeger.priority).toBeLessThan(icd10.priority);
  });

  it('DATEV, Stripe und GoCardless sind Phase 1', () => {
    expect(getConnectIntegrationRoadmap('accounting', 'datev')?.phase).toBe(1);
    expect(getConnectIntegrationRoadmap('payments', 'stripe')?.phase).toBe(1);
    expect(getConnectIntegrationRoadmap('payments', 'gocardless')?.phase).toBe(1);
    expect(getConnectIntegrationRoadmap('payments', 'mollie')?.phase).toBe(1);
  });

  it('TI/KIM und ePA sind Phase 2 mit kritischem Risiko', () => {
    const kim = getConnectIntegrationRoadmap('ti_kim', 'kim')!;
    const epa = getConnectIntegrationRoadmap('ti_kim', 'epa')!;
    expect(kim.phase).toBe(2);
    expect(epa.phase).toBe(2);
    expect(kim.compliance_risk).toBe('critical');
    expect(epa.compliance_risk).toBe('critical');

    const critical = getCriticalComplianceRoadmapEntries();
    expect(critical.some((entry) => entry.integrationKey === 'epa')).toBe(true);
  });

  it('Marktplatz-Kategorie ist Phase 3', () => {
    expect(getConnectCategoryRoadmap('marketplace')?.phase).toBe(3);
  });

  it('alle 11 Katalog-Kategorien haben Roadmap-Metadaten', () => {
    for (const category of getConnectCategories()) {
      expect(CONNECT_CATEGORY_ROADMAP[category.key]).toBeDefined();
      expect(getConnectCategoryRoadmap(category.key)?.next_step.length).toBeGreaterThan(10);
    }
  });

  it('Admin-Roadmap ist nach Priorität sortiert', () => {
    const entries = getConnectAdminRoadmapEntries();
    for (let index = 1; index < entries.length; index += 1) {
      const prev = entries[index - 1]!;
      const current = entries[index]!;
      expect(prev.priority).toBeLessThanOrEqual(current.priority);
    }
  });

  it('Endnutzer-Hinweise sind ehrlich und ohne Admin-Details', () => {
    const stripeText = getConnectUserFacingComingSoonText(
      'payments',
      getConnectCategories()
        .find((c) => c.key === 'payments')!
        .integrations.find((i) => i.key === 'stripe')!,
    );
    expect(stripeText).not.toContain('Sandbox-Key');
    expect(stripeText).not.toMatch(/live/i);
    expect(stripeText).toContain('produktiv');

    const epaText = getConnectUserFacingComingSoonText(
      'ti_kim',
      getConnectCategories()
        .find((c) => c.key === 'ti_kim')!
        .integrations.find((i) => i.key === 'epa')!,
    );
    expect(epaText).toMatch(/reguliert|rechtlich|nicht produktiv/i);
  });

  it('getConnectUserDisplayHint liefert sichere Texte für Manager', () => {
    const integration = getConnectCategories()
      .find((c) => c.key === 'payments')!
      .integrations.find((i) => i.key === 'stripe')!;
    const hint = getConnectUserDisplayHint('payments', integration!);
    expect(hint).not.toContain('next_step');
    expect(hint.length).toBeGreaterThan(20);
  });

  it('coming_soon Integrationen bleiben nicht ausführbar', () => {
    const comingSoon = getConnectCategories().flatMap((c) =>
      c.integrations.filter((i) => i.readiness === 'coming_soon'),
    );
    for (const integration of comingSoon) {
      expect(isConnectIntegrationExecutable(integration)).toBe(false);
      expect(canActivateConnectIntegration(integration, true)).toBe(false);
    }
  });

  it('Roadmap verändert catalog readiness nicht', () => {
    for (const category of getConnectCategories()) {
      for (const integration of category.integrations) {
        const roadmap = getConnectIntegrationRoadmap(category.key, integration.key);
        if (roadmap?.release_status === 'live') {
          expect(integration.readiness).toBe('beta');
        }
        if (integration.readiness === 'coming_soon') {
          expect(roadmap?.release_status).not.toBe('live');
        }
      }
    }
  });

  it('ConnectRoadmapPanel nur im Admin-Hub eingebunden', () => {
    const hubSource = fs.readFileSync(
      path.join(process.cwd(), 'src/screens/connect/ConnectHubScreen.tsx'),
      'utf8',
    );
    expect(hubSource).toContain('ConnectRoadmapPanel');
    expect(hubSource).toContain("can('connect.configure')");

    const panelSource = fs.readFileSync(
      path.join(process.cwd(), 'src/components/connect/ConnectRoadmapPanel.tsx'),
      'utf8',
    );
    expect(panelSource).toContain('Nächster Schritt');
    expect(panelSource).toContain('keine automatische Freischaltung');
  });

  it('Normale Nutzer sehen userHint statt Admin-Badge in ProviderListRow', () => {
    const rowSource = fs.readFileSync(
      path.join(process.cwd(), 'src/components/connect/ConnectProviderListRow.tsx'),
      'utf8',
    );
    expect(rowSource).toContain('getConnectUserDisplayHint');
    expect(rowSource).toContain('canConfigure ?');
    expect(rowSource).toContain('userHint');
  });

  it('connect.configure nur für business_admin', () => {
    expect(getPermissionsForRole(ADMIN)).toContain('connect.configure');
    expect(getPermissionsForRole(MANAGER)).not.toContain('connect.configure');
  });
});
