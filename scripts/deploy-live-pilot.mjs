#!/usr/bin/env node
/**
 * CareSuite+ Live-Pilot Deployment
 * Schritte 1–4: link, db push, types, pilot SQL, quality gates
 *
 * Voraussetzungen:
 *   supabase login
 *   .env mit EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
 *
 * Usage:
 *   node scripts/deploy-live-pilot.mjs --project-ref euagyyztvmemuaiumvxm
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const projectRef = process.argv.find((a) => a.startsWith('--project-ref='))?.split('=')[1]
  ?? process.env.SUPABASE_PROJECT_REF
  ?? 'euagyyztvmemuaiumvxm';

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });
}

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!existsSync(envPath)) {
    console.warn('⚠ .env fehlt — kopiere .env.example und trage Live-Werte ein.');
    return;
  }
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

console.log('CareSuite+ Live-Pilot Deployment');
console.log(`Project ref: ${projectRef}`);
console.log('\n⚠ Hinweis: Dieses Script führt automatisch supabase db push aus.');
console.log('  Für sicheren Review zuerst: npm run apply:live-migrations');
console.log('  Siehe docs/deployment/apply-live-migrations-0021-0030.md\n');

loadEnv();

try {
  run(`npx supabase link --project-ref ${projectRef}`);
} catch {
  console.warn('Link fehlgeschlagen — evtl. bereits verlinkt oder supabase login nötig.');
}

run('npx supabase migration list --linked');
run('npx supabase db push');

const typesPath = path.join(root, 'src', 'lib', 'supabase', 'database.types.ts');
run(`npx supabase gen types typescript --linked > "${typesPath}"`);

console.log('\nPilot-Mandanten SQL manuell oder via MCP execute_sql:');
console.log('  docs/pilot/pilot-tenants-setup-production.sql');
console.log('Live-Backfill (trips, care_records, catalogs, reporting):');
console.log('  npm run seed:live-pilot');
console.log('  docs/pilot/seed-live-pilot.sql');

run('npm run typecheck');
run('npm run test');

process.env.EXPO_PUBLIC_DEMO_MODE = 'false';
run('npm run smoke', { env: { ...process.env, EXPO_PUBLIC_DEMO_MODE: 'false' } });

console.log('\n✓ Live-Pilot Deployment-Script abgeschlossen.');
console.log('Manuell prüfen: Auth-User, profiles.tenant_id, E2E in der App.');
