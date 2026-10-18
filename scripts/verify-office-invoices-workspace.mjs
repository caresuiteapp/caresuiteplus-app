import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vitest = 'node_modules/vitest/vitest.mjs';
// Full-project TypeScript runs in the first production gate. These fixture-based
// tests cover invoice arithmetic, complete reads, actions, PDF storage and UI
// interaction. They do not issue live invoices or prove authenticated layout.
const groups = {
  'Office invoice workspace': [
    'office/invoiceWorkspaceTypesWeb.test.ts',
    'office/invoiceWorkspaceServiceWeb.test.ts',
    'office/invoiceWorkspaceModelWeb.test.ts',
    'office/invoiceWorkspaceWebInteraction.test.tsx',
    'office/invoiceEditorModelWeb.test.ts',
    'office/invoiceEditorInteractionWeb.test.tsx',
    'office/invoicePreviewInteractionWeb.test.tsx',
    'office/officeInvoiceRunWeb.test.ts',
    'office/officeInvoiceRunServiceWeb.test.ts',
    'office/officeInvoicePdfWeb.test.ts',
    'office/officeInvoiceProofAttachmentsWeb.test.ts',
    'office/officeInvoiceIssuePdfWeb.test.ts',
    'documents/pdfUploadEndpoint.test.ts',
  ],
  'Existing invoice and native PDF contracts': [
    'office/officeInvoicePdfRegression.test.ts',
    'office/officeInvoiceLiveFlowRegression.test.ts',
    'office/officeInvoiceNativePdf.test.ts',
    'office/officeInvoiceDetailCatalogRegression.test.ts',
    'office/officeInvoicesList.test.ts',
  ],
};
const tests = Object.values(groups).flat().map(file => `src/__tests__/${file}`);
const missing = [vitest, ...tests].filter(file => !existsSync(resolve(root, file)));
if (missing.length) {
  console.error(`[office-invoices-release] Required project files are missing:\n${missing.map(file => `- ${file}`).join('\n')}`);
  process.exit(1);
}
for (const [label, files] of Object.entries(groups)) console.log(`[office-invoices-release] ${label}: ${files.length} suites`);
const result = spawnSync(process.execPath, [vitest, 'run', '--maxWorkers=1', ...tests], {
  cwd: root, stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Berlin' },
});
if (result.error || result.status !== 0) {
  console.error(`[office-invoices-release] Checks failed${result.error ? `: ${result.error.message}` : result.signal ? ` (${result.signal})` : ''}`);
  process.exit(result.status && result.status > 0 ? result.status : 1);
}
console.log('[office-invoices-release] Invoice checks passed. No live invoices created or sent.');
