#!/usr/bin/env node
/**
 * CareSuite+ — Safe Remote Apply for Migrations 0021–0033 (Sprint 46/49/58/72)
 *
 * Default: checklist + dry-run (NO database changes).
 * Apply only with explicit --confirm after reviewing migration list.
 *
 * These migrations are additive (ALTER ADD COLUMN, CREATE TABLE/INDEX).
 * No DROP TABLE / TRUNCATE / DELETE in 0021–0031.
 *
 * Prerequisites:
 *   supabase login
 *   supabase link --project-ref <ref>
 *
 * Usage:
 *   node scripts/apply-live-migrations.mjs
 *   node scripts/apply-live-migrations.mjs --list
 *   node scripts/apply-live-migrations.mjs --apply --confirm --project-ref=euagyyztvmemuaiumvxm
 *
 * After apply:
 *   npm run seed:live-pilot -- --write-sql
 *   npm run fetch-remote-types
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const TARGET_MIGRATIONS = [
  {
    file: '0021_trips_live_list_fields.sql',
    summary: 'trips Live-Listen-Felder (employee_name, vehicle_label, purpose, started_at, ended_at)',
  },
  {
    file: '0022_trips_live_detail_fields.sql',
    summary: 'trips Live-Detail-Felder (Adressen, Notizen, Kilometer)',
  },
  {
    file: '0023_care_records_live_list_fields.sql',
    summary: 'care_records Live-Listen-Felder (Stationär Bewohner)',
  },
  {
    file: '0024_care_records_live_detail_fields.sql',
    summary: 'care_records Live-Detail-Felder (Stationär)',
  },
  {
    file: '0025_catalogs_live_list_fields.sql',
    summary: 'catalogs Live-Listen-Felder (Akademie Kurse)',
  },
  {
    file: '0026_catalogs_live_detail_fields.sql',
    summary: 'catalogs Live-Detail-Felder (Akademie)',
  },
  {
    file: '0027_reporting_reports_live_list.sql',
    summary: 'reporting_reports Live-Listen-Tabelle',
  },
  {
    file: '0028_reporting_reports_live_detail.sql',
    summary: 'reporting_reports Live-Detail-Felder',
  },
  {
    file: '0029_reporting_pdl_cockpit_live.sql',
    summary: 'reporting_pdl_cockpit Live-Snapshot',
  },
  {
    file: '0030_assist_tracking_dashboard_live.sql',
    summary: 'assist_tracking_dashboard Live-Snapshot',
  },
  {
    file: '0031_data_subject_requests.sql',
    summary: 'data_subject_requests DSGVO Betroffenenanfragen + RLS',
  },
  {
    file: '0032_data_subject_requests_admin_status_update.sql',
    summary: 'DSGVO Admin Status-UPDATE RLS (security.manage)',
  },
  {
    file: '0033_employees_live_detail_fields.sql',
    summary: 'employees Live-Detail-Felder (department, start_date, notes)',
  },
  {
    file: '0034_trip_gps_events_prepared.sql',
    summary: 'trip_gps_events GPS Backend-Prep (preparedOnly bis Live-Flip)',
  },
  {
    file: '0035_insight_center_prepared.sql',
    summary: 'InsightCenter Snapshots, Exports, Data Sources (preparedOnly)',
  },
  {
    file: '0036_module_extensions_prepared.sql',
    summary: 'Stationär/Akademie Extension-Tabellen (Wohnbereiche, Übergaben, Teilnahmen, Zertifikate)',
  },
];

function parseArg(name) {
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split('=')[1];
  return process.argv.includes(`--${name}`) ? true : undefined;
}

const projectRef =
  parseArg('project-ref') ?? process.env.SUPABASE_PROJECT_REF ?? 'euagyyztvmemuaiumvxm';
const listOnly = Boolean(parseArg('list'));
const apply = Boolean(parseArg('apply'));
const confirm = Boolean(parseArg('confirm'));

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });
}

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function printChecklist() {
  console.log('\n=== CareSuite+ Live-Migrationen 0021–0036 (Safe Apply Guide) ===\n');
  console.log('Status: Dieses Script führt standardmäßig KEINE DB-Änderungen aus.\n');
  console.log('Voraussetzungen:');
  console.log('  1. supabase login');
  console.log(`  2. supabase link --project-ref ${projectRef}`);
  console.log('  3. Backup / Staging-Review (empfohlen)');
  console.log('  4. Kein service_role im Frontend (.env nur EXPO_PUBLIC_SUPABASE_ANON_KEY)\n');
  console.log('Ziel-Migrationen (additiv, keine DROP/TRUNCATE/DELETE):');
  for (const m of TARGET_MIGRATIONS) {
    const exists = existsSync(path.join(root, 'supabase', 'migrations', m.file));
    console.log(`  ${exists ? '✓' : '✗'} ${m.file}`);
    console.log(`      ${m.summary}`);
  }
  console.log('\nEmpfohlener Ablauf:');
  console.log('  A) node scripts/apply-live-migrations.mjs --list');
  console.log('  B) Review: supabase migration list --linked');
  console.log('  C) node scripts/apply-live-migrations.mjs --apply --confirm');
  console.log('  D) npm run seed:live-pilot -- --write-sql  (Backfill SQL generieren)');
  console.log('  E) npm run fetch-remote-types');
  console.log('\nAlternativ (Dashboard): SQL-Editor → Dateien aus supabase/migrations/ nacheinander ausführen.');
  console.log('\n⚠ deploy-live-pilot.mjs führt automatisch db push aus — nur nach Review nutzen.');
  console.log('   Siehe docs/deployment/apply-live-migrations-0021-0030.md\n');
}

function verifyMigrationFiles() {
  const missing = TARGET_MIGRATIONS.filter(
    (m) => !existsSync(path.join(root, 'supabase', 'migrations', m.file)),
  );
  if (missing.length > 0) {
    console.error('Fehlende Migrationsdateien:');
    for (const m of missing) console.error(`  - ${m.file}`);
    process.exit(1);
  }
}

console.log('CareSuite+ Apply Live Migrations (0021–0034)');
console.log(`Project ref: ${projectRef}`);

loadEnv();
verifyMigrationFiles();

if (!apply && !listOnly) {
  printChecklist();
  console.log('Dry-run abgeschlossen — keine DB-Änderungen.');
  process.exit(0);
}

try {
  run(`npx supabase link --project-ref ${projectRef}`);
} catch {
  console.warn('Link fehlgeschlagen — evtl. bereits verlinkt oder supabase login nötig.');
}

run('npx supabase migration list --linked');

if (listOnly) {
  console.log('\n✓ Migration list angezeigt — keine DB-Änderungen.');
  process.exit(0);
}

if (apply && !confirm) {
  console.error('\n✗ Abgebrochen: --apply erfordert explizites --confirm nach Review.');
  console.error('  Beispiel: node scripts/apply-live-migrations.mjs --apply --confirm');
  process.exit(1);
}

console.log('\n=== APPLY: supabase db push (nur ausstehende Migrationen) ===');
console.log('Hinweis: db push wendet alle lokalen Migrationen an, die remote fehlen.');
console.log('0021–0034 sind additiv. Trotzdem: Remote-Backup empfohlen.\n');

run('npx supabase db push');

console.log('\nNächste Schritte:');
console.log('  npm run seed:live-pilot -- --write-sql');
console.log('  npm run fetch-remote-types');
console.log('  npm run typecheck && npm run test');
console.log('\n✓ Live-Migrationen 0021–0033 angewendet (via db push).');
