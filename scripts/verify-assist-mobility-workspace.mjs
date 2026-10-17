import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vitest = 'node_modules/vitest/vitest.mjs';
// The production client-intake gate already runs the full TypeScript check.
// Assignment planning/conflict/recurrence checks and the reused client roster
// reader also have their own preceding release gates. Avoid running them twice.
// These checks use isolated fixtures; they do not access production data and
// do not establish browser layout or authenticated end-to-end behavior.
const groups = {
  'Web day tours, replacement checks and UI interactions': [
    'assist/assistTourPlanningDataWeb.test.ts',
    'assist/assistTourPlanningInteractionWeb.test.tsx',
    'assist/routePlanning.test.ts',
  ],
  'Web canonical and legacy logbooks, tracking freshness and UI interactions': [
    'assist/assistMobilityDataWeb.test.ts',
    'assist/assistMobilityWorkspaceInteractionWeb.test.tsx',
    'assist/tripsLiveDetail.test.ts',
    'assist/tripsCompleteAndTrackingLive.test.ts',
    'assist/tripsLiveMigration.test.ts',
  ],
  'Existing consent, office role boundaries and confirmed logbook writes': [
    'liveTracking/liveTrackingLtGmaps5Consent.test.ts',
    'portal/employeeLogbookRoleSeparationR2.test.ts',
    'portal/logbookCompletionPersistence.test.ts',
    'portal/employeeLogbookDeletionAndRecovery.test.ts',
    'portal/employeeLogbookDailyConfirmationTruth.test.ts',
  ],
};

const tests = Object.values(groups).flat().map(file => `src/__tests__/${file}`);
const missing = [vitest, ...tests].filter(file => !existsSync(resolve(root, file)));
if (missing.length) {
  console.error(`[assist-mobility-release] Required project files are missing:\n${missing.map(file => `- ${file}`).join('\n')}`);
  process.exit(1);
}
for (const [label, files] of Object.entries(groups)) {
  console.log(`[assist-mobility-release] ${label}: ${files.length} suites`);
}
const result = spawnSync(process.execPath, [vitest, 'run', '--maxWorkers=1', ...tests], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, TZ: 'Europe/Berlin' },
});
if (result.error || result.status !== 0) {
  console.error(`[assist-mobility-release] Functional checks failed${result.error ? `: ${result.error.message}` : result.signal ? ` (${result.signal})` : ''}`);
  process.exit(result.status && result.status > 0 ? result.status : 1);
}
console.log('\n[assist-mobility-release] Functional checks passed. No remote data was changed. Browser layout and authenticated live workflows require separate verification.');
