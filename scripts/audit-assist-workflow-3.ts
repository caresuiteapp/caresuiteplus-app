#!/usr/bin/env npx tsx
/**
 * ASSIST.WORKFLOW.3 — State sync, live timers, optimistic tasks audit (28 checks).
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

check('AWF3-01', 'Preflight doc', fileExists('docs/audit/assist-workflow-3-state-timer-tasks-preflight.md'), 'preflight');
check('AWF3-02', 'Migration 0211', fileExists('supabase/migrations/0211_assist_workflow_3_task_batch_index.sql'), 'DDL');
check('AWF3-03', 'resolveAllowedActions', fileExists('src/features/assistWorkflow/resolveAllowedActions.ts'), 'actions');
check('AWF3-04', 'canEndService guard', fileContains('src/features/assistWorkflow/resolveAllowedActions.ts', 'canEndService: isServiceStarted && !isServiceEnded'), 'guard');
check('AWF3-05', 'Context allowedActions', fileContains('src/features/assistWorkflow/resolveAssistExecutionContext.ts', 'allowedActions'), 'context');
check('AWF3-06', 'Context diagnostics', fileContains('src/features/assistWorkflow/types.ts', 'diagnostics'), 'types');
check('AWF3-07', 'useLiveVisitTimers', fileExists('src/hooks/useLiveVisitTimers.ts'), 'hook');
check('AWF3-08', 'Live tick 1s no DB', fileContains('src/hooks/useLiveVisitTimers.ts', 'setInterval'), 'tick');
check('AWF3-09', 'Hook uses live timers', fileContains('src/hooks/useEmployeePortalVisitExecution.ts', 'useLiveVisitTimers'), 'execution hook');
check('AWF3-10', 'saveTaskResultsBatch', fileExists('src/features/assistWorkflow/saveTaskResultsBatch.ts'), 'batch');
check('AWF3-11', 'useTaskResultDrafts', fileExists('src/hooks/useTaskResultDrafts.ts'), 'drafts');
check('AWF3-12', 'Debounced batch', fileContains('src/hooks/useTaskResultDrafts.ts', 'DEBOUNCE_MS'), 'debounce');
check('AWF3-13', 'Repository updateTasksBatch', fileContains('src/lib/assist/repositories/assignmentRepository.supabase.ts', 'updateTasksBatch'), 'repo');
check('AWF3-14', 'Screen allowedActions buttons', fileContains('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx', 'primaryAllowedAction'), 'screen');
check('AWF3-15', 'Screen dismiss error', fileContains('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx', 'setLocalError(null)'), 'dismiss');
check('AWF3-16', 'Screen safe area', fileContains('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx', 'useSafeAreaInsets'), 'safe area');
check('AWF3-17', 'Gestartet without service repair', fileContains('src/features/assistWorkflow/resolveEffectiveWorkflowStatus.ts', 'IN_SERVICE_STATUSES'), 'repair');
check('AWF3-18', 'endService context reload', fileContains('src/hooks/useEmployeePortalVisitExecution.ts', 'WORKFLOW_SERVICE_NOT_STARTED'), 'reload');
check('AWF3-19', 'Tasks optimistic panel', fileContains('src/components/portal/EmployeePortalVisitTasksPanel.tsx', 'void onUpdateTask'), 'optimistic');
check('AWF3-20', 'Timer panel live subtitle', fileContains('src/components/portal/EmployeePortalLiveTimersPanel.tsx', 'Live-Anzeige'), 'timers ui');
check('AWF3-21', 'Index exports AWF3', fileContains('src/features/assistWorkflow/index.ts', 'resolveAllowedActions'), 'exports');
check('AWF3-22', 'Unit tests gestartet repair', fileContains('src/__tests__/assistWorkflow/assistWorkflow2.test.ts', 'gestartet without service_start'), 'vitest repair');
check('AWF3-23', 'Unit tests allowedActions', fileExists('src/__tests__/assistWorkflow/assistWorkflow3.test.ts'), 'vitest awf3');
check('AWF3-24', 'Unit tests live timers', fileContains('src/__tests__/assistWorkflow/assistWorkflow3.test.ts', 'useLiveVisitTimers'), 'vitest timers');
check('AWF3-25', 'AWF2 baseline intact', fileExists('scripts/audit-assist-workflow-2.ts'), 'awf2');
check('AWF3-26', 'AWF1 baseline intact', fileExists('scripts/audit-assist-workflow-1.ts'), 'awf1');
check('AWF3-27', 'Abnahmebericht', fileExists('docs/audit/assist-workflow-3-abnahmebericht.md'), 'abnahme');
check('AWF3-28', 'timeEvents in context', fileContains('src/features/assistWorkflow/types.ts', 'timeEvents'), 'events');

const passed = checks.filter((c) => c.ok).length;
const failed = checks.filter((c) => !c.ok);

console.log('\n=== ASSIST.WORKFLOW.3 Audit ===\n');
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} [${c.id}] ${c.label}`);
  if (!c.ok) console.log(`    → ${c.detail}`);
}
console.log(`\nErgebnis: ${passed}/${checks.length} bestanden\n`);
process.exit(failed.length > 0 ? 1 : 0);
