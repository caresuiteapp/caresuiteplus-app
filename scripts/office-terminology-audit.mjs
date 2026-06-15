#!/usr/bin/env node
/**
 * Office terminology audit — fails if forbidden OfficeCore labels appear in user-facing paths.
 *
 * Allowed internal identifiers (excluded paths / allowlisted line patterns):
 * - src/lib/officeCore/** (folder, service names)
 * - import/export paths, type names (OfficeCoreStats, fetchOfficeCoreStats, etc.)
 * - supabase/migrations/** (SQL column/table names)
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const FORBIDDEN = [
  /OfficeCore/gi,
  /CareSuite\+\s*OfficeCore/gi,
  /Core\s+Office/gi,
  /Office-Core/gi,
  /office_core/gi,
  /zentrale\s+Core-Verwaltung/gi,
];

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.md', '.mjs', '.js', '.json']);

const EXCLUDED_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.git',
  '.expo',
  'officeCore',
]);

const EXCLUDED_PATH_PREFIXES = [
  'src/lib/officeCore',
  'supabase/migrations',
];

const EXCLUDED_FILES = new Set([
  'scripts/office-terminology-audit.mjs',
  'scripts/_bulk-office-terminology-docs.mjs',
  'scripts/generate-full-wp-catalog.mjs',
  'docs/audit/office-terminology-correction-report.md',
]);

const USER_FACING_ROOTS = [
  'src/screens',
  'src/components',
  'src/data/demo',
  'src/design',
  'src/lib/navigation',
  'src/lib/office',
  'src/lib/billing',
  'src/lib/insight',
  'app',
  'docs',
  'scripts',
  'src/__tests__',
  'README.md',
];

const LINE_ALLOWLIST = [
  /^\s*import\s/,
  /^\s*export\s.*from\s/,
  /from\s+['"]@\/lib\/officeCore/,
  /officeCoreDemoRepository/,
  /officeCoreSupabaseRepository/,
  /fetchOfficeCoreStats/,
  /OfficeCoreStats/,
  /officeCoreAssignments/,
  /officeCoreService/,
  /141-160-office-core\.md/,
  /02_ARCHITEKTUR_OFFICECORE\.md/,
  /office-terminology-audit/,
  /FORBIDDEN/,
  /EXCLUDED_PATH_PREFIXES/,
  /officeCore\//,
  /includes\('officeCore'\)/,
  /filter\(\(f\).*officeCore/,
];

function fail(message) {
  console.error(`\n✗ office:terminology:audit fehlgeschlagen:\n${message}\n`);
  process.exit(1);
}

function isExcluded(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  if (EXCLUDED_FILES.has(normalized)) return true;
  if (EXCLUDED_PATH_PREFIXES.some((p) => normalized.startsWith(p))) return true;
  const parts = normalized.split('/');
  return parts.some((part) => EXCLUDED_DIR_NAMES.has(part));
}

function collectFiles(dirRel, out = []) {
  const abs = join(root, dirRel);
  if (!existsSync(abs)) return out;

  const stat = statSync(abs);
  if (stat.isFile()) {
    const normalized = dirRel.replace(/\\/g, '/');
    const ext = dirRel.slice(dirRel.lastIndexOf('.'));
    if (SCAN_EXTENSIONS.has(ext) && !isExcluded(normalized)) out.push(normalized);
    return out;
  }

  for (const entry of readdirSync(abs)) {
    const childRel = join(dirRel, entry).replace(/\\/g, '/');
    if (isExcluded(childRel)) continue;
    const childAbs = join(root, childRel);
    const childStat = statSync(childAbs);
    if (childStat.isDirectory()) {
      collectFiles(childRel, out);
    } else {
      const ext = entry.slice(entry.lastIndexOf('.'));
      const normalized = childRel.replace(/\\/g, '/');
      if (SCAN_EXTENSIONS.has(ext) && !isExcluded(normalized)) out.push(normalized);
    }
  }
  return out;
}

function lineAllowed(line) {
  return LINE_ALLOWLIST.some((re) => re.test(line));
}

function scanFile(relPath) {
  const content = readFileSync(join(root, relPath), 'utf8');
  const hits = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (lineAllowed(line)) continue;

    for (const pattern of FORBIDDEN) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        hits.push({ line: i + 1, text: line.trim(), pattern: pattern.source });
        break;
      }
    }
  }

  return hits;
}

console.log('CareSuite+ office:terminology:audit\n');

const files = [];
for (const scanRoot of USER_FACING_ROOTS) {
  collectFiles(scanRoot, files);
}

const violations = [];
for (const file of files) {
  const hits = scanFile(file);
  if (hits.length > 0) violations.push({ file, hits });
}

if (violations.length > 0) {
  const report = violations
    .map(({ file, hits }) => {
      const details = hits.map((h) => `  Zeile ${h.line}: ${h.text}`).join('\n');
      return `${file}\n${details}`;
    })
    .join('\n\n');
  fail(
    `Verbotene Office-Terminologie in nutzer-sichtbaren Pfaden gefunden:\n\n${report}\n\n` +
      'Erlaubt: CareSuite+ Office, Office, zentrale Verwaltung, Verwaltungsbereich.\n' +
      'Verboten: OfficeCore, Core Office, Office-Core, zentrale Core-Verwaltung.',
  );
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['office:terminology:audit']) {
  fail('package.json: office:terminology:audit Script fehlt');
}

console.log(`✓ ${files.length} nutzer-sichtbare Dateien gescannt`);
console.log('✓ Keine verbotenen OfficeCore-Begriffe gefunden');
console.log('✓ Terminologie: CareSuite+ Office / Office\n');
