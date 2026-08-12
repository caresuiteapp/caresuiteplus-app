import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { getDemoSisAssessments } from '@/data/demo/sisAssessments';
import { getDemoWoundDocumentations } from '@/data/demo/woundDocumentations';
import { buildPflegeDashboardKpis } from '@/lib/pflege/pflegeDashboardStats';
import { emptyPflegeDashboardStats } from '@/types/modules/pflege';
import { buildSisListKpis } from '@/lib/pflege/sisListStats';
import { buildPflegeReportKpis } from '@/lib/pflege/pflegeReportStats';
import { buildMedicationListKpis } from '@/lib/pflege/medicationListStats';
import { buildWoundDocumentationListKpis } from '@/lib/pflege/woundDocumentationListStats';
import { fetchWoundDocumentationList } from '@/lib/pflege/woundDocumentationService';
import { fetchPflegeReportStats } from '@/lib/pflege/moduleExtensionService';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Pflege Premium Heroes Batch (Sprint 75)', () => {
  it('PflegeDashboardHero nutzt PremiumListHeroFrame mit Dashboard-KPIs', () => {
    const hero = readSrc('src/components/pflege/PflegeDashboardHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('buildPflegeDashboardKpis');
  });

  it('PflegeIndexScreen nutzt Pflege workspace dashboard', () => {
    const screen = readSrc('src/screens/pflege/PflegeIndexScreen.tsx');
    const workspace = readSrc('src/lib/pflege/pflegeDashboardWorkspace.ts');
    expect(screen).toContain('ModuleDashboardShell');
    expect(screen).toContain('PflegeDashboardView');
    expect(screen).not.toContain('CareLightModuleDashboard');
    expect(screen).not.toContain('Bewohner:innen');
    expect(screen).toContain('PFLEGE_HEADER_SECONDARY_ACTIONS');
    expect(workspace).toContain("route: '/pflege/plans'");
  });

  it('buildPflegeDashboardKpis berechnet 12 Pflege-KPIs', () => {
    const kpis = buildPflegeDashboardKpis({
      ...emptyPflegeDashboardStats(),
      totalPlans: 8,
      activePlansCount: 5,
      dueVitalsCount: 2,
      alertsCount: 1,
      visitsToday: 3,
      runningNow: 1,
      dueMeasuresCount: 2,
      openDocumentationCount: 1,
      abnormalVitalsCount: 1,
      openMedicationCount: 1,
      openWoundDocsCount: 1,
      openHandoversCount: 1,
      openSisAssessmentCount: 1,
      openReportsCount: 1,
      assignedClientsCount: 3,
    });
    expect(kpis).toHaveLength(12);
    expect(kpis.some((k) => k.id === 'pflege-ws-kpi-active-plans')).toBe(true);
    expect(kpis.some((k) => k.id === 'pflege-ws-kpi-due-vitals')).toBe(true);
    expect(kpis.some((k) => k.id === 'pflege-ws-kpi-reports')).toBe(true);
  });

  it('SIS-Übersicht nutzt die zentrale Assessment-Liste', () => {
    const hero = readSrc('src/components/pflege/SisOverviewHero.tsx');
    const screen = readSrc('src/screens/pflege/SisOverviewScreen.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Teilweise live');
    expect(screen).toContain('CareAssessmentListScreen');
    expect(readSrc('src/screens/careAssessment/CareAssessmentListScreen.tsx')).toContain('fetchCareAssessments');
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

  it('Medikation nutzt ausschließlich den Live-Service und Wunddokumentation den Mandantenschutz', async () => {
    const woundResult = await fetchWoundDocumentationList(DEMO_TENANT_ID, 'nurse');
    expect(woundResult.ok).toBe(true);

    const medService = readSrc('src/lib/pflege/medicationListService.ts');
    const woundService = readSrc('src/lib/pflege/woundDocumentationService.ts');
    expect(medService).toContain('guardServiceTenant');
    expect(medService).toContain('fetchLiveMedicationList');
    expect(medService).not.toContain('getDemoMedicationListItems');
    expect(woundService).toContain('guardServiceTenant');
    expect(medService).not.toContain('service_role');
  });

  it('MedicationListHero kennzeichnet Live-Daten und Wunddokumentation die externe Anbindung', () => {
    const medHero = readSrc('src/components/pflege/MedicationListHero.tsx');
    const woundHero = readSrc('src/components/pflege/WoundDocumentationListHero.tsx');
    expect(medHero).toContain('Live-Daten');
    expect(woundHero).toMatch(/BodyMap|extern/i);
  });

  it('buildMedicationListKpis und buildWoundDocumentationListKpis liefern Kennzahlen', () => {
    const medKpis = buildMedicationListKpis([{ id: '1', tenantId: 't', clientId: 'c', clientName: 'Test', medicationName: 'Ramipril', activeIngredient: 'Ramipril', strength: '5 mg', form: 'Tablette', dosage: '1 Tablette', schedule: '1-0-0-0', route: 'oral', status: 'active', isPrn: false, isHighAlert: false, isControlledSubstance: false, intensiveCareRelevant: false, prescribedBy: 'Dr. Test', startDate: null, endDate: null, updatedAt: new Date().toISOString() }]);
    const woundKpis = buildWoundDocumentationListKpis(getDemoWoundDocumentations());
    expect(medKpis.some((k) => k.id === 'active')).toBe(true);
    expect(woundKpis.some((k) => k.id === 'open')).toBe(true);
  });

  it('Pflege Medikation und Wunddokumentation Routen existieren', () => {
    expect(readSrc('app/pflege/medikation/index.tsx')).toContain('MedicationListScreen');
    expect(readSrc('app/pflege/wunddokumentation/index.tsx')).toContain('WoundDocumentationListScreen');
  });
});
