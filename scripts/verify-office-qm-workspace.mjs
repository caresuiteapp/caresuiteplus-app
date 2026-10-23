import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const checks = [
  ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=2',
    'src/__tests__/qm', 'src/__tests__/navigation/breadcrumbs.test.ts'],
  ['--test',
    'scripts/checks/qm-registers-web.node.test.mjs',
    'scripts/checks/qm-document-workspace.node.test.mjs',
    'scripts/checks/qm-document-reference-caller-web.node.test.mjs',
    'scripts/checks/qm-document-version-reference-web.node.test.mjs',
    'scripts/checks/qm-hygiene-instruction-evidence-web.node.test.mjs'],
];

for (const args of checks) {
  const result = spawnSync(process.execPath, args, {
    cwd, stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Berlin' },
  });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
console.log('QM web service, interaction and document reference checks passed. Authenticated browser layout and production write workflows are separate evidence.');
