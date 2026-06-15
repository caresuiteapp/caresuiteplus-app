#!/usr/bin/env node
/**
 * Functional reality audit — core screens must save/load, not be No-Op.
 * Run: npm run functional:audit
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`\n✗ functional:audit fehlgeschlagen: ${message}\n`);
  process.exit(1);
}

function read(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) fail(`Datei fehlt: ${rel}`);
  return readFileSync(p, 'utf8');
}

const CORE_CHECKS = [
  {
    label: 'BodyMap',
    files: ['src/screens/pflege/BodyMapScreen.tsx', 'src/lib/pflege/bodyMapService.ts'],
    must: ['createBodyMapMarker', 'fetchBodyMapMarkers', 'PremiumButton'],
    mustNot: ['onPress={() => undefined}', 'onPress={() => {}}', 'SisPreparedFormScreen'],
  },
  {
    label: 'Wunddokumentation Create',
    files: ['src/screens/pflege/WoundCreateScreen.tsx', 'src/lib/pflege/woundDocumentationService.ts'],
    must: ['createWoundDocumentation', 'handleSave', 'createBodyMapMarker'],
    mustNot: ['WoundDocumentationListScreen', 'onPress={() => undefined}'],
  },
  {
    label: 'Wunddokumentation Detail',
    files: ['src/screens/pflege/WoundDocumentationDetailScreen.tsx'],
    must: ['handlePhotoUpload', 'DocumentPicker', 'router.push'],
    mustNot: ['onPress={() => undefined}', 'PreparedModeBanner'],
  },
  {
    label: 'SIS Form',
    files: ['src/screens/pflege/SisFormScreen.tsx', 'app/pflege/sis/new.tsx'],
    must: ['SIS_TOPIC_FIELDS', 'upsertSisRisk', 'createSisFormAssessment'],
    mustNot: ['SisPreparedFormScreen'],
  },
  {
    label: 'Vitalwerte Create',
    files: ['src/screens/pflege/VitalReadingCreateScreen.tsx'],
    must: ['createVitalReading', 'SegmentedTabs', 'handleSave'],
    mustNot: ['onPress={() => undefined}'],
  },
  {
    label: 'Medikation Create',
    files: ['src/screens/pflege/MedicationCreateScreen.tsx'],
    must: ['createDemoMedication', 'CareMedicationScheduleInput', 'handleSave'],
    mustNot: ['onPress={() => undefined}'],
  },
  {
    label: 'Assist Execution',
    files: ['src/screens/assist/AssignmentExecutionScreen.tsx', 'app/assist/durchfuehrung/[id].tsx'],
    must: ['checkIn', 'startWork', 'checkOut', 'createCareRecordFromExecution'],
    mustNot: ['onPress={() => undefined}'],
  },
  {
    label: 'Client Edit',
    files: ['src/screens/office/ClientEditScreen.tsx'],
    must: ['useClientEditWizard', 'submit', 'FormStepper'],
    mustNot: ['ClientDetailScreen'],
  },
  {
    label: 'Dienstplan Create',
    files: ['src/screens/pflege/ShiftScheduleCreateScreen.tsx'],
    must: ['createShiftScheduleEntry', 'handleSave'],
    mustNot: ['ShiftScheduleListScreen'],
  },
  {
    label: 'Pflegebericht Create',
    files: ['src/screens/pflege/PflegeberichtErstellenScreen.tsx'],
    must: ['createPflegeBericht', 'handleSubmit'],
    mustNot: ['PflegeberichteListScreen'],
  },
];

console.log('CareSuite+ functional:audit\n');

let issues = 0;
for (const check of CORE_CHECKS) {
  const src = check.files.map((f) => read(f)).join('\n');
  const missing = check.must.filter((m) => !src.includes(m));
  const forbidden = check.mustNot.filter((m) => src.includes(m));
  if (missing.length || forbidden.length) {
    console.log(`✗ ${check.label} — fehlt: ${missing.join(', ') || '—'} verboten: ${forbidden.join(', ') || '—'}`);
    issues += 1;
  } else {
    console.log(`✓ ${check.label}`);
  }
}

const sisNew = read('app/pflege/sis/new.tsx');
if (sisNew.includes('SisPreparedFormScreen')) {
  console.log('✗ SIS /new route nutzt SisPreparedFormScreen');
  issues += 1;
} else {
  console.log('✓ SIS /new → SisFormScreen');
}

if (issues > 0) fail(`${issues} Kernfunktionen nicht demo-funktional`);

console.log('\n✓ functional:audit bestanden\n');
process.exit(0);
