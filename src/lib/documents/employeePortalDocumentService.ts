import { createDocumentService } from './documentServiceFactory';

/** WP334 — Dokumente & PDF (employeePortal) */
export const employeePortalDocumentService = createDocumentService(
  334,
  'employeePortal',
  'portal.employee.profile.view' as never,
  [
    { id: 'doc-employeePortal-001', title: 'Portal-Zeiteintrag PDF', fileName: 'employeePortal-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-employeePortal-002', title: 'Portal-Zeiteintrag Anhang', fileName: 'employeePortal-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
