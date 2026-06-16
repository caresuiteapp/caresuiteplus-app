import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
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
    expect(isVitalWriteReady()).toBe(true);
    expect(isSisWriteReady()).toBe(true);
    expect(isCareDocumentationSignReady()).toBe(true);
    expect(isCareDocumentationPdfReady()).toBe(true);
    expect(isShiftScheduleImportReady()).toBe(false);
    expect(isMedicationEmpReady()).toBe(false);
    expect(isWoundBodyMapReady()).toBe(true);
  });

  it('Medikation Detail hat InfoBanner und deaktivierte eMP-Aktionen', () => {
    const screen = readSrc('src/screens/pflege/MedicationDetailScreen.tsx');
    expect(screen).toContain('InfoBanner');
    expect(screen).toContain('MEDICATION_EMP_PREPARED_MESSAGE');
    expect(screen).toContain('eMP abgleichen');
    expect(screen).toContain("getActionAvailability('medication.emp_sync'");
    expect(screen).not.toContain('onPress={() => undefined}');
  });

  it('Wunddetail verlinkt BodyMap wenn demo-funktional', () => {
    const screen = readSrc('src/screens/pflege/WoundDocumentationDetailScreen.tsx');
    expect(screen).toContain('BodyMap öffnen');
    expect(screen).toContain('/pflege/bodymap');
    expect(screen).toContain('bodyMapReady');
  });

  it('Dienstpläne haben Import-InfoBanner und deaktivierten Import-Button', () => {
    const screen = readSrc('src/screens/pflege/ShiftScheduleListScreen.tsx');
    expect(screen).toContain('SHIFT_SCHEDULE_IMPORT_PREPARED_MESSAGE');
    expect(screen).toContain('Dienstplan importieren');
    expect(screen).toContain("getActionAvailability('shift.import'");
    expect(screen).not.toContain('onPress={() => undefined}');
  });

  it('SIS create/edit demo-funktionale Formulare und Routen', () => {
    expect(readSrc('app/pflege/sis/create.tsx')).toContain('SisFormScreen');
    expect(readSrc('app/pflege/sis/new.tsx')).toContain('SisFormScreen');
    const form = readSrc('src/screens/pflege/SisFormScreen.tsx');
    expect(form).toContain('SIS_TOPIC_FIELDS');
    expect(form).toContain('Risikomatrix');
    expect(form).toContain('saveSisFormAssessment');
    expect(readSrc('src/screens/pflege/SisOverviewScreen.tsx')).toContain('/pflege/sis/create');
    expect(readSrc('src/screens/pflege/SisDetailScreen.tsx')).toContain('/pflege/sis/${id}/edit');
  });

  it('Vital write paths: Create-Route, Speichern und Detail-Aktionen', () => {
    expect(readSrc('app/pflege/vitalwerte/create.tsx')).toContain('VitalReadingCreateScreen');
    const create = readSrc('src/screens/pflege/VitalReadingCreateScreen.tsx');
    expect(create).toContain('createVitalReading');
    expect(create).toContain('isVitalWriteReady');
    expect(readSrc('src/screens/pflege/VitalReadingsListScreen.tsx')).toContain('/pflege/vitalwerte/create');
    const detail = readSrc('src/screens/pflege/VitalReadingDetailScreen.tsx');
    expect(detail).toContain('Schwellenwert setzen');
    expect(detail).toContain('writeReady');
  });

  it('Pflegedokumentation Detail hat Sign/PDF InfoBanner und deaktivierte Aktionen', () => {
    const screen = readSrc('src/screens/pflege/CareDocumentationDetailScreen.tsx');
    expect(screen).toContain('CARE_DOCUMENTATION_SIGN_PREPARED_MESSAGE');
    expect(screen).toContain('CARE_DOCUMENTATION_PDF_PREPARED_MESSAGE');
    expect(screen).toContain('Nachweis signieren');
    expect(screen).toContain('PDF exportieren');
    expect(screen).toContain("getActionAvailability('signature.sign'");
    expect(screen).toContain("getActionAvailability('signature.export_pdf'");
    expect(screen).not.toContain('onPress={() => undefined}');
  });

  it('Batch 3 Live-Wiring bleibt intakt (Regression)', async () => {
    expect(readSrc('src/lib/pflege/vitalService.ts')).toContain('vitalSignSupabaseRepository');
    expect(readSrc('src/lib/pflege/sisListService.ts')).toContain('sisAssessmentSupabaseRepository');

    const vital = await fetchVitalReadingDetail('vital-001', DEMO_TENANT_ID, 'nurse');
    expect(vital.ok).toBe(true);

    const sis = await fetchSisAssessmentDetail('sis-001', DEMO_TENANT_ID, 'nurse');
    expect(sis.ok).toBe(true);
  });

  it('preparedOnly Formulare simulieren keinen Erfolg', () => {
    expect(readSrc('src/screens/pflege/SisPreparedFormScreen.tsx')).not.toContain('SuccessState');
    expect(readSrc('src/screens/pflege/VitalReadingCreateScreen.tsx')).not.toContain('SuccessState');
    expect(readSrc('src/screens/pflege/MedicationDetailScreen.tsx')).not.toContain('SuccessState');
  });
});
