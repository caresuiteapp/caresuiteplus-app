#!/usr/bin/env node
/**
 * Dry-run inventory for Leistungsnachweis layout v2 backfill.
 * Usage: node scripts/audit/leistungsnachweis-v2-backfill.mjs [--write]
 * Default: dry-run only (no DB writes).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const WRITE = process.argv.includes('--write');
const outDir = path.join(process.cwd(), 'docs/audit/leistungsnachweis-v2');

const report = {
  mode: WRITE ? 'write' : 'dry-run',
  generatedAt: new Date().toISOString(),
  totals: {
    proofsKnown: 'requires Supabase credentials — run against target env',
    dynamicallyRenderable: 'snapshot + visitId present',
    missingSourceData: 'no payload_snapshot or empty clientName',
    missingLogo: 'no tenant logo in branding/settings',
    withTaskDeviations: 'non-done fachliche tasks in snapshot',
  },
  note:
    'This script is a scaffold. Connect Supabase in maintenance window to count assist_visit_proofs rows. No writes unless --write is passed.',
};

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'backfill-dry-run.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (WRITE) {
  console.error('WRITE mode requested — no automated migration implemented; manual review required.');
  process.exit(1);
}
