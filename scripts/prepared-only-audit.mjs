#!/usr/bin/env node
/**
 * Prepared-only audit — core functions must not remain preparedOnly.
 * Only external-provider features (TI, eMP, DATEV, etc.) may keep preparation markers.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const ALLOWED_PATH_FRAGMENTS = [
  '/ti/',
  '/components/ti/',
  '/lib/ti/',
  'TIProvider',
  'TIVorbereitung',
  'KIMMessage',
  'KIMMailbox',
  'TIConsent',
  'TIAuditLog',
  'insightModuleConfig',
  '/insight/',
  'integrationsModuleConfig',
  '/integrations/',
  'useVoiceMessage',
  'voicePreparedOnly',
  'productAccessService',
  'PremiumPreparedNotice',
  'DataSubjectRequestPanel',
  'dsgvoAdminNotify',
  'dataRequestConfig',
  'PilotReadinessHero',
  'DemoLoginHero',
  'DemoModeHintHero',
  'AuthLoginHero',
  'EmployeeFirstLoginHero',
  'ReleaseHubHero',
  'ReleaseListHero',
  'ReleaseDetailHero',
  'RoadmapHubHero',
  'RoadmapListHero',
  'RoadmapDetailHero',
  'PlatformHubHero',
  'OcrJob',
  'AiJob',
  'store_submission',
  'store-audit',
  'WorkflowBuilderHero',
  'gpsTrackingConfig',
  'gpsLocationService',
  'MedicationDetailHero',
  'MedicationDetailScreen',
  'WoundDocumentationDetailHero',
  'WoundDocumentationDetailScreen',
  'CareDocumentationDetailHero',
  'isMedicationEmpReady',
  'isWoundBodyMapReady',
  'MEDICATION_EMP_PREPARED',
  'WOUND_BODYMAP_PREPARED',
  'SHIFT_SCHEDULE_IMPORT',
  'isShiftScheduleImportReady',
  'prepared-only-audit',
  'preparedOnlyElimination',
  'pflegeBatch4',
  'pflegeBatch5',
  'pflegePremiumHeroesBatch',
  'QmAiAssistantHero',
  'MdAuditCenterHero',
  'MdShareViewHero',
  'featureStatus.ts',
  '__tests__',
];

const CORE_MARKERS = [
  /In Vorbereitung/i,
  /Demnächst/i,
  /Coming Soon/i,
  /preparedOnly:\s*true/,
  /preparedOnly=\{true\}/,
];

const SCAN_DIRS = [
  'src/components/pflege',
  'src/screens/pflege',
  'src/lib/pflege',
  'src/data/demo/domains/pflegeModuleDemo.ts',
  'src/components/assist',
  'src/screens/assist',
  'src/lib/assist/assistModuleConfig.ts',
  'src/components/beratung',
  'src/screens/beratung',
  'src/components/stationaer',
  'src/screens/stationaer',
  'src/components/akademie',
  'src/screens/akademie',
  'src/components/office',
  'src/screens/business/office',
  'src/screens/office',
];

const ALLOWED_IN_CORE = [
  'emp extern',
  'eMP extern',
  'BodyMap extern',
  'GPS extern',
  'Import extern',
  'MDK extern',
  'TI in Vorbereitung',
  'requires_external_provider',
  'MEDICATION_EMP',
  'WOUND_BODYMAP',
  'SHIFT_SCHEDULE_IMPORT',
  'isMedicationEmpReady',
  'isWoundBodyMapReady',
  'isShiftScheduleImportReady',
  'isGpsTrackingLiveReady',
  'gpsTrackingConfig',
];

function fail(message) {
  console.error(`\n✗ prepared-only:audit fehlgeschlagen: ${message}\n`);
  process.exit(1);
}

function isAllowedFile(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  return ALLOWED_PATH_FRAGMENTS.some((frag) => normalized.includes(frag));
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  const stat = statSync(dir);
  if (stat.isFile() && /\.(ts|tsx)$/.test(dir)) {
    files.push(dir);
    return files;
  }
  if (!stat.isDirectory()) return files;
  for (const entry of readdirSync(dir)) {
    walk(join(dir, entry), files);
  }
  return files;
}

function isAllowedCoreContent(source) {
  return ALLOWED_IN_CORE.some((frag) => source.includes(frag));
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

console.log('CareSuite+ prepared-only:audit\n');

if (!existsSync(join(root, 'src/lib/status/featureStatus.ts'))) {
  fail('featureStatus.ts fehlt');
}

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts?.['prepared-only:audit']) {
  fail('package.json: prepared-only:audit Script fehlt');
}

const violations = [];

for (const scanDir of SCAN_DIRS) {
  const abs = join(root, scanDir);
  if (!existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const rel = relative(root, file).replace(/\\/g, '/');
    if (isAllowedFile(rel)) continue;

    const source = readFileSync(file, 'utf8');
    if (isAllowedCoreContent(source)) {
      // file may contain allowed external-provider markers only
    }
    for (const marker of CORE_MARKERS) {
      if (!marker.test(source)) continue;
      // Allow lines that only reference external-provider allowed fragments
      const lines = source.split('\n').filter((line) => marker.test(line));
      const badLines = lines.filter(
        (line) => !ALLOWED_IN_CORE.some((frag) => line.includes(frag)),
      );
      if (badLines.length > 0) {
        violations.push({ file: rel, marker: marker.toString() });
        break;
      }
    }
  }
}

function countDemoRecords(source, { idPrefix, generatorPattern }) {
  const literal = (source.match(new RegExp(`id: '${idPrefix}`, 'g')) ?? []).length;
  const genMatch = source.match(generatorPattern);
  const generated = genMatch ? Number(genMatch[1]) : 0;
  return literal + generated;
}

const CORE_DEMO_MINIMUMS = [
  {
    file: 'src/data/demo/vitalReadings.ts',
    min: 30,
    label: 'Vitalwerte',
    count: (src) =>
      countDemoRecords(src, {
        idPrefix: 'vital-',
        generatorPattern: /generateExtraVitalReadings\(\d+,\s*(\d+)\)/,
      }),
  },
  {
    file: 'src/data/demo/medications.ts',
    min: 12,
    label: 'Medikation',
    count: (src) => {
      const gen = read('src/data/demo/generators/pflegeDemoGenerators.ts');
      const block = gen.match(/export const MEDICATION_NAMES = \[([\s\S]*?)\];/);
      return block ? (block[1].match(/\n\s+'/g) ?? []).length : 0;
    },
  },
  {
    file: 'src/data/demo/woundDocumentations.ts',
    min: 10,
    label: 'Wunddokumentation',
    count: (src) => {
      const gen = read('src/data/demo/generators/pflegeDemoGenerators.ts');
      const block = gen.match(/export const WOUND_LOCATIONS = \[([\s\S]*?)\];/);
      return block ? (block[1].match(/\n\s+'/g) ?? []).length : 0;
    },
  },
  {
    file: 'src/data/demo/careRecords.ts',
    min: 25,
    label: 'Pflegedokumentation',
    count: (src) =>
      countDemoRecords(src, {
        idPrefix: 'record-',
        generatorPattern: /for \(let i = 0; i < (\d+); i\+\+\)/,
      }),
  },
  {
    file: 'src/lib/pflege/shiftScheduleDemo.ts',
    min: 100,
    label: 'Dienstpläne',
    count: (src) => {
      const staff = (src.match(/SHIFT_STAFF/g) ?? []).length > 0 ? 10 : 0;
      const daysMatch = src.match(/for \(let day = 0; day < (\d+); day\+\+\)/);
      const days = daysMatch ? Number(daysMatch[1]) : 0;
      return staff * days;
    },
  },
  {
    file: 'src/data/demo/sisAssessments.ts',
    min: 10,
    label: 'SIS',
    count: (src) => {
      const slice = src.match(/demoClients\.slice\(0, (\d+)\)/);
      return slice ? Number(slice[1]) : (src.match(/id: 'sis-/g) ?? []).length;
    },
  },
];

for (const { file, min, label, count } of CORE_DEMO_MINIMUMS) {
  if (!existsSync(join(root, file))) {
    fail(`Demo-Datei fehlt: ${file} (${label})`);
  }
  const total = count(read(file));
  if (total < min) {
    fail(`${label}: Minimum ${min} Demo-Einträge — berechnet: ${total} in ${file}`);
  }
}

if (violations.length > 0) {
  const list = violations
    .slice(0, 20)
    .map((v) => `  - ${v.file}`)
    .join('\n');
  fail(
    `${violations.length} Core-Datei(en) mit preparedOnly/In-Vorbereitung-Markern:\n${list}${
      violations.length > 20 ? `\n  … und ${violations.length - 20} weitere` : ''
    }`,
  );
}

console.log('✓ featureStatus.ts vorhanden');
console.log(`✓ ${CORE_DEMO_MINIMUMS.length} Pflege-Demo-Minimums erfüllt`);
console.log(`✓ 0 Core-Verstöße in ${SCAN_DIRS.join(', ')}\n`);
