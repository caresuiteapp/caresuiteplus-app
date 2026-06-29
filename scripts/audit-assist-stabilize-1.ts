#!/usr/bin/env npx tsx
/**
 * ASSIST.STABILIZE.1 — Full employee visit workflow stabilization audit (24 checks).
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

check('AS1-01', 'Preflight doc', fileExists('docs/audit/assist-stabilize-1-stop-the-line-preflight.md'), 'preflight');
check('AS1-02', 'Migration 0212', fileExists('supabase/migrations/0212_assist_stabilize_1_workflow_repair.sql'), 'DDL');
check('AS1-03', 'repair RPC', fileContains('supabase/migrations/0212_assist_stabilize_1_workflow_repair.sql', 'repair_assist_visit_workflow_status'), 'rpc');
check('AS1-04', 'detectWorkflowInconsistencies', fileExists('src/features/assistWorkflow/detectWorkflowInconsistencies.ts'), 'detect');
check('AS1-05', 'repairWorkflowState', fileExists('src/features/assistWorkflow/repairWorkflowState.ts'), 'repair');
check('AS1-06', 'deriveWorkflowStatus', fileExists('src/features/assistWorkflow/deriveWorkflowStatus.ts'), 'derive');
check('AS1-07', 'derivedStatus in context', fileContains('src/features/assistWorkflow/types.ts', 'derivedStatus'), 'types');
check('AS1-08', 'consistencyStatus in context', fileContains('src/features/assistWorkflow/types.ts', 'consistencyStatus'), 'types');
check('AS1-09', 'inconsistencies in context', fileContains('src/features/assistWorkflow/types.ts', 'inconsistencies'), 'types');
check('AS1-10', 'resolveAssistExecutionContext derived', fileContains('src/features/assistWorkflow/resolveAssistExecutionContext.ts', 'deriveWorkflowStatus'), 'context');
check('AS1-11', 'autoRepair in context', fileContains('src/features/assistWorkflow/resolveAssistExecutionContext.ts', 'autoRepair'), 'context');
check('AS1-12', 'allowedActions derivedStatus', fileContains('src/features/assistWorkflow/resolveAllowedActions.ts', 'derivedStatus'), 'actions');
check('AS1-13', 'startService repair path', fileContains('src/features/assistWorkflow/startService.ts', 'repairWorkflowState'), 'startService');
check('AS1-14', 'adminRepairVisitWorkflow', fileExists('src/features/assistWorkflow/adminRepairVisitWorkflow.ts'), 'admin');
check('AS1-15', 'Hook uses derivedStatus', fileContains('src/hooks/useEmployeePortalVisitExecution.ts', 'derivedStatus'), 'hook');
check('AS1-16', 'Screen info not warning repair', fileContains('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx', "variant=\"info\""), 'screen');
check('AS1-17', 'Screen nextActionHint', fileContains('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx', 'nextActionHint'), 'screen');
check('AS1-18', 'No scary WORKFLOW_INVALID_STATE banner', !fileContains('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx', 'WORKFLOW_INVALID_STATE'), 'screen');
check('AS1-19', 'Unit tests stabilize', fileExists('src/__tests__/assistWorkflow/assistStabilize1.test.ts'), 'vitest');
check('AS1-20', 'Kevin visit test', fileContains('src/__tests__/assistWorkflow/assistStabilize1.test.ts', '2a499c72'), 'vitest');
check('AS1-21', 'AWF3 baseline intact', fileExists('scripts/audit-assist-workflow-3.ts'), 'awf3');
check('AS1-22', 'AWF2 baseline intact', fileExists('scripts/audit-assist-workflow-2.ts'), 'awf2');
check('AS1-23', 'Index exports stabilize', fileContains('src/features/assistWorkflow/index.ts', 'repairWorkflowState'), 'exports');
check('AS1-24', 'Abnahmebericht', fileExists('docs/audit/assist-stabilize-1-abnahmebericht.md'), 'abnahme');

const passed = checks.filter((c) => c.ok).length;
const failed = checks.filter((c) => !c.ok);

console.log('\n=== ASSIST.STABILIZE.1 Audit ===\n');
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} [${c.id}] ${c.label}`);
  if (!c.ok) console.log(`    → ${c.detail}`);
}
console.log(`\nErgebnis: ${passed}/${checks.length} bestanden\n`);
process.exit(failed.length > 0 ? 1 : 0);
