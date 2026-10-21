import { existsSync } from 'node:fs';
import { totalmem } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientSuites = [
  'clientIntakePlan.test.ts',
  'clientIntake2027.test.ts',
  'clientIntakeDeleteInteraction.test.tsx',
  'clientIntakeCompletionTruth.test.ts',
  'clientIntakeDocuments.test.ts',
  'clientIntakeDocumentPackage.test.ts',
  'clientIntakeDocumentPackageInteraction.test.tsx',
  'clientIntakeDraftRepository.test.ts',
  'clientIntakeWebResolution.test.ts',
  'clientIntakeDraftStorage.test.ts',
  'clientIntakeDraftStorageWeb.test.ts',
  'clientIntakeExperienceInteraction.test.tsx',
  'clientIntakeSectionsInteraction.test.tsx',
  'clientIntakeWizardLifecycle.test.tsx',
  'clientIntakeCompletionEdge.test.ts',
  'clientIntakeCompletionVerification.test.ts',
  'clientIntakeRenderBinding.test.ts',
  'clientIntakeRepositoryStatus.test.ts',
  'clientIntakeResumeRoute.test.tsx',
  'clientIntakeServerRecoveryInteraction.test.tsx',
  'clientIntakeOriginalIntegrity.test.ts',
  'intakeDocumentSnapshotPreservation.test.ts',
  'clientIntakeReadIntegrity.test.ts',
].map(name => `src/__tests__/clients/${name}`);
const suites = [...clientSuites, 'src/__tests__/office/clientsListExperienceInteraction.test.tsx', 'src/__tests__/assistCatalog/assistCatalogLoading.test.tsx'];
const sqlSuite = 'supabase/tests/client_intake_transaction.test.mjs';
const typescript = 'node_modules/typescript/bin/tsc';
const vitest = 'node_modules/vitest/vitest.mjs';

// The previous verification used an 8 GiB ceiling. Keep that ceiling local to
// TypeScript, and reserve 1 GiB when a smaller build-container limit is known.
const constrainedBytes = process.constrainedMemory?.() ?? 0;
const memoryBytes = constrainedBytes > 0 ? Math.min(totalmem(), constrainedBytes) : totalmem();
const heapMiB = Math.max(512, Math.min(8192, Math.floor(memoryBytes / 1024 / 1024) - 1024));
const steps = [
  { label: 'Shared App/Edge verifier', args: ['scripts/build-intake-edge-runtime.mjs', '--check'] },
  { label: `TypeScript (heap ceiling ${heapMiB} MiB)`, args: [`--max-old-space-size=${heapMiB}`, typescript, '--noEmit', '--skipLibCheck'] },
  { label: `${suites.length} intake regression suites`, args: [vitest, 'run', '--maxWorkers=2', ...suites] },
  { label: 'Local intake SQL transaction contract', args: ['--test', sqlSuite] },
];
const required = [typescript, vitest, 'scripts/build-intake-edge-runtime.mjs', sqlSuite, ...suites];
const missing = required.filter(file => !existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Client intake release verification cannot run. Missing project files:\n${missing.map(file => `- ${file}`).join('\n')}`);
  process.exit(1);
}
for (const step of steps) {
  console.log(`\n[client-intake-release] ${step.label}`);
  const result = spawnSync(process.execPath, step.args, { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error(`[client-intake-release] Failed: ${step.label}${result.error ? `: ${result.error.message}` : result.signal ? ` (${result.signal})` : ''}`);
    process.exit(result.status && result.status > 0 ? result.status : 1);
  }
}
console.log('\n[client-intake-release] All required checks passed.');
