import { createDocumentService } from './documentServiceFactory';

/** WP194 — Dokumente & PDF (employees) */
export const employeesDocumentService = createDocumentService(
  194,
  'employees',
  'office.employees.view' as never,
  [
    { id: 'doc-employees-001', title: 'Mitarbeitende:r PDF', fileName: 'employees-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-employees-002', title: 'Mitarbeitende:r Anhang', fileName: 'employees-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
