import { createDocumentService } from './documentServiceFactory';

/** WP314 — Dokumente & PDF (trips) */
export const tripsDocumentService = createDocumentService(
  314,
  'trips',
  'assist.trips.view' as never,
  [
    { id: 'doc-trips-001', title: 'Fahrteneintrag PDF', fileName: 'trips-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-trips-002', title: 'Fahrteneintrag Anhang', fileName: 'trips-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
