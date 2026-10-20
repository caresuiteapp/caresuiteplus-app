import { createDocumentService } from './documentServiceFactory';

/** WP434 — Dokumente & PDF (catalog) */
export const catalogDocumentService = createDocumentService(
  434,
  'catalog',
  'office.catalogs.view' as never,
  [
    { id: 'doc-catalog-001', title: 'Katalogposition PDF', fileName: 'catalog-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-catalog-002', title: 'Katalogposition Anhang', fileName: 'catalog-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
