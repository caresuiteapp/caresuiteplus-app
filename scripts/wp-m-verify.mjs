#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { M_WP_CATALOG } from './wp-m-catalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const missing = M_WP_CATALOG.filter((entry) => !existsSync(join(root, entry.deliverable)));

console.log(`CareSuite+ M-WP Verify: ${M_WP_CATALOG.length} Pakete\n`);

if (missing.length === 0) {
  console.log(`✓ Alle ${M_WP_CATALOG.length} M-Arbeitspakete haben ihre Deliverables.\n`);
  process.exit(0);
}

console.error(`✗ ${missing.length} fehlende Deliverables:\n`);
for (const entry of missing) {
  console.error(`  WP${String(entry.wp).padStart(3, '0')} — ${entry.topic}`);
  console.error(`    ${entry.deliverable}\n`);
}
process.exit(1);
