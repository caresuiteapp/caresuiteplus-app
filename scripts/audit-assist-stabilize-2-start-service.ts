#!/usr/bin/env npx tsx
/**
 * ASSIST.STABILIZE.2 — startService production blocker audit.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname ?? '.', '..');
const OUT = join(ROOT, 'docs/audit/assist-stabilize-2-start-service-audit-output.md');

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

check('AS2-01', 'Preflight doc', fileExists('docs/audit/assist-stabilize-2-start-service-preflight.md'), 'preflight');
check('AS2-02', 'startService readback verify', fileContains('src/features/assistWorkflow/startService.ts', 'verifyStartServiceReadback'), 'readback');
check('AS2-03', 'START_SERVICE error codes', fileContains('src/features/assistWorkflow/assistWorkflowErrors.ts', 'START_SERVICE_TIMEOUT'), 'errors');
check('AS2-04', 'No infinite repair recursion', fileContains('src/features/assistWorkflow/startService.ts', 'MAX_REPAIR_DEPTH'), 'recursion guard');
check('AS2-05', 'service_start event type', fileContains('src/features/assistWorkflow/startService.ts', "'service_start'"), 'event type');
check('AS2-06', 'execution_state upsert awaited', fileContains('src/features/assistWorkflow/startService.ts', 'applyExecutionStateAfterStart'), 'upsert');
check('AS2-07', 'withWorkflowTimeout helper', fileExists('src/features/assistWorkflow/internal/withWorkflowTimeout.ts'), 'timeout');
check('AS2-08', 'Hook try/finally loading', fileContains('src/hooks/useEmployeePortalVisitExecution.ts', 'finally'), 'hook');
check('AS2-09', 'Hook startServiceLoading', fileContains('src/hooks/useEmployeePortalVisitExecution.ts', 'startServiceLoading'), 'hook');
check('AS2-10', 'Screen per-button start loading', fileContains('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx', 'startServiceLoading'), 'screen');
check('AS2-11', 'Refetch timeout warning', fileContains('src/hooks/useEmployeePortalVisitExecution.ts', 'refetchWarning'), 'refetch');
check('AS2-12', 'Unit tests stabilize2', fileExists('src/__tests__/assistWorkflow/assistStabilize2StartService.test.ts'), 'vitest');
check('AS2-13', 'Migration 0213 enum fix present', fileExists('supabase/migrations/0213_fix_repair_assist_visit_workflow_status_enum_cast.sql'), '0213');
check('AS2-14', '0210 time proof columns', fileContains('supabase/migrations/0210_assist_workflow_2_time_proof.sql', 'service_started_at'), '0210');
check('AS2-15', 'STABILIZE.1 baseline intact', fileExists('src/features/assistWorkflow/repairWorkflowState.ts'), 'stabilize1');
check('AS2-16', 'Abnahmebericht', fileExists('docs/audit/assist-stabilize-2-start-service-abnahmebericht.md'), 'abnahme');

const passed = checks.filter((c) => c.ok).length;
const failed = checks.filter((c) => !c.ok);

const lines = [
  '# ASSIST.STABILIZE.2 — Audit Output',
  '',
  `**Generated:** ${new Date().toISOString()}`,
  '',
  `**Result:** ${passed}/${checks.length} passed`,
  '',
  '| ID | Check | OK | Detail |',
  '|---|---|---|---|',
  ...checks.map((c) => `| ${c.id} | ${c.label} | ${c.ok ? '✓' : '✗'} | ${c.detail} |`),
  '',
];

if (failed.length) {
  lines.push('## Failed checks', '');
  for (const f of failed) {
    lines.push(`- **${f.id}** ${f.label}: ${f.detail}`);
  }
}

writeFileSync(OUT, lines.join('\n'), 'utf8');

console.log('\n=== ASSIST.STABILIZE.2 Audit ===\n');
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} [${c.id}] ${c.label}`);
}
console.log(`\nOutput: ${OUT}`);
console.log(`Ergebnis: ${passed}/${checks.length} bestanden\n`);
process.exit(failed.length > 0 ? 1 : 0);
