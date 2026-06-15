import { createDocumentService } from './documentServiceFactory';

/** WP134 — Dokumente & PDF (business) */
export const businessDocumentService = createDocumentService(
  134,
  'business',
  'dashboard.view' as never,
  [
    { id: 'doc-business-001', title: 'Business-KPI PDF', fileName: 'business-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-business-002', title: 'Business-KPI Anhang', fileName: 'business-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
