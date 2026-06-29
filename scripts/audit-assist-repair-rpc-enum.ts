#!/usr/bin/env npx tsx
/**
 * ASSIST.STABILIZE.1.0213 — RPC enum cast fix audit (static + optional live Supabase).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname ?? '.', '..');
type CheckResult = { id: string; label: string; ok: boolean; detail: string };
const checks: CheckResult[] = [];

function check(id: string, label: string, ok: boolean, detail: string) {
  checks.push({ id, label, ok, detail });
}

function fileExists(rel: string): boolean {
  return existsSync(join(ROOT, rel));
}

function fileContains(rel: string, needle: string): boolean {
  if (!fileExists(rel)) return false;
  return readFileSync(join(ROOT, rel), 'utf8').includes(needle);
}

const mig213 = 'supabase/migrations/0213_fix_repair_assist_visit_workflow_status_enum_cast.sql';

check('RPC-01', 'Migration 0213 exists', fileExists(mig213), 'missing file');
check('RPC-02', 'Fix marker 0213', fileContains(mig213, 'ASSIST.STABILIZE.1.0213'), 'marker');
check('RPC-03', 'normalize helper', fileContains(mig213, 'normalize_assist_workflow_repair_status'), 'helper');
check('RPC-04', 'Enum cast not blind text', fileContains(mig213, 'v_status.assignment_enum'), 'cast');
check('RPC-05', 'Invalid status EXCEPTION', fileContains(mig213, 'Invalid repair target status'), 'validate');
check('RPC-06', 'in-service guard', fileContains(mig213, 'service_started_at'), 'guard');
check('RPC-07', 'Admin override flag', fileContains(mig213, 'p_allow_service_without_timestamp'), 'admin flag');
check('RPC-08', 'German status column', fileContains(mig213, 'v_status.german_status'), 'german');
check('RPC-09', 'Visit text status', fileContains(mig213, 'v_status.visit_status'), 'visit');
check('RPC-10', 'Audit log insert', fileContains(mig213, 'assignment_audit_events'), 'audit');
check('RPC-11', 'Audit columns kept', fileContains(mig213, 'workflow_consistency_status'), 'audit cols');
check('RPC-12', 'SECURITY DEFINER', fileContains(mig213, 'SECURITY DEFINER'), 'definer');
check('RPC-13', 'No timestamp invention', !fileContains(mig213, 'on_the_way_at =') && !fileContains(mig213, 'arrived_at ='), 'no times');
check('RPC-14', 'en_route alias', fileContains(mig213, 'en_route'), 'en_route');
check('RPC-15', 'angekommen mapping', fileContains(mig213, "'angekommen'"), 'angekommen');

async function runLiveChecks() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    check('RPC-L01', 'Live Supabase (skipped)', true, 'no credentials — static checks only');
    return;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: normRows, error: normErr } = await supabase.rpc(
    'normalize_assist_workflow_repair_status',
    { p_target_status: 'angekommen' },
  );

  check(
    'RPC-L02',
    'normalize RPC live (angekommen→arrived)',
    !normErr && Array.isArray(normRows) && normRows.length > 0,
    normErr?.message ?? JSON.stringify(normRows),
  );

  const { error: invalidErr } = await supabase.rpc('repair_assist_visit_workflow_status', {
    p_tenant_id: '00000000-0000-0000-0000-000000000001',
    p_assignment_id: '00000000-0000-0000-0000-000000000002',
    p_target_status: 'bogus_status_xyz',
  });

  check(
    'RPC-L03',
    'Invalid status rejected live',
    Boolean(invalidErr?.message?.includes('Invalid repair target status')),
    invalidErr?.message ?? 'no error returned',
  );
}

async function main() {
  await runLiveChecks();

  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.filter((c) => !c.ok);

  console.log('\n=== ASSIST.STABILIZE.1.0213 Repair RPC Enum Audit ===\n');
  for (const c of checks) {
    console.log(`${c.ok ? '✓' : '✗'} [${c.id}] ${c.label}`);
    if (!c.ok) console.log(`    → ${c.detail}`);
  }
  console.log(`\nErgebnis: ${passed}/${checks.length} bestanden\n`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
