import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tests = [
  'src/__tests__/office/officeNotesModelWeb.test.ts',
  'src/__tests__/office/officeNotesServiceWeb.test.ts',
  'src/__tests__/office/officeNotesSql.test.ts',
  'src/__tests__/office/notesWorkspaceInteraction.test.tsx',
  'src/__tests__/office/notesVisualEditors.test.tsx',
  'src/__tests__/office/officeNotesEditorInteraction.test.tsx',
  'src/__tests__/office/officeNotesExport.test.ts',
  'src/__tests__/office/internalNotesModelWeb.test.ts',
  'src/__tests__/office/internalNotesServiceWeb.test.ts',
  'src/__tests__/office/internalNotesForwardingInteraction.test.tsx',
  'src/__tests__/portal/employeeInternalNotesInteraction.test.tsx',
  'src/__tests__/office/officeNotesScreenWeb.test.tsx',
  'src/__tests__/navigation/officeNotesDesktop.test.ts',
  'src/__tests__/layout/officeNotesDesktopInteraction.test.tsx',
  'src/__tests__/navigation/officeDocumentCatalogDesktop.test.ts',
  'src/__tests__/navigation/moduleDesktop.test.ts',
  'src/__tests__/navigation/webDesktopRouteContract.test.ts',
];
if (tests.some(file => !existsSync(resolve(root, file)))) {
  console.error('[office-notes-release] Required test files are missing.'); process.exit(1);
}
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers=1', ...tests], { cwd: root, stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Berlin' } });
if (result.error || result.status !== 0) process.exit(result.status || 1);
const database = spawnSync(process.execPath, ['scripts/verify-office-internal-notes-db.mjs'], { cwd: root, stdio: 'inherit', env: process.env });
if (database.error || database.status !== 0) process.exit(database.status || 1);
console.log('[office-notes-release] Notes, persistence boundaries and desktop regressions passed. Tests use isolated data; browser geometry and authenticated production workflows require separate verification.');
