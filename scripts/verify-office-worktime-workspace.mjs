import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vitest = 'node_modules/vitest/vitest.mjs';
// The production client-intake gate already runs the full TypeScript check.
// Shared Assist recurrence and tracking checks run in the preceding mobility gate.
// Keep these suites focused on Arbeitszeit, its writes and persisted exports.
// These checks use isolated fixtures; they do not access production data and
// do not establish browser layout or authenticated end-to-end behavior.
const groups = {
  'Web time accounts, canonical visits and complete reads': [
    'wfm/wfmOfficeAccountTotals.test.ts',
    'wfm/wfmOfficeZeitkontenWebService.test.ts',
    'wfm/wfmOfficePlannedVisitsWeb.test.ts',
    'wfm/wfmTimeAccountsWorkspaceWeb.test.ts',
  ],
  'Web editing, approvals, presence and stored settings': [
    'wfm/wfmOfficeReviewDraftWeb.test.ts',
    'wfm/wfmManualEntryDraftWeb.test.ts',
    'wfm/wfmOwnTimeTrackingWeb.test.tsx',
    'wfm/wfmOfficeReviewWebInteraction.test.tsx',
    'wfm/wfmOfficeTimekeepingWeb.test.ts',
    'wfm/wfmOfficeTimekeepingReadsWeb.test.ts',
    'wfm/officeWorktimeLiveWeb.test.tsx',
    'wfm/wfmOfficeLivePresenceWeb.test.ts',
    'wfm/wfmOfficeAuditReaderWeb.test.ts',
    'wfm/wfmOfficeSettingsWeb.test.ts',
    'wfm/wfmOfficePlanningActionsWeb.test.ts',
  ],
  'Existing timekeeping, approval, absence and export contracts': [
    'wfm/wfmOfficeMonthAndSync.test.ts',
    'wfm/wfmOfficeTimeApproval.test.ts',
    'wfm/wfmOfficeTimeDisplayResolver.test.ts',
    'wfm/wfmTimeAccountContractTarget.test.ts',
    'wfm/wfmRecordedCompletionTruth.test.ts',
    'wfm/wfmOfficeCanonicalVisitSource.test.ts',
    'wfm/wfmTimeExportPolicy.test.ts',
    'wfm/wfmTimeExportPayloadBuilder.test.ts',
    'wfm/wfmTimeExportService.test.ts',
    'wfm/wfmTimeCorrectionExportService.test.ts',
    'wfm/wfmAbsenceApprovalWorkflow.test.ts',
  ],
};

const tests = Object.values(groups).flat().map(file => `src/__tests__/${file}`);
const missing = [vitest, ...tests].filter(file => !existsSync(resolve(root, file)));
if (missing.length) {
  console.error(`[office-worktime-release] Required project files are missing:\n${missing.map(file => `- ${file}`).join('\n')}`);
  process.exit(1);
}
for (const [label, files] of Object.entries(groups)) {
  console.log(`[office-worktime-release] ${label}: ${files.length} suites`);
}
const result = spawnSync(process.execPath, [vitest, 'run', '--maxWorkers=1', ...tests], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, TZ: 'Europe/Berlin' },
});
if (result.error || result.status !== 0) {
  console.error(`[office-worktime-release] Functional checks failed${result.error ? `: ${result.error.message}` : result.signal ? ` (${result.signal})` : ''}`);
  process.exit(result.status && result.status > 0 ? result.status : 1);
}
console.log('\n[office-worktime-release] Functional checks passed. No remote data was changed. Browser layout and authenticated live workflows require separate verification.');
