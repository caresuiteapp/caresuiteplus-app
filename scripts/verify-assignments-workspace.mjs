import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vitest = 'node_modules/vitest/vitest.mjs';
// Functional regression checks for the Web assignment workspace. The production
// build already runs the project type check through the client-intake gate.
// DOM interactions below are not a browser layout or authenticated live-data test.
const groups = {
  'Employee scope resolution and portal logbook loading': [
    'hooks/useAsyncQueryScope.test.tsx',
    'portal/employeeLogbookLoadingTransition.test.tsx',
  ],
  'Assignment list, refresh, status projection and recurring dates': [
    'assist/assignmentWorkspaceModel.test.ts',
    'assist/assignmentWorkspaceListInteraction.test.tsx',
    'assist/assignmentListWorkspaceInteraction.test.tsx',
    'assist/assistAssignmentsList.test.ts',
    'assist/planningListAndRouteRecovery.test.tsx',
    'assist/assignmentStatusDerivation.test.ts',
    'assist/visitDispositionExecutionEnrichment.test.ts',
    'assist/visitRecurrenceExpansion.test.ts',
    'assist/visitRecurrenceListPipeline.test.ts',
    'assist/visitRecurrenceDateIntegrity.test.ts',
  ],
  'Planning forms, conflicts, persistence receipts and completion guards': [
    'assist/assignmentFormOptionsWeb.test.tsx',
    'assist/assignmentBudgetPanelWeb.test.tsx',
    'assist/assignmentWebFormsWorkspaceInteraction.test.tsx',
    'assist/assignmentCreateForm.test.ts',
    'assist/assignmentEditForm.test.ts',
    'assist/planningFormsScopeInteraction.test.tsx',
    'assist/visitPlanningConflictReads.test.ts',
    'assist/visitPlanningMutationTruth.test.ts',
    'assist/visitPlanningRepositoryReceipt.test.ts',
    'assist/visitEditCompletionRecovery.test.ts',
    'assist/visitSeriesPersistenceContract.test.ts',
    'assist/assignmentBudgetAllocation.test.ts',
  ],
  'Detail mutations, deletion, execution and proof integrity': [
    'assist/assignmentDetailWorkspaceInteraction.test.tsx',
    'assist/visitTasksWorkspaceInteraction.test.tsx',
    'assist/visitAttachmentsWorkspaceInteraction.test.tsx',
    'assist/administrativeFollowUpWebInteraction.test.tsx',
    'assist/administrativeMinutesWeb.test.ts',
    'assist/visitExecutionWorkspaceInteraction.test.tsx',
    'assist/assignmentDetailMutationScope.test.tsx',
    'assist/visitDisposition.test.ts',
    'assist/visitStatusReadbackRecovery.test.ts',
    'assist/visitDeletionSafety.test.ts',
    'assist/assignmentLifecycleTimestamps.test.ts',
    'assistWorkflow/assignmentStatusWriteReceipts.test.ts',
    'assistWorkflow/executionSignedTaskGuard.test.ts',
    'assistWorkflow/saveVisitDocumentation.test.ts',
    'assist/assignmentProduction.test.ts',
    'assist/visitExecutionService.test.ts',
    'assist/visitProofCompleteness.test.ts',
    'assist/assignmentWorkflow.test.ts',
    'assist/assignmentCompletionChain.test.ts',
  ],
};

const tests = Object.values(groups).flat().map(file => `src/__tests__/${file}`);
const sqlTest = 'supabase/tests/assignment_workspace_review.test.mjs';
const migration = 'supabase/migrations/20261016082544_assignment_workspace_review.sql';
const missing = [vitest, 'node_modules/@electric-sql/pglite/package.json', sqlTest, migration, ...tests].filter(file => !existsSync(resolve(root, file)));
if (missing.length) {
  console.error(`[assignments-release] Required project files are missing:\n${missing.map(file => `- ${file}`).join('\n')}`);
  process.exit(1);
}

function run(label, args) {
  console.log(`\n[assignments-release] ${label}`);
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error(`[assignments-release] Failed: ${label}${result.error ? `: ${result.error.message}` : result.signal ? ` (${result.signal})` : ''}`);
    process.exit(result.status && result.status > 0 ? result.status : 1);
  }
}

for (const [label, files] of Object.entries(groups)) {
  console.log(`[assignments-release] ${label}: ${files.length} suites`);
}
run(`${tests.length} focused assignment regression suites`, [vitest, 'run', '--maxWorkers=1', ...tests]);
run('Isolated PostgreSQL assignment status and deletion authorization', ['--test', sqlTest]);
console.log('\n[assignments-release] Functional checks passed. No remote data was changed. Browser layout and authenticated live workflows require separate verification.');
