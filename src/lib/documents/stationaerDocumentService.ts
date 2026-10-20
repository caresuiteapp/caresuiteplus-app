import { createDocumentService } from './documentServiceFactory';

/** WP394 — Dokumente & PDF (stationaer) */
export const stationaerDocumentService = createDocumentService(
  394,
  'stationaer',
  'stationaer.access' as never,
  [
    { id: 'doc-stationaer-001', title: 'Bewohner:in PDF', fileName: 'stationaer-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-stationaer-002', title: 'Bewohner:in Anhang', fileName: 'stationaer-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
