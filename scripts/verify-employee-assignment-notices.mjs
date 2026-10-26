import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vitest = 'node_modules/vitest/vitest.mjs';
const tests = [
  'src/__tests__/assist/visitPortalPublicationGuard.test.ts',
  'src/__tests__/assist/visitPlanningRepositoryReceipt.test.ts',
  'src/__tests__/assist/visitStatusReadbackRecovery.test.ts',
  'src/__tests__/portal/employeeAssignmentNoticesWeb.test.ts',
  'src/__tests__/portal/employeeAssignmentNoticeGateWeb.test.tsx',
  'src/__tests__/portal/employeeScheduleRefreshWeb.test.tsx',
  'src/__tests__/portal/employeeReadScopeRepair.test.tsx',
  'src/__tests__/portal/clientAppointmentsRefreshRepair.test.tsx',
  'src/__tests__/portal/employeePortalAssignmentCompletion.test.ts',
];
const databaseTest = 'supabase/tests/employee_assignment_notifications.test.mjs';
for (const file of [vitest, databaseTest, ...tests]) {
  if (!existsSync(resolve(root, file))) {
    console.error(`[employee-assignment-notices] Missing required file: ${file}`);
    process.exit(1);
  }
}
for (const [label, args] of [
  ['Portal refresh, recipient scope and read receipts', [vitest, 'run', '--maxWorkers=1', ...tests]],
  ['Isolated planning-notice database regression', ['--test', databaseTest]],
]) {
  console.log(`[employee-assignment-notices] ${label}`);
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Berlin' } });
  if (result.error || result.status !== 0) {
    console.error(`[employee-assignment-notices] Failed: ${label}${result.error ? `: ${result.error.message}` : ''}`);
    process.exit(result.status && result.status > 0 ? result.status : 1);
  }
}
console.log('[employee-assignment-notices] Functional and isolated database checks passed. No remote data changed.');
