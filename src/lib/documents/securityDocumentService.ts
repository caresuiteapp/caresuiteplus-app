import { createDocumentService } from './documentServiceFactory';

/** WP554 — Dokumente & PDF (security) */
export const securityDocumentService = createDocumentService(
  554,
  'security',
  'security.view',
  [
    { id: 'doc-sec-001', title: 'DSGVO-Auditbericht', fileName: 'dsgvo-audit.pdf', mimeType: 'application/pdf', status: 'aktiv' },
  ],
);
