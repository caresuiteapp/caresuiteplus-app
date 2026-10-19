import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tests = [
  'src/__tests__/privacy/dataRequestWorkspaceServiceWeb.test.ts',
  'src/__tests__/privacy/dataRequestWorkspaceWebInteraction.test.tsx',
  'src/__tests__/privacy/dataSubjectRequestAdminWeb.test.ts',
  'src/__tests__/privacy/dataSubjectRequestAdminWebInteraction.test.tsx',
  'src/__tests__/privacy/dsgvoAdminNotify.test.ts',
  'src/__tests__/privacy/dsgvoAdminNotifySecurity.test.ts',
];
if (tests.some(file => !existsSync(resolve(root, file)))) {
  console.error('[data-request-release] Required tests are missing.'); process.exit(1);
}
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', ...tests], {
  cwd: root, stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Berlin' },
});
if (result.error || result.status !== 0) process.exit(result.status || 1);
console.log('[data-request-release] Account export, own requests and interaction checks passed with isolated data.');
