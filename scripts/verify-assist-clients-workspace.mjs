import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suites = [
  'src/__tests__/assist/assistClientsWorkspaceDataWeb.test.ts',
  'src/__tests__/assist/assistClientsWorkspaceInteractionWeb.test.tsx',
  'src/__tests__/assist/assistClientsWorkspaceR15.test.ts',
];
const missing = suites.filter(file => !existsSync(resolve(root, file)));
if (missing.length) { console.error('[assist-clients-release] Missing required suites:', missing.join(', ')); process.exit(1); }
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', ...suites], { cwd: root, stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Berlin' } });
if (result.error || result.status !== 0) process.exit(result.status || 1);
console.log('[assist-clients-release] Scoped roster, planning lifecycle, recurrence, navigation and UI interactions passed. Layout and authenticated production interactions require separate browser verification.');
