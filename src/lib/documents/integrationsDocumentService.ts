import { createDocumentService } from './documentServiceFactory';

/** WP494 — Dokumente & PDF (integrations) */
export const integrationsDocumentService = createDocumentService(
  494,
  'integrations',
  'integrations.view' as never,
  [
    { id: 'doc-integrations-001', title: 'Integration PDF', fileName: 'integrations-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-integrations-002', title: 'Integration Anhang', fileName: 'integrations-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
