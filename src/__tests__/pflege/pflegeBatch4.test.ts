import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { fetchSisAssessmentDetail } from '@/lib/pflege/sisListService';
import { fetchVitalReadingDetail } from '@/lib/pflege/vitalDetailService';
import {
  isCareDocumentationPdfReady,
  isCareDocumentationSignReady,
  isMedicationEmpReady,
  isShiftScheduleImportReady,
  isSisWriteReady,
  isVitalWriteReady,
  isWoundBodyMapReady,
} from '@/lib/pflege/pflegeModuleConfig';

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Pflege Sprint Batch 4 (Sprint 78)', () => {
  it('pflegeModuleConfig exportiert Write/Import-Readiness-Flags', () => {
    const config = readSrc('src/lib/pflege/pflegeModuleConfig.ts');
    expect(config).toContain('isVitalWriteReady');
    expect(config).toContain('isSisWriteReady');
    expect(config).toContain('isCareDocumentationSignReady');
    expect(config).toContain('isShiftScheduleImportReady');
    expect(config).toContain('MEDICATION_EMP_PREPARED_MESSAGE');
    expect(isVitalWriteReady()).toBe(false);
    expect(isSisWriteReady()).toBe(false);
    expect(isCareDocumentationSignReady()).toBe(false);
    expect(isCareDocumentationPdfReady()).toBe(false);
    expect(isShiftScheduleImportReady()).toBe(false);
    expect(isMedicationEmpReady()).toBe(false);
    expect(isWoundBodyMapReady()).toBe(false);
  });

  it('Medikation Detail erklärt eMP, ohne eine wirkungslose Aktion anzubieten', () => {
    const screen = readSrc('src/screens/pflege/MedicationDetailScreen.tsx');
    expect(screen).toContain('InfoBanner');
    expect(readSrc('src/components/pflege/MedicationDetailHero.tsx')).toContain('eMP/TI extern');
    expect(screen).not.toContain('eMP abgleichen');
  });

  it('Wunddetail verlinkt BodyMap wenn demo-funktional', () => {
    const screen = readSrc('src/screens/pflege/WoundDocumentationDetailScreen.tsx');
    expect(screen).toContain('BodyMap öffnen');
    expect(screen).toContain('/pflege/bodymap');
    expect(screen).toContain('bodyMapReady');
  });

  it('Dienstpläne erklären den ausstehenden Import, ohne wirkungslosen Button', () => {
    const screen = readSrc('src/screens/pflege/ShiftScheduleListScreen.tsx');
    expect(screen).toContain('SHIFT_SCHEDULE_IMPORT_PREPARED_MESSAGE');
    expect(screen).not.toContain('Dienstplan importieren');
    expect(screen).toContain('isShiftScheduleImportReady');
  });

  it('SIS create/edit demo-funktionale Formulare und Routen', () => {
    expect(readSrc('app/pflege/sis/create.tsx')).toContain('CareAssessmentWorkspaceScreen');
    expect(readSrc('app/pflege/sis/new.tsx')).toContain('CareAssessmentWorkspaceScreen');
    const form = readSrc('src/screens/careAssessment/CareAssessmentWorkspaceScreen.tsx');
    expect(form).toContain('CARE_ASSESSMENT_TOPIC_LABELS');
    expect(form).toContain('Risikomatrix');
    expect(form).toContain('saveCareAssessment');
    expect(readSrc('src/screens/careAssessment/CareAssessmentListScreen.tsx')).toContain('`${base}/new`');
    expect(readSrc('app/pflege/sis/[id]/edit.tsx')).toContain('CareAssessmentWorkspaceScreen');
  });

  it('Vital write paths: Create-Route und Speichern bleiben funktional', () => {
    expect(readSrc('app/pflege/vitalwerte/create.tsx')).toContain('VitalReadingCreateScreen');
    const create = readSrc('src/screens/pflege/VitalReadingCreateScreen.tsx');
    expect(create).toContain('createVitalReading');
    expect(create).toContain('vitalSignSupabaseRepository');
    expect(readSrc('src/screens/pflege/VitalReadingsListScreen.tsx')).toContain('/pflege/vitalwerte/create');
    const detail = readSrc('src/screens/pflege/VitalReadingDetailScreen.tsx');
    expect(detail).toContain('useVitalReadingDetail');
    expect(detail).not.toContain('Schwellenwert setzen');
  });

  it('Pflegedokumentation Detail zeigt ehrliche Sign/PDF-Bereitschaft ohne leere Aktionen', () => {
    const screen = readSrc('src/screens/pflege/CareDocumentationDetailScreen.tsx');
    expect(screen).toContain('CARE_DOCUMENTATION_SIGN_PREPARED_MESSAGE');
    expect(screen).toContain('CARE_DOCUMENTATION_PDF_PREPARED_MESSAGE');
    expect(screen).not.toContain('Nachweis signieren');
    expect(screen).not.toContain('PDF exportieren');
    expect(screen).toContain('isCareDocumentationSignReady');
    expect(screen).toContain('isCareDocumentationPdfReady');
  });

  it('Batch 3 Live-Wiring bleibt intakt (Regression)', async () => {
    expect(readSrc('src/lib/pflege/vitalService.ts')).toContain('vitalSignSupabaseRepository');
    expect(readSrc('src/lib/pflege/sisListService.ts')).toContain('sisAssessmentSupabaseRepository');

    const vital = await fetchVitalReadingDetail('vital-001', DEMO_TENANT_ID, 'nurse');
    expect(vital.ok).toBe(false);

    const sis = await fetchSisAssessmentDetail('sis-001', DEMO_TENANT_ID, 'nurse');
    expect(sis.ok).toBe(true);
  });

  it('live Formulare zeigen Erfolg ausschließlich nach Serviceantwort', () => {
    expect(readSrc('src/screens/pflege/SisPreparedFormScreen.tsx')).not.toContain('SuccessState');
    expect(readSrc('src/screens/pflege/VitalReadingCreateScreen.tsx')).toContain('setSuccess');
    expect(readSrc('src/screens/pflege/MedicationDetailScreen.tsx')).toContain('if (!result.ok)');
  });
});
