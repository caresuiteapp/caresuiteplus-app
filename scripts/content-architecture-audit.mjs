#!/usr/bin/env node
/**
 * Content Architecture audit — CareSuite+ Office central platform, module subpages, demo minimums.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`\n✗ content:audit fehlgeschlagen: ${message}\n`);
  process.exit(1);
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function routeExists(routePath) {
  const appPath = join(root, 'app', routePath.replace(/^\//, ''));
  const candidates = [
    appPath + '.tsx',
    join(appPath, 'index.tsx'),
  ];
  return candidates.some((p) => existsSync(p));
}

console.log('CareSuite+ content:audit\n');

// Route-Konflikte (segment.tsx + segment/)
const conflictScript = join(root, 'scripts/find-route-conflicts.mjs');
if (existsSync(conflictScript)) {
  const { execSync } = await import('node:child_process');
  try {
    execSync('node scripts/find-route-conflicts.mjs', { cwd: root, stdio: 'pipe' });
    console.log('✓ Keine Expo-Router segment-Konflikte');
  } catch {
    fail('Expo-Router segment.tsx + segment/ Konflikte in app/');
  }
}

const CORE_ROUTE_CHECKS = [
  { route: 'pflege/wunden/new', must: 'WoundCreateScreen' },
  { route: 'pflege/dienstplaene/new', must: 'ShiftScheduleCreateScreen' },
  { route: 'pflege/sis/new', must: 'SisFormScreen', mustNot: 'SisPreparedFormScreen' },
  { route: 'assist/einsaetze/new', must: 'AssignmentCreateScreen' },
];

for (const check of CORE_ROUTE_CHECKS) {
  const routePath = join(root, 'app', check.route + '.tsx');
  if (!existsSync(routePath)) fail(`Kernroute fehlt: /${check.route}`);
  const src = readFileSync(routePath, 'utf8');
  if (!src.includes(check.must)) fail(`/${check.route} zeigt nicht ${check.must}`);
  if (check.mustNot && src.includes(check.mustNot)) fail(`/${check.route} enthält verboten: ${check.mustNot}`);
}
console.log(`✓ ${CORE_ROUTE_CHECKS.length} Kern-/new-Routen geprüft`);

const REQUIRED_LIB = [
  'src/lib/officeCore/types.ts',
  'src/lib/officeCore/officeCoreService.ts',
  'src/lib/officeCore/demoRepository.ts',
  'src/lib/officeCore/supabaseRepository.ts',
  'src/lib/officeModules/moduleAssignmentService.ts',
  'src/lib/officeModules/billingSourceService.ts',
  'src/lib/officeModules/documentVisibilityService.ts',
  'src/lib/officeModules/templateAssignmentService.ts',
  'src/lib/officeModules/permissionProfileService.ts',
  'src/data/demo/officeCoreAssignments.ts',
  'scripts/content-architecture-audit.mjs',
];

const missingLib = REQUIRED_LIB.filter((rel) => !existsSync(join(root, rel)));
if (missingLib.length > 0) {
  fail(`Fehlende Content-Architektur-Dateien:\n  - ${missingLib.join('\n  - ')}`);
}

const migration = read('supabase/migrations/0037_office_module_assignments.sql');
for (const table of [
  'client_module_assignments',
  'employee_module_assignments',
  'module_service_catalog',
  'module_billing_sources',
  'module_document_visibility',
  'module_template_assignments',
  'module_permission_profiles',
]) {
  if (!migration.includes(table)) fail(`Migration 0037 fehlt Tabelle ${table}`);
}
if (!migration.includes('ENABLE ROW LEVEL SECURITY')) {
  fail('Migration 0037: RLS fehlt');
}

const OFFICE_MODULE_ROUTES = [
  '/business/office/modules',
  '/business/office/modules/clients',
  '/business/office/modules/employees',
  '/business/office/modules/services',
  '/business/office/modules/documents',
  '/business/office/modules/templates',
  '/business/office/modules/permissions',
  '/business/office/modules/billing',
  '/business/office/audit-log',
  '/business/office/dashboard',
];

for (const route of OFFICE_MODULE_ROUTES) {
  if (!routeExists(route)) fail(`Route fehlt: ${route}`);
}

const MODULE_ASSIGNED_ROUTES = [
  '/pflege/zugeordnete-klienten',
  '/assist/zugeordnete-klienten',
  '/beratung/zugeordnete-klienten',
];
for (const route of MODULE_ASSIGNED_ROUTES) {
  if (!routeExists(route)) fail(`Modul-Zuordnungsroute fehlt: ${route}`);
}

const clientsSource = read('src/data/demo/clients.ts');
const clientMatches = clientsSource.match(/id: 'client-/g) ?? [];
if (clientMatches.length < 20) {
  fail(`Demo-Klient:innen Minimum 20 — gefunden: ${clientMatches.length}`);
}

const employeesSource = read('src/data/demo/employees.ts');
const employeeMatches = employeesSource.match(/id: 'employee-/g) ?? [];
if (employeeMatches.length < 15) {
  fail(`Demo-Mitarbeitende Minimum 15 — gefunden: ${employeeMatches.length}`);
}

const hubScreen = read('src/screens/business/office/OfficeModulesHubScreen.tsx');
for (const marker of ['CareLightPageShell', 'CareLightErrorState', 'CareLightEmptyState', 'router.push']) {
  if (!hubScreen.includes(marker)) fail(`OfficeModulesHubScreen fehlt: ${marker}`);
}
if (hubScreen.includes('Coming Soon') || hubScreen.includes('onPress={() => {}}')) {
  fail('OfficeModulesHubScreen enthält Platzhalter');
}

const assignmentScreen = read('src/screens/business/office/OfficeModuleAssignmentListScreen.tsx');
for (const marker of ['PremiumInput', 'LoadingState', 'ErrorState', 'EmptyState']) {
  if (!assignmentScreen.includes(marker)) fail(`OfficeModuleAssignmentListScreen fehlt: ${marker}`);
}

const shellConfig = read('src/lib/navigation/shellConfig.ts');
if (!shellConfig.includes('/business/office/modules')) {
  fail('shellConfig: Office-Modul-Link fehlt');
}

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts?.['content:audit']) {
  fail('package.json: content:audit Script fehlt');
}

const testsDir = join(root, 'src/__tests__/office');
const contentTests = readdirSync(testsDir).filter((f) => f.includes('content') || f.includes('moduleAssignment') || f.includes('officeCore'));
if (contentTests.length === 0 && !existsSync(join(root, 'src/__tests__/office/officeContentArchitecture.test.ts'))) {
  fail('Content-Architektur-Tests fehlen (officeContentArchitecture.test.ts)');
}

console.log(`✓ ${REQUIRED_LIB.length} Content-Library-Dateien vorhanden`);
console.log('✓ Migration 0037 mit 7 Tabellen + RLS');
console.log(`✓ ${OFFICE_MODULE_ROUTES.length} Office-Modul-Routen`);
console.log(`✓ Demo-Daten: ${clientMatches.length} Klient:innen, ${employeeMatches.length} Mitarbeitende`);
console.log('✓ Module-Zuordnungs-Screens mit Suche/Filter/States');
console.log('✓ Navigation Office-zentriert');

function countDemoRecords(source, { idPrefix, generatorPattern }) {
  const literal = (source.match(new RegExp(`id: '${idPrefix}`, 'g')) ?? []).length;
  const genMatch = source.match(generatorPattern);
  const generated = genMatch ? Number(genMatch[1]) : 0;
  return literal + generated;
}

const PFLEGE_DEMO_MINIMUMS = [
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
    count: () => {
      const gen = read('src/data/demo/generators/pflegeDemoGenerators.ts');
      const block = gen.match(/export const MEDICATION_NAMES = \[([\s\S]*?)\];/);
      return block ? (block[1].match(/\n\s+'/g) ?? []).length : 0;
    },
  },
  {
    file: 'src/data/demo/woundDocumentations.ts',
    min: 10,
    label: 'Wunden',
    count: () => {
      const gen = read('src/data/demo/generators/pflegeDemoGenerators.ts');
      const block = gen.match(/export const WOUND_LOCATIONS = \[([\s\S]*?)\];/);
      return block ? (block[1].match(/\n\s+'/g) ?? []).length : 0;
    },
  },
  {
    file: 'src/data/demo/careRecords.ts',
    min: 25,
    label: 'Pflegeberichte',
    count: (src) =>
      countDemoRecords(src, {
        idPrefix: 'record-',
        generatorPattern: /for \(let i = 0; i < (\d+); i\+\+\)/,
      }),
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

for (const { file, min, label, count } of PFLEGE_DEMO_MINIMUMS) {
  const src = read(file);
  const total = count(src);
  if (total < min) fail(`${label} Demo-Minimum ${min} — berechnet: ${total}`);
}

const pflegeConfig = read('src/lib/pflege/pflegeModuleConfig.ts');
if (!pflegeConfig.includes('isPflegeDemoFunctional')) {
  fail('pflegeModuleConfig: isPflegeDemoFunctional fehlt');
}

const featureStatus = read('src/lib/status/featureStatus.ts');
if (!featureStatus.includes('available_demo')) {
  fail('featureStatus.ts: available_demo fehlt');
}

console.log(`✓ Pflege-Demo-Minimums (${PFLEGE_DEMO_MINIMUMS.length} Domänen)\n`);
