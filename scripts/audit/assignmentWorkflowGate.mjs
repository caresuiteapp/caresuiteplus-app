#!/usr/bin/env node
/**
 * Thin wrapper — prefer: npm run audit:assignment-workflow-gate
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const vitestBin = join(root, 'node_modules', 'vitest', 'vitest.mjs');

const testFiles = [
  'src/__tests__/portal/assignmentWorkflowRegressionGate.test.ts',
  'src/__tests__/portal/employeePortalTabletTouchFix.test.ts',
  'src/__tests__/portal/visitExecutionWhiteScreenFix.test.ts',
  'src/__tests__/portal/deferredSignatureWhiteScreenFix.test.ts',
  'src/__tests__/portal/employeePortalMobileAcceptance.test.ts',
];

const result = spawnSync(process.execPath, [vitestBin, 'run', ...testFiles], {
  cwd: root,
  stdio: 'inherit',
});

if (result.status !== 0) {
  console.error('\n[assignment-workflow-gate] FAILED — Einsatz-Workflow regression detected.');
  process.exit(result.status ?? 1);
}

console.log('\n[assignment-workflow-gate] OK — critical path invariants hold.');
