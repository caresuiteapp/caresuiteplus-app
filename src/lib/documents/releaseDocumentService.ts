import { createDocumentService } from './documentServiceFactory';

/** WP534 — Dokumente & PDF (release) */
export const releaseDocumentService = createDocumentService(
  534,
  'release',
  'release.view',
  [
    { id: 'doc-release-001', title: 'Deployment-Checkliste PDF', fileName: 'deploy-checklist.pdf', mimeType: 'application/pdf', status: 'aktiv' },
  ],
);
