#!/usr/bin/env node
/**
 * Expo Router segment.tsx + segment/ conflict audit.
 * Run: npm run navigation:audit
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = join(root, 'app');

function fail(message) {
  console.error(`\n✗ navigation:audit fehlgeschlagen: ${message}\n`);
  process.exit(1);
}

function walkConflicts(dir) {
  const conflicts = [];
  if (!existsSync(dir)) return conflicts;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      conflicts.push(...walkConflicts(full));
      const name = entry.name;
      if (name.startsWith('(') || name.startsWith('[')) continue;
      const siblingTsx = join(dir, `${name}.tsx`);
      if (existsSync(siblingTsx)) {
        conflicts.push({
          folder: full.replace(/\\/g, '/').replace(root.replace(/\\/g, '/') + '/', ''),
          file: siblingTsx.replace(/\\/g, '/').replace(root.replace(/\\/g, '/') + '/', ''),
        });
      }
    }
  }
  return conflicts;
}

function findRouteFile(routePath) {
  const segments = routePath.replace(/^\//, '').split('/').filter(Boolean);

  function walk(dir, index) {
    if (!existsSync(dir)) return null;
    if (index >= segments.length) {
      if (existsSync(join(dir, 'index.tsx'))) return join(dir, 'index.tsx');
      if (existsSync(`${dir}.tsx`)) return `${dir}.tsx`;
      return null;
    }
    const seg = segments[index];
    const entries = readdirSync(dir, { withFileTypes: true });
    const exactDir = entries.find((e) => e.isDirectory() && e.name === seg);
    if (exactDir) {
      const via = walk(join(dir, exactDir.name), index + 1);
      if (via) return via;
    }
    const exactFile = entries.find((e) => e.isFile() && e.name === `${seg}.tsx`);
    if (exactFile) return join(dir, exactFile.name);
    const dynamic = entries.find((e) => e.isDirectory() && e.name.startsWith('['));
    if (dynamic) return walk(join(dir, dynamic.name), index + 1);
    const group = entries.find((e) => e.isDirectory() && e.name.startsWith('('));
    if (group) {
      const via = walk(join(dir, group.name), index);
      if (via) return via;
    }
    return null;
  }

  return walk(appRoot, 0);
}

function readScreenSource(routeFile) {
  let src = readFileSync(routeFile, 'utf8');
  const m = src.match(/from '@\/screens\/([^']+)'/);
  if (m) {
    const sp = join(root, 'src/screens', `${m[1]}.tsx`);
    if (existsSync(sp)) src += `\n${readFileSync(sp, 'utf8')}`;
  }
  return src;
}

const WRONG_NEW_ROUTES = [
  {
    route: '/pflege/wunden/new',
    mustInclude: ['WoundCreateScreen', 'createWoundDocumentation'],
    mustNotInclude: ['WoundDocumentationListScreen'],
  },
  {
    route: '/pflege/berichte/new',
    mustInclude: ['PflegeberichtErstellenScreen', 'createPflegeBericht'],
    mustNotInclude: ['ListScreen'],
  },
  {
    route: '/pflege/dienstplaene/new',
    mustInclude: ['ShiftScheduleCreateScreen', 'createShiftScheduleEntry'],
    mustNotInclude: ['ShiftScheduleListScreen'],
  },
  {
    route: '/assist/einsaetze/new',
    mustInclude: ['AssignmentCreateScreen', 'EntityFormScreen'],
    mustNotInclude: ['EinsaetzeListScreen', 'AssignmentDetailScreen'],
  },
  {
    route: '/beratung/faelle/new',
    mustInclude: ['BeratungFallAnlegenScreen', 'createCounselingCase'],
    mustNotInclude: ['BeratungFaelleListScreen', 'CaseDetailScreen'],
  },
  {
    route: '/beratung/protokolle/new',
    mustInclude: ['BeratungProtokollErstellenScreen'],
    mustNotInclude: ['BeratungProtokolleListScreen'],
  },
];

const WRONG_EDIT_ROUTES = [
  {
    route: '/assist/einsaetze/assign-001/edit',
    mustInclude: ['AssignmentEditScreen', 'updateDemoAssignmentFields'],
    mustNotInclude: ['AssignmentDetailScreen'],
  },
  {
    route: '/beratung/faelle/case-001/edit',
    mustInclude: ['CaseEditScreen', 'updateDemoCounselingCase'],
    mustNotInclude: ['CaseDetailScreen'],
  },
  {
    route: '/pflege/planung/plan-001/edit',
    mustInclude: ['CarePlanEditScreen', 'updateDemoCarePlan'],
    mustNotInclude: ['CarePlanDetailScreen'],
  },
  {
    route: '/business/office/clients/client-001/edit',
    mustInclude: ['ClientEditScreen'],
    mustNotInclude: ['ClientDetailScreen'],
  },
  {
    route: '/business/office/employees/employee-001/edit',
    mustInclude: ['EmployeeEditScreen'],
    mustNotInclude: ['EmployeeDetailScreen'],
  },
];

const BRIDGE_MARKERS = ['EinzelseitenBridgeRoute', 'titleOverride'];

console.log('CareSuite+ navigation:audit\n');

const conflicts = walkConflicts(appRoot);
console.log(`Segment-Konflikte: ${conflicts.length}`);
if (conflicts.length > 0) {
  for (const c of conflicts) console.log(`  ✗ ${c.file} ↔ ${c.folder}/`);
  fail(`${conflicts.length} Expo-Router segment.tsx + segment/ Konflikte`);
}
console.log('✓ Keine segment.tsx + segment/ Konflikte');

let wrongCount = 0;
for (const check of [...WRONG_NEW_ROUTES, ...WRONG_EDIT_ROUTES]) {
  const file = findRouteFile(check.route);
  if (!file) {
    console.log(`✗ Route fehlt: ${check.route}`);
    wrongCount += 1;
    continue;
  }
  const src = readScreenSource(file);
  const missing = check.mustInclude.filter((m) => !src.includes(m));
  const forbidden = check.mustNotInclude.filter((m) => src.includes(m));
  const bridge = BRIDGE_MARKERS.some((m) => src.includes(m));
  if (missing.length || forbidden.length || bridge) {
    console.log(`✗ ${check.route} — missing: ${missing.join(', ') || '—'} forbidden: ${forbidden.join(', ') || '—'} bridge: ${bridge}`);
    wrongCount += 1;
  } else {
    console.log(`✓ ${check.route}`);
  }
}

if (wrongCount > 0) fail(`${wrongCount} falsche new/edit/bridge Routen`);

console.log('\n✓ navigation:audit bestanden\n');
process.exit(0);
