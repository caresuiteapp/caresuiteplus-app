import { createDocumentService } from './documentServiceFactory';

/** WP294 — Dokumente & PDF (careRecords) */
export const careRecordsDocumentService = createDocumentService(
  294,
  'careRecords',
  'assist.records.view' as never,
  [
    { id: 'doc-careRecords-001', title: 'Pflegenachweis PDF', fileName: 'careRecords-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-careRecords-002', title: 'Pflegenachweis Anhang', fileName: 'careRecords-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
