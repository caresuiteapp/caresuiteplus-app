import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vitest = 'node_modules/vitest/vitest.mjs';
// The preceding production gates already verify full-project TypeScript,
// WFM account data, canonical visits and navigation. These additional suites
// exercise payroll with isolated fixtures, including its SQL transaction.
// They do not change live records or establish authenticated visual behavior.
const groups = {
  'Office Web payroll': [
    'payroll/payrollCalculatorWeb.test.ts',
    'payroll/payrollMonthServiceWeb.test.ts',
    'payroll/payrollOfficeReadModelWeb.test.ts',
    'payroll/payrollOfficeActionsWeb.test.ts',
    'payroll/payrollOfficeSqlWeb.test.ts',
    'payroll/payrollWorkspaceModelWeb.test.ts',
    'payroll/payrollWorkspaceWebInteraction.test.tsx',
  ],
  'Existing payroll, expense and portal contracts': [
    'payroll/payrollCalculator.test.ts',
    'payroll/payrollExpenseApproval.test.ts',
    'payroll/payrollWfmConsistency.test.ts',
    'payroll/payrollPortalUploadVisibility.test.ts',
    'payroll/payrollWorkspaceR8.test.ts',
    'office/employeePayrollValidation.test.ts',
    'portal/employeePayrollReadAndUploadTruth.test.ts',
  ],
};
const tests = Object.values(groups).flat().map(file => `src/__tests__/${file}`);
const missing = [vitest, ...tests].filter(file => !existsSync(resolve(root, file)));
if (missing.length) {
  console.error(`[office-payroll-release] Required project files are missing:\n${missing.map(file => `- ${file}`).join('\n')}`);
  process.exit(1);
}
for (const [label, files] of Object.entries(groups)) {
  console.log(`[office-payroll-release] ${label}: ${files.length} suites`);
}
const result = spawnSync(process.execPath, [vitest, 'run', '--maxWorkers=1', ...tests], {
  cwd: root, stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Berlin' },
});
if (result.error || result.status !== 0) {
  console.error(`[office-payroll-release] Checks failed${result.error ? `: ${result.error.message}` : result.signal ? ` (${result.signal})` : ''}`);
  process.exit(result.status && result.status > 0 ? result.status : 1);
}
console.log('\n[office-payroll-release] Payroll checks passed. No live data changed. Authenticated visual and live workflow checks require separate evidence.');
