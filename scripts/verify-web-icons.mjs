import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tests = [
  'src/__tests__/icons/webActionIcon.test.tsx',
  'src/__tests__/icons/semanticArtwork.test.tsx',
  'src/__tests__/icons/artworkGeometryWeb.test.ts',
  'src/__tests__/icons/spaceIconsWeb.test.tsx',
  'src/__tests__/navigation/desktopCatalogIcon.test.ts',
];

if (tests.some(file => !existsSync(resolve(root, file)))) {
  console.error('[web-icons-release] Required icon regression tests are missing.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=2', ...tests], {
  cwd: root, stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Berlin' },
});
if (result.error || result.status !== 0) process.exit(result.status || 1);
console.log('[web-icons-release] Icon semantics, native compatibility, action frames and catalogue assets passed. Browser layout and visual quality require separate evidence.');
