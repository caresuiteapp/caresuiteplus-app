import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { getDemoSisAssessments } from '@/data/demo/sisAssessments';
import { getDemoVitalReadings } from '@/data/demo/vitalReadings';
import { buildSisDetailKpis } from '@/lib/pflege/sisDetailStats';
import {
  buildVitalReadingId,
  mapVitalSignOverviewRow,
  mapVitalSignOverviewRows,
  parseVitalReadingId,
  type VitalSignOverviewRow,
} from '@/lib/pflege/vitalSignListMapper';
import { mapSisAssessmentRow, type SisAssessmentLiveRow } from '@/lib/pflege/sisListMapper';
import { fetchSisAssessments, fetchSisAssessmentDetail } from '@/lib/pflege/sisListService';
import { fetchVitalReadings } from '@/lib/pflege/vitalService';
import { fetchVitalReadingDetail } from '@/lib/pflege/vitalDetailService';
import {
  isSisLiveReady,
  isVitalReadingsLiveReady,
} from '@/lib/pflege/pflegeModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Pflege Sprint Batch 3 (Sprint 77)', () => {
  it('vitalSignListMapper expandiert v_vital_sign_overview in Messungen', () => {
    const row: VitalSignOverviewRow = {
      id: 'vs-001',
      tenant_id: DEMO_TENANT_ID,
      client_id: 'client-001',
      client_name: 'Maria Hoffmann',
      measured_at: new Date().toISOString(),
      blood_pressure_systolic: 128,
      blood_pressure_diastolic: 82,
      pulse: 72,
      created_at: new Date().toISOString(),
    };

    const items = mapVitalSignOverviewRow(row);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.some((item) => item.type === 'blood_pressure')).toBe(true);

    const parsed = parseVitalReadingId(buildVitalReadingId(row.id, 'pulse'));
    expect(parsed?.baseId).toBe('vs-001');
    expect(parsed?.type).toBe('pulse');
  });

  it('mapVitalSignOverviewRows sortiert nach measuredAt absteigend', () => {
    const older: VitalSignOverviewRow = {
      id: 'vs-old',
      tenant_id: DEMO_TENANT_ID,
      client_id: 'client-001',
      client_name: 'Alt',
      measured_at: '2026-01-01T10:00:00.000Z',
      pulse: 70,
      created_at: '2026-01-01T10:00:00.000Z',
    };
    const newer: VitalSignOverviewRow = {
      id: 'vs-new',
      tenant_id: DEMO_TENANT_ID,
      client_id: 'client-002',
      client_name: 'Neu',
      measured_at: '2026-06-01T10:00:00.000Z',
      pulse: 80,
      created_at: '2026-06-01T10:00:00.000Z',
    };

    const result = mapVitalSignOverviewRows([older, newer]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]?.clientName).toBe('Neu');
    }
  });

  it('vitalService und vitalDetailService nutzen vitalSignSupabaseRepository', () => {
    expect(readSrc('src/lib/pflege/vitalService.ts')).toContain('vitalSignSupabaseRepository');
    expect(readSrc('src/lib/pflege/vitalDetailService.ts')).toContain('vitalSignSupabaseRepository');
    expect(readSrc('src/lib/services/repositories/vitalSignRepository.supabase.ts')).toContain(
      'v_vital_sign_overview',
    );
  });

  it('fetchVitalReadings liefert Demo-Daten mit guardServiceTenant', async () => {
    const result = await fetchVitalReadings(DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.length).toBe(getDemoVitalReadings().length);
  });

  it('sisListMapper mappt assessment_runs auf SisAssessment', () => {
    const row: SisAssessmentLiveRow = {
      id: 'sis-live-001',
      tenant_id: DEMO_TENANT_ID,
      client_id: 'client-001',
      total_score: 68,
      status: 'active',
      completed_at: '2026-05-01T12:00:00.000Z',
      started_at: '2026-05-01T11:00:00.000Z',
      updated_at: '2026-05-01T12:00:00.000Z',
      created_at: '2026-05-01T11:00:00.000Z',
      clients: { first_name: 'Maria', last_name: 'Hoffmann' },
      employees: { first_name: 'Sabine', last_name: 'Keller' },
    };

    const mapped = mapSisAssessmentRow(row);
    expect(mapped.clientName).toBe('Maria Hoffmann');
    expect(mapped.overallScore).toBe(68);
    expect(mapped.status).toBe('aktiv');
  });

  it('sisListService und Repository nutzen assessment_runs Live-Basis', async () => {
    expect(readSrc('src/lib/pflege/sisListService.ts')).toContain('sisAssessmentSupabaseRepository');
    expect(readSrc('src/lib/services/repositories/sisAssessmentRepository.supabase.ts')).toContain(
      'assessment_runs',
    );

    const list = await fetchSisAssessments(DEMO_TENANT_ID, 'nurse');
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.data.length).toBe(getDemoSisAssessments().length);

    const detail = await fetchSisAssessmentDetail('sis-001', DEMO_TENANT_ID, 'nurse');
    expect(detail.ok).toBe(true);
  });

  it('SIS Detail Hero, Screen und Route existieren', () => {
    expect(readSrc('src/components/pflege/SisDetailHero.tsx')).toContain('PremiumListHeroFrame');
    expect(readSrc('app/pflege/sis/[id]/index.tsx')).toContain('SisDetailScreen');
    const demo = getDemoSisAssessments()[0];
    const kpis = buildSisDetailKpis(demo);
    expect(kpis.some((k) => k.id === 'score')).toBe(true);
  });

  it('VitalReadingDetailHero ersetzt flachen PremiumCard-Header', () => {
    expect(readSrc('src/components/pflege/VitalReadingDetailHero.tsx')).toContain('PremiumListHeroFrame');
    expect(readSrc('src/screens/pflege/VitalReadingDetailScreen.tsx')).toContain('VitalReadingDetailHero');
  });

  it('Desktop-Tabellen für verbleibende Pflege-Listen', () => {
    expect(readSrc('src/components/pflege/SisOverviewListTable.tsx')).toContain('PremiumDataTable');
    expect(readSrc('src/components/pflege/MedicationListTable.tsx')).toContain('PremiumDataTable');
    expect(readSrc('src/components/pflege/WoundDocumentationListTable.tsx')).toContain('PremiumDataTable');
    expect(readSrc('src/components/pflege/CareDocumentationListTable.tsx')).toContain('PremiumDataTable');
    expect(readSrc('src/components/pflege/ShiftScheduleListTable.tsx')).toContain('PremiumDataTable');
  });

  it('Listen-Screens nutzen DesktopListViewPreference', () => {
    expect(readSrc('src/screens/pflege/SisOverviewScreen.tsx')).toContain("useDesktopListViewPreference('pflege.sis')");
    expect(readSrc('src/screens/pflege/MedicationListScreen.tsx')).toContain(
      "useDesktopListViewPreference('pflege.medication')",
    );
    expect(readSrc('src/screens/pflege/WoundDocumentationListScreen.tsx')).toContain(
      "useDesktopListViewPreference('pflege.wounds')",
    );
    expect(readSrc('src/screens/pflege/CareDocumentationListScreen.tsx')).toContain(
      "useDesktopListViewPreference('pflege.documentation')",
    );
    expect(readSrc('src/screens/pflege/ShiftScheduleListScreen.tsx')).toContain(
      "useDesktopListViewPreference('pflege.shifts')",
    );
  });

  it('PflegeIndexScreen poliert Schnellzugriff und Bewohner-Link', () => {
    const screen = readSrc('src/screens/pflege/PflegeIndexScreen.tsx');
    expect(screen).toContain('CareLightModuleDashboard');
    expect(screen).toContain('/stationaer/bewohner');
    expect(screen).toContain('isVitalReadingsLiveReady');
    expect(screen).toContain('tilePreparedOnly');
    expect(screen).toContain("moduleColor('pflege')");
  });

  it('pflegeModuleConfig markiert Vitalwerte und SIS als demo-funktional', () => {
    const config = readSrc('src/lib/pflege/pflegeModuleConfig.ts');
    expect(config).toContain('isVitalReadingsLiveReady');
    expect(config).toContain('isSisLiveReady');
    expect(config).toContain('VITAL_READINGS_PREPARED_MESSAGE');
    expect(isVitalReadingsLiveReady()).toBe(true);
    expect(isSisLiveReady()).toBe(true);
  });

  it('fetchVitalReadingDetail liefert Demo-Detail', async () => {
    const demoId = getDemoVitalReadings()[0]?.id;
    expect(demoId).toBeTruthy();
    const result = await fetchVitalReadingDetail(demoId!, DEMO_TENANT_ID, 'nurse');
    expect(result.ok).toBe(true);
  });
});
