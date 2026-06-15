import { createDocumentService } from './documentServiceFactory';

/** WP154 — Dokumente & PDF (office) */
export const officeDocumentService = createDocumentService(
  154,
  'office',
  'office.access' as never,
  [
    { id: 'doc-office-001', title: 'Office-Stammdaten PDF', fileName: 'office-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-office-002', title: 'Office-Stammdaten Anhang', fileName: 'office-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
