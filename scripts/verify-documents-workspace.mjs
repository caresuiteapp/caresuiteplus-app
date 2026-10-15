import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vitest = 'node_modules/vitest/vitest.mjs';
// Keep this gate scoped to the document workflows changed by the Web workspace.
// The preceding client-intake release gate already runs the project type check.
const groups = {
  '450-template catalogue, autofill and persistence': [
    'documents/centralCatalog.test.ts',
    'documents/centralCatalogAutofill.test.ts',
    'documents/centralCatalogDatabase.test.ts',
    'documents/centralCatalogEntities.test.ts',
    'documents/centralCatalogQuickChoices.test.ts',
    'documents/centralCatalogSources.test.ts',
    'documents/centralCatalogWorkflowSources.test.ts',
    'documents/centralCatalogWorkspace.test.tsx',
    'documents/centralCatalogEditor.test.tsx',
    'documents/centralCatalogActionSafety.test.tsx',
  ],
  'Document library, uploads and file display': [
    'office/officeDocumentWorkspaceWeb.test.ts',
    'office/officeDocumentUploadScopeWeb.test.tsx',
    'office/officePortalUploadReviewWeb.test.ts',
    'office/officeDocumentsList.test.ts',
    'office/officeDocumentDisplay.test.ts',
    'office/clientDocumentPreviewRecovery.test.tsx',
  ],
  'Signature requests and protected review': [
    'documents/signatureWorkspaceModelWeb.test.ts',
    'documents/officeSignatureReviewWeb.test.ts',
    'documents/csTemplateDatabase.test.ts',
    'documents/csDocumentLiveReadErrors.test.ts',
    'portal/clientTemplateSignatureCompletionWeb.test.ts',
  ],
  'Template editing, layout settings and navigation': [
    'documents/templateWorkspaceWeb.test.tsx',
    'documents/tenantDocumentSettingsWeb.test.ts',
    'templates/templateFallbackWeb.test.ts',
    'templates/templateSystem.test.ts',
    'templates/communicationTemplateDefaults.test.ts',
    'navigation/documentsWorkspaceRoutes.test.ts',
  ],
};
const tests = Object.values(groups).flat().map(file => `src/__tests__/${file}`);
const sqlTest = 'supabase/tests/document_workspace_review.test.mjs';
const required = [vitest, 'node_modules/@electric-sql/pglite/package.json', sqlTest, 'supabase/changes/document_workspace_review.sql', ...tests];
const missing = required.filter(file => !existsSync(resolve(root, file)));
if (missing.length) {
  console.error(`[documents-release] Required project files are missing:\n${missing.map(file => `- ${file}`).join('\n')}`);
  process.exit(1);
}

function run(label, args) {
  console.log(`\n[documents-release] ${label}`);
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error(`[documents-release] Failed: ${label}${result.error ? `: ${result.error.message}` : result.signal ? ` (${result.signal})` : ''}`);
    process.exit(result.status && result.status > 0 ? result.status : 1);
  }
}

for (const [label, files] of Object.entries(groups)) {
  console.log(`[documents-release] ${label}: ${files.length} suites`);
}
run(`${tests.length} focused document regression suites`, [vitest, 'run', '--maxWorkers=1', ...tests]);
run('Local PostgreSQL document review permissions and transitions', ['--test', sqlTest]);
console.log('\n[documents-release] All required checks passed. No remote database was changed.');
