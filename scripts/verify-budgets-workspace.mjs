import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suites = [
  'src/__tests__/assist/assistBudgetOverviewScreenWeb.test.tsx',
  'src/__tests__/assist/budgetWorkspaceReadWeb.test.ts',
  'src/__tests__/assist/budgetWorkspaceMutationsWeb.test.ts',
  'src/__tests__/assist/budgetWorkspaceSql.test.ts',
  'src/__tests__/clients/clientRecordBudgetNavigationWeb.test.tsx',
  'src/__tests__/clients/clientRecordNavigationInteraction.test.tsx',
  'src/__tests__/clients/clientRecordOverviewInteraction.test.tsx',
  'src/__tests__/office/budgetWorkspaceInteractionWeb.test.tsx',
  'src/__tests__/office/budgetModalsInteraction.test.tsx',
  'src/__tests__/office/clientBudgetVisualCardsWeb.test.tsx',
  'src/__tests__/office/budgetVisibleRoutes.test.ts',
  'src/__tests__/office/clientBudgetUiRebuild.test.ts',
  'src/__tests__/assist/clientBudgetVisualsRebuild.test.ts',
  'src/__tests__/assist/clientBudgetBookedPreviewR11.test.ts',
  'src/__tests__/assist/clientBudgetLivePlanningProjectionR13.test.ts',
  'src/__tests__/assist/clientBudgetPlannedAssignmentsR12.test.ts',
  'src/__tests__/assist/clientBudgetMarkExecuted.test.ts',
  'src/__tests__/assist/assignmentBudgetAllocation.test.ts',
  'src/__tests__/assist/assignmentBudgetPanelWeb.test.tsx',
];
const missing = suites.filter(file => !existsSync(resolve(root, file)));
if (missing.length) { console.error('[budgets-release] Missing required suites:', missing.join(', ')); process.exit(1); }
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', ...suites], { cwd: root, stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Berlin' } });
if (result.error || result.status !== 0) process.exit(result.status || 1);
console.log('[budgets-release] Budget reads, atomic writes, form recovery and native regression contracts passed. SQL tests use isolated data. Authenticated browser layout and production interactions require separate verification.');
