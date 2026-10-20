import { createDocumentService } from './documentServiceFactory';

/** WP414 — Dokumente & PDF (beratung) */
export const beratungDocumentService = createDocumentService(
  414,
  'beratung',
  'beratung.access' as never,
  [
    { id: 'doc-beratung-001', title: 'Beratungsfall PDF', fileName: 'beratung-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-beratung-002', title: 'Beratungsfall Anhang', fileName: 'beratung-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
