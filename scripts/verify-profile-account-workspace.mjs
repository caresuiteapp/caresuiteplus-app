import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tests = [
  'src/__tests__/auth/userProfileAccountServiceWeb.test.ts',
  'src/__tests__/settings/userProfileAccountWebInteraction.test.tsx',
  'src/__tests__/navigation/profileAccountCloseNavigation.test.tsx',
  'src/__tests__/navigation/webNavigationHydration.test.tsx',
  'src/__tests__/auth/userprofileservice.test.ts',
  'src/__tests__/auth/useravatar.test.ts',
];
if (tests.some(file => !existsSync(resolve(root, file)))) {
  console.error('[profile-account-release] Required tests are missing.'); process.exit(1);
}
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', ...tests], {
  cwd: root, stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Berlin' },
});
if (result.error || result.status !== 0) process.exit(result.status || 1);
console.log('[profile-account-release] Profile, avatar, account actions and navigation checks passed with isolated data.');
