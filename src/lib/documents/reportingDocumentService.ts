import { createDocumentService } from './documentServiceFactory';

/** WP514 — Dokumente & PDF (reporting) */
export const reportingDocumentService = createDocumentService(
  514,
  'reporting',
  'business.reporting.view',
  [
    { id: 'doc-report-001', title: 'PDL-Monatsbericht PDF', fileName: 'pdl-report-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-report-002', title: 'Qualitätskennzahlen', fileName: 'quality-kpi.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
