import { createDocumentService } from './documentServiceFactory';

/** WP474 — Dokumente & PDF (platform) */
export const platformDocumentService = createDocumentService(
  474,
  'platform',
  'platform.ocr.view' as never,
  [
    { id: 'doc-platform-001', title: 'OCR-Job PDF', fileName: 'platform-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-platform-002', title: 'OCR-Job Anhang', fileName: 'platform-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
