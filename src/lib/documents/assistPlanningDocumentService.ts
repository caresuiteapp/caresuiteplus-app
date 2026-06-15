import { createDocumentService } from './documentServiceFactory';

/** WP254 — Dokumente & PDF (assistPlanning) */
export const assistPlanningDocumentService = createDocumentService(
  254,
  'assistPlanning',
  'assist.assignments.view' as never,
  [
    { id: 'doc-assistPlanning-001', title: 'Einsatzplan PDF', fileName: 'assistPlanning-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-assistPlanning-002', title: 'Einsatzplan Anhang', fileName: 'assistPlanning-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
