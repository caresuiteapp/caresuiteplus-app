import { createDocumentService } from './documentServiceFactory';

/** WP374 — Dokumente & PDF (pflege) */
export const pflegeDocumentService = createDocumentService(
  374,
  'pflege',
  'pflege.access' as never,
  [
    { id: 'doc-pflege-001', title: 'Pflegeplan PDF', fileName: 'pflege-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-pflege-002', title: 'Pflegeplan Anhang', fileName: 'pflege-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
