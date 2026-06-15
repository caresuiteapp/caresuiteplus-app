import { createDocumentService } from './documentServiceFactory';

/** WP594 — Dokumente & PDF (roadmap) */
export const roadmapDocumentService = createDocumentService(
  594,
  'roadmap',
  'roadmap.view',
  [
    { id: 'doc-rm-001', title: 'Markteintritt-Plan', fileName: 'go-to-market.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
