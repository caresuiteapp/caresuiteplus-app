import { createDocumentService } from './documentServiceFactory';

/** WP174 — Dokumente & PDF (clients) */
export const clientsDocumentService = createDocumentService(
  174,
  'clients',
  'office.clients.view' as never,
  [
    { id: 'doc-clients-001', title: 'Klient:in PDF', fileName: 'clients-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-clients-002', title: 'Klient:in Anhang', fileName: 'clients-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
