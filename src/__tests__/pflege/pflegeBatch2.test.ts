import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { getDemoShiftScheduleListItems } from '@/lib/pflege/shiftScheduleDemo';
import { getDemoMedicationDetail } from '@/lib/pflege/medicationDetailStats';
import { getDemoWoundDocumentationDetail } from '@/lib/pflege/woundDocumentationDetailStats';
import { buildShiftScheduleListKpis } from '@/lib/pflege/shiftScheduleListStats';
import { buildCareDocumentationListKpis } from '@/lib/pflege/careDocumentationListStats';
import { buildMedicationDetailKpis } from '@/lib/pflege/medicationDetailStats';
import { buildWoundDocumentationDetailKpis } from '@/lib/pflege/woundDocumentationDetailStats';
import { fetchShiftScheduleList } from '@/lib/pflege/shiftScheduleService';
import { fetchCareDocumentationList } from '@/lib/pflege/careDocumentationListService';
import { fetchMedicationDetail } from '@/lib/pflege/medicationDetailService';
import { fetchWoundDocumentationDetail } from '@/lib/pflege/woundDocumentationDetailService';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Pflege Sprint Batch 2 (Sprint 76)', () => {
  it('VitalReadingsListHero und View nutzen DesktopListViewToggle', () => {
    const hero = readSrc('src/components/pflege/VitalReadingsListHero.tsx');
    const view = readSrc('src/components/pflege/VitalReadingsListView.tsx');
    expect(hero).toContain('DesktopListViewToggle');
    expect(view).toContain('useDesktopListViewPreference');
    expect(view).toContain('VitalReadingsListTable');
    expect(view).toContain("useDesktopListViewPreference('pflege.vitals')");
  });

  it('CarePlansListHero und View nutzen DesktopListViewToggle', () => {
    const hero = readSrc('src/components/pflege/CarePlansListHero.tsx');
    const view = readSrc('src/components/pflege/CarePlansListView.tsx');
    expect(hero).toContain('DesktopListViewToggle');
    expect(view).toContain('CarePlansListTable');
    expect(view).toContain("useDesktopListViewPreference('pflege.plans')");
    expect(hero).toContain('isCarePlansLiveReady');
  });

  it('VitalReadingsListTable nutzt PremiumDataTable', () => {
    const source = readSrc('src/components/pflege/VitalReadingsListTable.tsx');
    expect(source).toContain('PremiumDataTable');
    expect(source).toContain('Messart');
  });

  it('ShiftScheduleListHero nutzt PremiumListHeroFrame mit Import-extern Badge', () => {
    const hero = readSrc('src/components/pflege/ShiftScheduleListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('Import extern');
    expect(readSrc('app/pflege/dienstplaene/index.tsx')).toContain('ShiftScheduleListScreen');
  });

  it('fetchShiftScheduleList liefert Demo-Schichten mit guardServiceTenant', async () => {
    const result = await fetchShiftScheduleList(DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.length).toBeGreaterThan(0);
    expect(readSrc('src/lib/pflege/shiftScheduleService.ts')).toContain('guardServiceTenant');
  });

  it('buildShiftScheduleListKpis berechnet Schicht-Kennzahlen', () => {
    const kpis = buildShiftScheduleListKpis(getDemoShiftScheduleListItems());
    expect(kpis.some((k) => k.id === 'active')).toBe(true);
  });

  it('CareDocumentationListHero und Service nutzen care_records Live-Basis', async () => {
    const hero = readSrc('src/components/pflege/CareDocumentationListHero.tsx');
    const service = readSrc('src/lib/pflege/careDocumentationListService.ts');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(service).toContain('careRecordSupabaseRepository');
    expect(service).toContain('guardServiceTenant');

    const result = await fetchCareDocumentationList(DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const kpis = buildCareDocumentationListKpis(result.data);
      expect(kpis.some((k) => k.id === 'signed')).toBe(true);
    }
  });

  it('Pflegedokumentation Route existiert', () => {
    expect(readSrc('app/pflege/dokumentation/index.tsx')).toContain('CareDocumentationListScreen');
    expect(readSrc('src/screens/pflege/PflegeIndexScreen.tsx')).toContain('/pflege/dokumentation');
  });

  it('MedicationDetailHero und Service sind preparedOnly', async () => {
    const hero = readSrc('src/components/pflege/MedicationDetailHero.tsx');
    expect(hero).toContain('eMP extern');
    expect(readSrc('app/pflege/medikation/[id]/index.tsx')).toContain('MedicationDetailScreen');

    const result = await fetchMedicationDetail('med-001', DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const kpis = buildMedicationDetailKpis(result.data);
      expect(kpis.some((k) => k.id === 'dosage')).toBe(true);
    }
    expect(getDemoMedicationDetail('med-001')?.medicationName).toBe('Ramipril');
  });

  it('WoundDocumentationDetailHero und Service sind preparedOnly', async () => {
    const hero = readSrc('src/components/pflege/WoundDocumentationDetailHero.tsx');
    expect(hero).toContain('BodyMap extern');
    expect(readSrc('app/pflege/wunddokumentation/[id]/index.tsx')).toContain(
      'WoundDocumentationDetailScreen',
    );

    const result = await fetchWoundDocumentationDetail('wound-001', DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const kpis = buildWoundDocumentationDetailKpis(result.data);
      expect(kpis.some((k) => k.id === 'location')).toBe(true);
    }
    expect(getDemoWoundDocumentationDetail('wound-001')?.bodyLocation).toBe('Unterschenkel links');
  });

  it('Medikation und Wund Listen navigieren zu Detail-Routen', () => {
    expect(readSrc('src/screens/pflege/MedicationListScreen.tsx')).toContain('/pflege/medikation/');
    expect(readSrc('src/screens/pflege/WoundDocumentationListScreen.tsx')).toContain(
      '/pflege/wunddokumentation/',
    );
  });

  it('pflegeModuleConfig exportiert Live-Readiness für Pläne und Dokumentation', () => {
    const config = readSrc('src/lib/pflege/pflegeModuleConfig.ts');
    expect(config).toContain('isCarePlansLiveReady');
    expect(config).toContain('isCareDocumentationLiveReady');
    expect(config).toContain('isVitalReadingsLiveReady');
    expect(config).toContain('SHIFT_SCHEDULE_PREPARED_MESSAGE');
  });
});
