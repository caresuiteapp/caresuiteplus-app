import { createDocumentService } from './documentServiceFactory';

/** WP574 — Dokumente & PDF (qa) */
export const qaDocumentService = createDocumentService(
  574,
  'qa',
  'qa.view',
  [
    { id: 'doc-qa-001', title: 'Pilot-Checkliste', fileName: 'pilot-checklist.pdf', mimeType: 'application/pdf', status: 'aktiv' },
  ],
);
