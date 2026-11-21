import { spawnSync } from 'node:child_process';
const run = (file, args) => { const result = spawnSync(process.execPath, [file, ...args], { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' } }); if (result.error || result.status !== 0) { console.error('NEO-Prüfung fehlgeschlagen. Es wurde nichts veröffentlicht.'); process.exit(result.status || 1); } };
run('node_modules/typescript/bin/tsc', ['--project', 'tsconfig.neo.json', '--pretty', 'false']);
run('scripts/port-native-workspaces.mjs', ['--check']);
run('node_modules/vitest/vitest.mjs', ['run',
  'src/__tests__/ai/neo', 'src/__tests__/ai/robotNavigation', 'src/__tests__/ai/robotAcademyIsolationWeb',
  'src/__tests__/office/documentationWorkspace', 'src/__tests__/office/documentationService', 'src/__tests__/office/documentationAttachments',
  'src/__tests__/pflege/careAssessmentHealthOS', '--maxWorkers=1', '--minWorkers=1',
]);
run('scripts/build-neo-service.mjs', []);
console.log('NEO-Quellprüfung, Regressionstests, Native-Abgleich und eigener Dienstbau abgeschlossen. Kein Webrelease / App-Release.');
