import { createDocumentService } from './documentServiceFactory';

/** WP354 — Dokumente & PDF (clientPortal) */
export const clientPortalDocumentService = createDocumentService(
  354,
  'clientPortal',
  'portal.client.profile.view' as never,
  [
    { id: 'doc-clientPortal-001', title: 'Klientenanfrage PDF', fileName: 'clientPortal-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-clientPortal-002', title: 'Klientenanfrage Anhang', fileName: 'clientPortal-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
