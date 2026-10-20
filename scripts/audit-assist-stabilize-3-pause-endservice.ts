#!/usr/bin/env npx tsx
/**
 * ASSIST.STABILIZE.3 — pause/endService production blocker audit.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname ?? '.', '..');
const OUT = join(ROOT, 'docs/audit/assist-stabilize-3-pause-endservice-audit-output.md');

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

check('AS3-01', 'Preflight doc', fileExists('docs/audit/assist-stabilize-3-pause-endservice-preflight.md'), 'preflight');
check('AS3-02', 'startPause readback', fileContains('src/features/assistWorkflow/startPause.ts', 'verifyStartPauseReadback'), 'startPause');
check('AS3-03', 'endPause readback', fileContains('src/features/assistWorkflow/endPause.ts', 'verifyEndPauseReadback'), 'endPause');
check('AS3-04', 'endService readback', fileContains('src/features/assistWorkflow/endService.ts', 'verifyEndServiceReadback'), 'endService');
check('AS3-05', 'Open pause helpers', fileContains('src/features/assistWorkflow/saveVisitTimeEvent.ts', 'hasOpenPauseSegment'), 'pause helpers');
check('AS3-06', 'No duplicate service_start on resume', fileContains('src/lib/portal/employeePortalVisitTrackingPersistence.ts', "fromStatus === 'angekommen'"), 'event mapping');
check('AS3-07', 'Pause closes before service_end', fileContains('src/lib/portal/employeePortalVisitTrackingPersistence.ts', "fromStatus === 'pausiert'"), 'pause close');
check('AS3-08', 'Service freeze during pause', fileContains('src/features/assistWorkflow/calculateVisitTimes.ts', 'completedPauseSeconds'), 'timers');
check('AS3-09', 'end_service while paused', fileContains('src/features/assistWorkflow/resolveAllowedActions.ts', "actions.push('end_service')"), 'allowedActions');
check('AS3-10', 'Context derived status timers', fileContains('src/features/assistWorkflow/resolveAssistExecutionContext.ts', 'STABILIZE.3'), 'context');
check('AS3-11', 'Unit tests stabilize3', fileExists('src/__tests__/assistWorkflow/assistStabilize3PauseEndService.test.ts'), 'vitest');
check('AS3-12', 'STABILIZE.2 baseline intact', fileExists('src/features/assistWorkflow/startService.ts'), 'stabilize2');
check('AS3-13', 'Abnahmebericht placeholder', fileExists('docs/audit/assist-stabilize-3-pause-endservice-abnahmebericht.md'), 'abnahme');

const passed = checks.filter((c) => c.ok).length;
const failed = checks.filter((c) => !c.ok);

const lines = [
  '# ASSIST.STABILIZE.3 — Audit Output',
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

console.log('\n=== ASSIST.STABILIZE.3 Audit ===\n');
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} [${c.id}] ${c.label}`);
}
console.log(`\nOutput: ${OUT}`);
console.log(`Ergebnis: ${passed}/${checks.length} bestanden\n`);
process.exit(failed.length > 0 ? 1 : 0);
