import { createDocumentService } from './documentServiceFactory';

/** WP234 — Dokumente & PDF (billing) */
export const billingDocumentService = createDocumentService(
  234,
  'billing',
  'office.invoices.view' as never,
  [
    { id: 'doc-billing-001', title: 'Rechnungsentwurf PDF', fileName: 'billing-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-billing-002', title: 'Rechnungsentwurf Anhang', fileName: 'billing-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
