#!/usr/bin/env npx tsx
/**
 * ASSIST.WORKFLOW.2 — Employee visit execution time proof audit (25 checks).
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

check('AWF2-01', 'Preflight doc', fileExists('docs/audit/assist-workflow-2-time-proof-preflight.md'), 'preflight');
check('AWF2-02', 'Migration 0210', fileExists('supabase/migrations/0210_assist_workflow_2_time_proof.sql'), 'DDL');
check('AWF2-03', 'getVisitTimeSegments', fileExists('src/features/assistWorkflow/getVisitTimeSegments.ts'), 'segments');
check('AWF2-04', 'saveVisitTimeEvent', fileExists('src/features/assistWorkflow/saveVisitTimeEvent.ts'), 'events');
check('AWF2-05', 'resolveEffectiveWorkflowStatus', fileExists('src/features/assistWorkflow/resolveEffectiveWorkflowStatus.ts'), 'repair');
check('AWF2-06', 'endService guards service_started_at', fileContains('src/features/assistWorkflow/endService.ts', 'WORKFLOW_SERVICE_NOT_STARTED'), 'guard');
check('AWF2-07', 'markArrived backfill travel end', fileContains('src/features/assistWorkflow/markArrived.ts', 'backfillTravelEndEvents'), 'backfill');
check('AWF2-08', 'calculateVisitTimes stops drive at arrive', fileContains('src/features/assistWorkflow/calculateVisitTimes.ts', 'PAST_ARRIVAL_STATUSES'), 'times');
check('AWF2-09', 'validateExecutionTransition service guard', fileContains('src/lib/assist/assignmentStatusMachine.ts', 'hasServiceStarted'), 'machine');
check('AWF2-10', 'saveVisitDocumentation chains transition', fileContains('src/features/assistWorkflow/saveVisitDocumentation.ts', 'dokumentation_offen'), 'doc');
check('AWF2-11', 'saveClientSignature to unterschrift_offen', fileContains('src/features/assistWorkflow/saveClientSignature.ts', 'unterschrift_offen'), 'sig');
check('AWF2-12', 'finalizeVisit execution state flags', fileContains('src/features/assistWorkflow/finalizeVisit.ts', 'proofGenerated'), 'finalize');
check('AWF2-13', 'WORKFLOW error codes', fileContains('src/features/assistWorkflow/assistWorkflowErrors.ts', 'WORKFLOW_SERVICE_NOT_STARTED'), 'errors');
check('AWF2-14', 'buildServiceRecordHtml service start time', fileContains('src/features/assistWorkflow/buildServiceRecordHtml.ts', 'Einsatz gestartet'), 'proof html');
check('AWF2-15', 'execution state timestamps upsert', fileContains('src/features/assistWorkflow/assistVisitExecutionStatePersistence.ts', 'service_started_at'), 'state');
check('AWF2-16', 'Hook effective workflow', fileContains('src/hooks/useEmployeePortalVisitExecution.ts', 'resolveEffectiveWorkflowStatus'), 'hook');
check('AWF2-17', 'Screen repair banner', fileContains('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx', 'effectiveWorkflow'), 'screen');
check('AWF2-18', 'Screen signature chain', fileContains('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx', 'awaitingSignature'), 'chain');
check('AWF2-19', 'Index exports AWF2 modules', fileContains('src/features/assistWorkflow/index.ts', 'getVisitTimeSegments'), 'exports');
check('AWF2-20', 'Unit tests calculateVisitTimes AWF2', fileContains('src/__tests__/assistWorkflow/calculateVisitTimes.test.ts', 'stops drive after arrive'), 'vitest times');
check('AWF2-21', 'Unit tests endService guard', fileContains('src/__tests__/assistWorkflow/assistWorkflow2.test.ts', 'WORKFLOW_SERVICE_NOT_STARTED'), 'vitest end');
check('AWF2-22', 'Unit tests effective status repair', fileContains('src/__tests__/assistWorkflow/assistWorkflow2.test.ts', 'resolveEffectiveWorkflowStatus'), 'vitest repair');
check('AWF2-23', 'Unit tests state machine AWF2', fileContains('src/__tests__/assistWorkflow/assistVisitStateMachine.test.ts', 'blocks beendet without service'), 'vitest sm');
check('AWF2-24', 'Abnahmebericht', fileExists('docs/audit/assist-workflow-2-abnahmebericht.md'), 'abnahme');
check('AWF2-25', 'AWF1 baseline intact', fileExists('scripts/audit-assist-workflow-1.ts'), 'awf1');

const passed = checks.filter((c) => c.ok).length;
const failed = checks.filter((c) => !c.ok);

console.log('\n=== ASSIST.WORKFLOW.2 Audit ===\n');
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} [${c.id}] ${c.label}`);
  if (!c.ok) console.log(`    → ${c.detail}`);
}
console.log(`\nErgebnis: ${passed}/${checks.length} bestanden\n`);
process.exit(failed.length > 0 ? 1 : 0);
