#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED = [
  'src/lib/catalogs/systemCatalogs.ts',
  'src/lib/catalogs/systemCatalog.types.ts',
  'src/lib/catalogs/systemCatalogService.ts',
];

const CATALOG_KEYS = [
  'leistungsart',
  'care_level',
  'cost_bearer_type',
  'document_category',
  'consent_type',
  'medication_unit',
  'intake_schedule',
  'risk_type',
  'vital_type',
];

function fail(msg) {
  console.error(`\n✗ catalog:audit fehlgeschlagen: ${msg}\n`);
  process.exit(1);
}

console.log('CareSuite+ catalog:audit\n');

for (const rel of REQUIRED) {
  if (!existsSync(join(root, rel))) fail(`Fehlende Datei: ${rel}`);
}

const catalogs = readFileSync(join(root, 'src/lib/catalogs/systemCatalogs.ts'), 'utf8');
for (const key of CATALOG_KEYS) {
  if (!catalogs.includes(`${key}:`)) fail(`Katalog „${key}" fehlt`);
}

if (!catalogs.includes('ALL_CATALOG_KEYS')) fail('ALL_CATALOG_KEYS fehlt');

console.log('✓ catalog:audit bestanden\n');
