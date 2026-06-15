import { createDocumentService } from './documentServiceFactory';

/** WP274 — Dokumente & PDF (execution) */
export const executionDocumentService = createDocumentService(
  274,
  'execution',
  'assist.execution.view' as never,
  [
    { id: 'doc-execution-001', title: 'Durchführungsprotokoll PDF', fileName: 'execution-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-execution-002', title: 'Durchführungsprotokoll Anhang', fileName: 'execution-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
