import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('..', import.meta.url));
const checks = [
  ['scripts/verify-academy-edge-build.mjs'],
  ['--test', 'scripts/desktop-areas.test.mjs'],
  ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=2',
    'src/__tests__/akademie',
    'src/__tests__/auth/academyFamilyAccess.test.ts',
    'src/__tests__/auth/academyFamilyAccessDatabase.test.ts',
    'src/__tests__/auth/academyFamilyWebLogin.test.tsx',
    'src/__tests__/auth/webSessionBootstrap.test.tsx',
    'src/__tests__/auth/sessionTarget.test.ts',
    'src/__tests__/navigation/webCanonicalHome.test.ts',
    'src/__tests__/office/academyFamilyAccessPanel.test.tsx',
    'src/__tests__/ai/robotAcademyIsolationWeb.test.tsx',
    'src/__tests__/office/clientPortalExperienceInteraction.test.tsx'],
  ['--test', 'supabase/tests/academy_workspace.test.mjs', 'supabase/tests/academy_family_integration.test.mjs', 'supabase/tests/academy_family_foundation.test.mjs'],
  ['scripts/generate-web-route-parents.mjs', '--check'],
];
for (const args of checks) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Berlin' } });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
console.log('Academy database, service, PDF and DOM workflow checks passed with isolated data. Browser layout and the deployed Data API/Edge auth chain require separate verification.');
