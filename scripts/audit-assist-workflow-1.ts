#!/usr/bin/env npx tsx
/**
 * ASSIST.WORKFLOW.1 — Employee visit execution workflow audit (20 checks).
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

check('AWF-01', 'Preflight doc', fileExists('docs/audit/assist-workflow-1-preflight.md'), 'preflight');
check('AWF-02', 'State machine', fileExists('src/features/assistWorkflow/assistVisitStateMachine.ts'), 'transitions');
check('AWF-03', 'Migration 0203', fileExists('supabase/migrations/0203_assist_visit_execution_workflow.sql'), 'DDL');
check('AWF-04', 'resolveAssistExecutionContext', fileExists('src/features/assistWorkflow/resolveAssistExecutionContext.ts'), 'context');
check('AWF-05', 'startEnRoute uses live tracking', fileContains('src/features/assistWorkflow/startEnRoute.ts', 'startEmployeeLiveTracking'), 'no GPS dup');
check('AWF-06', 'markArrived', fileExists('src/features/assistWorkflow/markArrived.ts'), 'arrive');
check('AWF-07', 'Pause services', fileExists('src/features/assistWorkflow/startPause.ts') && fileExists('src/features/assistWorkflow/endPause.ts'), 'pause');
check('AWF-08', 'saveTaskResults', fileExists('src/features/assistWorkflow/saveTaskResults.ts'), 'tasks');
check('AWF-09', 'saveVisitDocumentation', fileExists('src/features/assistWorkflow/saveVisitDocumentation.ts'), 'documentation');
check('AWF-10', 'saveClientSignature', fileExists('src/features/assistWorkflow/saveClientSignature.ts'), 'signature');
check('AWF-11', 'generateServiceRecord', fileExists('src/features/assistWorkflow/generateServiceRecord.ts'), 'proof');
check('AWF-12', 'finalizeVisit', fileExists('src/features/assistWorkflow/finalizeVisit.ts'), 'finalize');
check('AWF-13', 'reportNoShow note required', fileContains('src/features/assistWorkflow/reportNoShow.ts', 'AWF_NO_SHOW_NOTE_REQUIRED'), 'no_show');
check('AWF-14', 'Workflow errors', fileExists('src/features/assistWorkflow/assistWorkflowErrors.ts'), 'diagnostics');
check('AWF-15', 'calculateVisitTimes', fileExists('src/features/assistWorkflow/calculateVisitTimes.ts'), 'times');
check('AWF-16', 'Portal integration read', fileExists('src/features/assistWorkflow/readExecutionStatusForPortals.ts'), 'office/client');
check('AWF-17', 'Hook wired', fileContains('src/hooks/useEmployeePortalVisitExecution.ts', 'features/assistWorkflow'), 'hook');
check('AWF-18', 'Timeline UI', fileExists('src/components/portal/EmployeePortalVisitWorkflowTimeline.tsx'), 'timeline');
check('AWF-19', 'Unit tests', fileExists('src/__tests__/assistWorkflow/assistVisitStateMachine.test.ts'), 'vitest');
check('AWF-20', 'Abnahmebericht', fileExists('docs/audit/assist-workflow-1-abnahmebericht.md'), 'abnahme');

const passed = checks.filter((c) => c.ok).length;
const failed = checks.filter((c) => !c.ok);

console.log('\n=== ASSIST.WORKFLOW.1 Audit ===\n');
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} [${c.id}] ${c.label}`);
  if (!c.ok) console.log(`    → ${c.detail}`);
}
console.log(`\nErgebnis: ${passed}/${checks.length} bestanden\n`);
process.exit(failed.length > 0 ? 1 : 0);
