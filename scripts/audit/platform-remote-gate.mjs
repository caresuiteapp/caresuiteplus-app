#!/usr/bin/env node
/**
 * CareSuite+ Platform Console — Remote Gate Verification (Staging)
 *
 * Default: dry-run checklist only.
 * Apply migrations: --apply --confirm --project-ref=shwpweerzsfkqaivmaoc
 *
 * Requires: supabase CLI logged in and linked, or SUPABASE_ACCESS_TOKEN.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

const PLATFORM_MIGRATIONS = [
  {
    file: '0246_platform_console_foundation_live.sql',
    name: 'platform_console_foundation_live',
  },
  {
    file: '0247_platform_tenant_module_access_live.sql',
    name: 'platform_tenant_module_access_live',
  },
];

const PLATFORM_TABLES = [
  'platform_users',
  'platform_tenants',
  'platform_modules',
  'platform_tenant_modules',
  'platform_plans',
  'platform_tenant_plans',
  'platform_discounts',
  'platform_tenant_discounts',
  'platform_invoices',
  'platform_payments',
  'platform_feature_flags',
  'platform_support_sessions',
  'platform_audit_log',
  'platform_system_settings',
];

const PLATFORM_RPCS = [
  'platform_get_current_user',
  'platform_get_dashboard_summary',
  'platform_list_tenants',
  'platform_get_tenant_detail',
  'platform_update_tenant_status',
  'platform_set_tenant_module',
  'platform_assign_plan',
  'platform_write_audit_log',
  'tenant_list_platform_modules',
  'tenant_has_platform_module',
];

function maskUrl(url) {
  if (!url) return '(nicht konfiguriert)';
  if (url.length <= 24) return `${url.slice(0, 8)}…`;
  return `${url.slice(0, 16)}…${url.slice(-10)}`;
}

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const confirm = argv.includes('--confirm');
  const projectRefArg = argv.find((a) => a.startsWith('--project-ref='));
  const projectRef = projectRefArg?.split('=')[1] ?? 'shwpweerzsfkqaivmaoc';
  return { apply, confirm, projectRef };
}

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: opts.inherit ? 'inherit' : 'pipe', ...opts });
}

function sqlQuoteIdent(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

function main() {
  const { apply, confirm, projectRef } = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

  console.log('=== CareSuite+ Platform Remote Gate ===');
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`Target project ref: ${projectRef}`);
  console.log(`Supabase URL (maskiert): ${maskUrl(supabaseUrl)}`);
  console.log(`Demo Mode: ${demoMode ? 'true' : 'false'}`);
  console.log(`Migration count (local files): ${PLATFORM_MIGRATIONS.length}`);
  console.log('');

  for (const mig of PLATFORM_MIGRATIONS) {
    const full = path.join(root, 'supabase', 'migrations', mig.file);
    if (!existsSync(full)) {
      console.error(`FEHLT: ${mig.file}`);
      process.exit(1);
    }
    console.log(`✓ Migration vorhanden: ${mig.file} (${readFileSync(full, 'utf8').length} bytes)`);
  }

  if (!apply) {
    console.log('\nDry-run — keine DB-Änderung.');
    console.log('Anwenden: node scripts/audit/platform-remote-gate.mjs --apply --confirm --project-ref=shwpweerzsfkqaivmaoc');
    return;
  }

  if (!confirm) {
    console.error('\nBLOCKED: --apply erfordert --confirm');
    process.exit(2);
  }

  console.log('\n=== Migration Apply (supabase db push) ===');
  try {
    run(`supabase link --project-ref ${projectRef}`, { stdio: 'inherit' });
  } catch {
    console.warn('supabase link fehlgeschlagen oder bereits verlinkt — fahre fort');
  }

  for (const mig of PLATFORM_MIGRATIONS) {
    const sql = readFileSync(path.join(root, 'supabase', 'migrations', mig.file), 'utf8');
    const tmp = path.join(root, '.tmp-platform-migration.sql');
    require('node:fs').writeFileSync(tmp, sql);
    console.log(`→ wende an: ${mig.file}`);
    run(`supabase db execute --file "${tmp}" --project-ref ${projectRef}`, { stdio: 'inherit' });
  }

  console.log('\n=== Post-Apply Verification SQL (manuell / MCP) ===');
  console.log('Tabellen:');
  for (const t of PLATFORM_TABLES) {
    console.log(`  SELECT to_regclass('public.${t}');`);
  }
  console.log('\nRLS:');
  console.log(`  SELECT relname, relrowsecurity FROM pg_class WHERE relname LIKE 'platform_%';`);
  console.log('\nRPCs:');
  for (const rpc of PLATFORM_RPCS) {
    console.log(`  SELECT proname FROM pg_proc WHERE proname = '${rpc}';`);
  }
  console.log('\nOwner bootstrap (manuell — echte auth.users UUID):');
  console.log(`  INSERT INTO platform_users (user_id, email, full_name, role, status) VALUES (...);`);
}

main();
