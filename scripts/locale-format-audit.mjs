#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED = [
  'src/lib/i18n/locale.ts',
  'src/lib/formatters/dateTimeFormatters.ts',
  'src/lib/formatters/numberFormatters.ts',
  'src/lib/formatters/unitFormatters.ts',
];

const FORBIDDEN = [/MM\/DD\/YYYY/gi, /\bAM\b/g, /\bPM\b/g, /Jun \d+/];

function fail(msg) {
  console.error(`\n✗ locale:audit fehlgeschlagen: ${msg}\n`);
  process.exit(1);
}

function walk(dir, files = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') walk(p, files);
    else if (e.isFile() && e.name.endsWith('.ts')) files.push(p);
  }
  return files;
}

console.log('CareSuite+ locale:audit\n');

for (const rel of REQUIRED) {
  if (!existsSync(join(root, rel))) fail(`Fehlende Datei: ${rel}`);
}

const locale = readFileSync(join(root, 'src/lib/i18n/locale.ts'), 'utf8');
if (!locale.includes("'de-DE'")) fail('APP_LOCALE de-DE fehlt');
if (!locale.includes('Europe/Berlin')) fail('APP_TIME_ZONE fehlt');
if (!locale.includes("'EUR'")) fail('APP_CURRENCY fehlt');

const dateFmt = readFileSync(join(root, 'src/lib/formatters/dateTimeFormatters.ts'), 'utf8');
if (!dateFmt.includes('formatDate')) fail('formatDate fehlt');
if (!dateFmt.includes('formatTime')) fail('formatTime fehlt');

const numFmt = readFileSync(join(root, 'src/lib/formatters/numberFormatters.ts'), 'utf8');
if (!numFmt.includes('formatCurrency')) fail('formatCurrency fehlt');

const unitFmt = readFileSync(join(root, 'src/lib/formatters/unitFormatters.ts'), 'utf8');
if (!unitFmt.includes('formatCareLevel')) fail('formatCareLevel fehlt');

const formatterFiles = walk(join(root, 'src/lib/formatters'));
for (const file of formatterFiles) {
  const content = readFileSync(file, 'utf8');
  for (const re of FORBIDDEN) {
    if (re.test(content)) fail(`Verdächtiges US-Format in ${file}`);
  }
}

console.log('✓ locale:audit bestanden\n');
