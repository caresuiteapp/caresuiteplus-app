#!/usr/bin/env node
/**
 * Audits the 104 Arbeitsplan pages (seiten_index.csv) against strict completion rules.
 * Run: node scripts/arbeitsplan-route-audit.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = join(root, 'app');
const csvPath = join(root, 'docs/arbeitsplan/seiten_index.csv');

function walkDir(dir, segments, index) {
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
    const via = walkDir(join(dir, exactDir.name), segments, index + 1);
    if (via) return via;
  }
  const exactFile = entries.find((e) => e.isFile() && e.name === `${seg}.tsx`);
  if (exactFile) return join(dir, exactFile.name);
  const dynamic = entries.find((e) => e.isDirectory() && e.name.startsWith('['));
  if (dynamic) return walkDir(join(dir, dynamic.name), segments, index + 1);
  const group = entries.find((e) => e.isDirectory() && e.name.startsWith('('));
  if (group) {
    const via = walkDir(join(dir, group.name), segments, index);
    if (via) return via;
  }
  return null;
}

function findRouteFile(routePath) {
  const segments = routePath.replace(/^\//, '').split('/').filter(Boolean);
  return walkDir(appRoot, segments, 0);
}

const BAD = [
  { re: /DedicatedListScreen/, label: 'generic_list' },
  { re: /DomainCreateScreen/, label: 'generic_create' },
  { re: /In Vorbereitung|Coming Soon/, label: 'prepared_marker' },
  { re: /preparedOnly:\s*true/, label: 'prepared_only' },
  { re: /EinzelseitenBridgeRoute/, label: 'bridge_route' },
  { re: /titleOverride/, label: 'title_alias' },
  { re: /SisPreparedFormScreen/, label: 'sis_prepared_form' },
];

/** Screen-type expectations for /new and /edit routes */
const SCREEN_TYPE_RULES = [
  { route: '/pflege/wunden/new', must: ['WoundCreateScreen', 'createWoundDocumentation'], mustNot: ['ListScreen'] },
  { route: '/pflege/berichte/new', must: ['PflegeberichtErstellenScreen'], mustNot: ['ListScreen'] },
  { route: '/pflege/dienstplaene/new', must: ['ShiftScheduleCreateScreen'], mustNot: ['ListScreen'] },
  { route: '/pflege/sis/new', must: ['SisFormScreen'], mustNot: ['SisPreparedFormScreen'] },
  { route: '/assist/einsaetze/new', must: ['AssignmentCreateScreen'], mustNot: ['ListScreen', 'DetailScreen'] },
  { route: '/beratung/faelle/new', must: ['BeratungFallAnlegenScreen', 'createCounselingCase'], mustNot: ['ListScreen'] },
  { route: '/assist/einsaetze/assign-001/edit', must: ['AssignmentEditScreen'], mustNot: ['AssignmentDetailScreen'] },
  { route: '/beratung/faelle/case-001/edit', must: ['CaseEditScreen'], mustNot: ['CaseDetailScreen'] },
  { route: '/pflege/planung/plan-001/edit', must: ['CarePlanEditScreen'], mustNot: ['CarePlanDetailScreen'] },
  { route: '/business/office/clients/client-001/edit', must: ['ClientEditScreen'], mustNot: [] },
  { route: '/business/office/employees/employee-001/edit', must: ['EmployeeEditScreen'], mustNot: [] },
];

const lines = readFileSync(csvPath, 'utf8').trim().split('\n').slice(1);
const pages = lines.map((l) => {
  const [nr, modul, route, titel] = l.split(';');
  return { nr, modul, route, titel };
});

const results = { ok: [], partial: [], bridge: [], missing: [], screenType: [] };

for (const p of pages) {
  const file = findRouteFile(p.route);
  if (!file) {
    results.missing.push(p);
    continue;
  }
  let src = readFileSync(file, 'utf8');
  const m = src.match(/from '@\/screens\/([^']+)'/);
  if (m) {
    const sp = join(root, 'src/screens', `${m[1]}.tsx`);
    if (existsSync(sp)) src += `\n${readFileSync(sp, 'utf8')}`;
  }
  const issues = BAD.filter(({ re }) => re.test(src)).map(({ label }) => label);
  if (issues.some((i) => i === 'bridge_route' || i === 'title_alias')) {
    results.bridge.push({ ...p, file: file.replace(root + '\\', ''), issues });
  } else if (issues.length) {
    results.partial.push({ ...p, file: file.replace(root + '\\', ''), issues });
  } else {
    results.ok.push(p);
  }
}

for (const rule of SCREEN_TYPE_RULES) {
  const file = findRouteFile(rule.route);
  if (!file) {
    results.screenType.push({ route: rule.route, issue: 'missing_route' });
    continue;
  }
  let src = readFileSync(file, 'utf8');
  const m = src.match(/from '@\/screens\/([^']+)'/);
  if (m) {
    const sp = join(root, 'src/screens', `${m[1]}.tsx`);
    if (existsSync(sp)) src += `\n${readFileSync(sp, 'utf8')}`;
  }
  const missing = rule.must.filter((token) => !src.includes(token));
  const forbidden = rule.mustNot.filter((token) => src.includes(token));
  if (missing.length || forbidden.length) {
    results.screenType.push({
      route: rule.route,
      issue: `missing:${missing.join(',') || '-'} forbidden:${forbidden.join(',') || '-'}`,
    });
  }
}

console.log('CareSuite+ Arbeitsplan Audit (104 Seiten)\n');
console.log(`✓ OK: ${results.ok.length}`);
console.log(`◐ Partial: ${results.partial.length}`);
console.log(`↷ Bridge/Alias: ${results.bridge.length}`);
console.log(`✗ Missing: ${results.missing.length}`);
console.log(`✗ Screen-Typ: ${results.screenType.length}`);

if (results.screenType.length) {
  console.log('\nScreen-Typ (new/edit):');
  for (const s of results.screenType) console.log(`  ${s.route} — ${s.issue}`);
}

if (results.partial.length) {
  console.log('\nPartial:');
  for (const p of results.partial) console.log(`  ${p.nr} ${p.route} — ${p.issues.join(', ')}`);
}
if (results.bridge.length) {
  console.log('\nBridge/Alias:');
  for (const p of results.bridge) console.log(`  ${p.nr} ${p.route} — ${p.issues.join(', ')}`);
}
if (results.missing.length) {
  console.log('\nMissing:');
  for (const p of results.missing) console.log(`  ${p.nr} ${p.route}`);
}

process.exit(
  results.partial.length +
    results.missing.length +
    results.bridge.length +
    results.screenType.length >
    0
    ? 1
    : 0,
);
