import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { getDemoMedicationListItems } from '@/data/demo/medications';
import { getDemoSisAssessments } from '@/data/demo/sisAssessments';
import { getDemoWoundDocumentations } from '@/data/demo/woundDocumentations';
import { buildPflegeDashboardKpis } from '@/lib/pflege/pflegeDashboardStats';
import { buildSisListKpis } from '@/lib/pflege/sisListStats';
import { buildPflegeReportKpis } from '@/lib/pflege/pflegeReportStats';
import { buildMedicationListKpis } from '@/lib/pflege/medicationListStats';
import { buildWoundDocumentationListKpis } from '@/lib/pflege/woundDocumentationListStats';
import { fetchMedicationList } from '@/lib/pflege/medicationListService';
import { fetchWoundDocumentationList } from '@/lib/pflege/woundDocumentationService';
import { fetchPflegeReportStats } from '@/lib/pflege/moduleExtensionService';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Pflege Premium Heroes Batch (Sprint 75)', () => {
  it('PflegeDashboardHero nutzt PremiumListHeroFrame mit Dashboard-KPIs', () => {
    const hero = readSrc('src/components/pflege/PflegeDashboardHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('PFLEGE · DASHBOARD');
    expect(hero).toContain('buildPflegeDashboardKpis');
  });

  it('PflegeIndexScreen nutzt CareLight premium dashboard', () => {
    const screen = readSrc('src/screens/pflege/PflegeIndexScreen.tsx');
    expect(screen).toContain('CareLightModuleDashboard');
    expect(screen).toContain('CareLightCarePlanCard');
    expect(screen).not.toContain('StatTile');
    expect(screen).toContain('/pflege/medikation');
    expect(screen).toContain('/pflege/wunddokumentation');
  });

  it('buildPflegeDashboardKpis berechnet Pläne, Vitalwerte und Hinweise', () => {
    const kpis = buildPflegeDashboardKpis({
      totalPlans: 8,
      activePlansCount: 5,
      dueVitalsCount: 2,
      alertsCount: 1,
    });
    expect(kpis.some((k) => k.id === 'active-plans')).toBe(true);
    expect(kpis.some((k) => k.id === 'due-vitals')).toBe(true);
    expect(kpis.some((k) => k.id === 'open-reports')).toBe(true);
    expect(kpis.some((k) => k.id === 'alerts')).toBe(true);
  });

  it('SisOverviewHero und Screen nutzen PremiumListHeroFrame', () => {
    const hero = readSrc('src/components/pflege/SisOverviewHero.tsx');
    const screen = readSrc('src/screens/pflege/SisOverviewScreen.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Teilweise live');
    expect(screen).toContain('SisOverviewHero');
    expect(screen).not.toContain('PremiumCard style={styles.header}');
  });

  it('buildSisListKpis berechnet Assessments und Prüffristen', () => {
    const items = getDemoSisAssessments();
    const kpis = buildSisListKpis(items);
    expect(kpis.some((k) => k.id === 'total')).toBe(true);
    expect(kpis.some((k) => k.id === 'due')).toBe(true);
  });

  it('PflegeReportsHero und SettingsHero nutzen PremiumListHeroFrame', () => {
    const reports = readSrc('src/components/pflege/PflegeReportsHero.tsx');
    const settings = readSrc('src/components/pflege/PflegeSettingsHero.tsx');
    expect(reports).toContain('PremiumListHeroFrame');
    expect(reports).toContain('MDK extern');
    expect(settings).toContain('PremiumListHeroFrame');
    expect(settings).toContain('Teilweise live');
  });

  it('buildPflegeReportKpis deckt MDK und Wundfälle ab', async () => {
    const result = await fetchPflegeReportStats(DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const kpis = buildPflegeReportKpis(result.data);
    expect(kpis.some((k) => k.id === 'mdk')).toBe(true);
    expect(kpis.some((k) => k.id === 'wounds')).toBe(true);
  });

  it('Medikation und Wunddokumentation Services nutzen guardServiceTenant', async () => {
    const medResult = await fetchMedicationList(DEMO_TENANT_ID, 'nurse');
    const woundResult = await fetchWoundDocumentationList(DEMO_TENANT_ID, 'nurse');
    expect(medResult.ok).toBe(true);
    expect(woundResult.ok).toBe(true);

    const medService = readSrc('src/lib/pflege/medicationListService.ts');
    const woundService = readSrc('src/lib/pflege/woundDocumentationService.ts');
    expect(medService).toContain('guardServiceTenant');
    expect(woundService).toContain('guardServiceTenant');
    expect(medService).not.toContain('service_role');
  });

  it('MedicationListHero und WoundDocumentationListHero haben externe Anbindungs-Badges', () => {
    const medHero = readSrc('src/components/pflege/MedicationListHero.tsx');
    const woundHero = readSrc('src/components/pflege/WoundDocumentationListHero.tsx');
    expect(medHero).toContain('eMP extern');
    expect(woundHero).toMatch(/BodyMap|extern/i);
  });

  it('buildMedicationListKpis und buildWoundDocumentationListKpis liefern Kennzahlen', () => {
    const medKpis = buildMedicationListKpis(getDemoMedicationListItems());
    const woundKpis = buildWoundDocumentationListKpis(getDemoWoundDocumentations());
    expect(medKpis.some((k) => k.id === 'active')).toBe(true);
    expect(woundKpis.some((k) => k.id === 'open')).toBe(true);
  });

  it('Pflege Medikation und Wunddokumentation Routen existieren', () => {
    expect(readSrc('app/pflege/medikation/index.tsx')).toContain('MedicationListScreen');
    expect(readSrc('app/pflege/wunddokumentation/index.tsx')).toContain('WoundDocumentationListScreen');
  });
});
