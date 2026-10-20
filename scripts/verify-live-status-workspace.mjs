import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vitest = 'node_modules/vitest/vitest.mjs';
// These checks use isolated fixtures and mocked service boundaries. The
// client-intake release gate already checks TypeScript for the whole project.
// DOM interactions do not establish real browser layout or production behavior.
const groups = {
  'Web monitoring, scoped state and map interaction': [
    'assist/assistLiveStatusScreenWeb.test.tsx',
    'assist/assistLiveFilterSelectWeb.test.tsx',
    'assist/assistLiveWorkspacePresentation.test.ts',
    'assist/assistLiveWorkspaceData.test.ts',
    'assist/assistLiveWorkspaceHook.test.tsx',
    'assist/assistLiveStatusMapWorkspace.test.tsx',
    'maps/stableMarkerRefresh.test.tsx',
    'maps/liveMapControls.test.tsx',
  ],
  'Problem diagnosis, source actions and confirmed recovery': [
    'assist/assistProblemInboxWebInteraction.test.tsx',
    'assist/assistProblemWorkspaceService.test.ts',
    'assist/assistProblemInboxHook.test.tsx',
    'assist/assistExecutionProblemInbox.test.ts',
    'assist/assistDocumentationProofMappingRepair.test.ts',
    'assistWorkflow/workflowRecoveryVerification.test.ts',
    'assistWorkflow/workflowCriticalPersistence.test.ts',
    'assistWorkflow/finalizeVisitProof.test.ts',
    'wfm/wfmAssistAdapterRpc.test.ts',
  ],
  'Existing monitoring, timers and continuous route boundaries': [
    'assist/assistLiveMonitoring.test.ts',
    'assist/assistLiveTrackingView.test.ts',
    'assist/assistLiveWorkflow.test.ts',
    'assist/monitoringVisitTimerRecovery.test.ts',
    'liveTracking/assistLiveRouteMapR11.test.ts',
  ],
};

const tests = Object.values(groups).flat().map(file => `src/__tests__/${file}`);
const missing = [vitest, ...tests].filter(file => !existsSync(resolve(root, file)));
if (missing.length) {
  console.error(`[live-status-release] Required project files are missing:\n${missing.map(file => `- ${file}`).join('\n')}`);
  process.exit(1);
}
for (const [label, files] of Object.entries(groups)) {
  console.log(`[live-status-release] ${label}: ${files.length} suites`);
}
const result = spawnSync(process.execPath, [vitest, 'run', '--maxWorkers=1', ...tests], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, TZ: 'Europe/Berlin' },
});
if (result.error || result.status !== 0) {
  console.error(`[live-status-release] Functional checks failed${result.error ? `: ${result.error.message}` : result.signal ? ` (${result.signal})` : ''}`);
  process.exit(result.status && result.status > 0 ? result.status : 1);
}
console.log('\n[live-status-release] Functional checks passed. No remote data was changed. Browser layout and authenticated live workflows require separate verification.');
