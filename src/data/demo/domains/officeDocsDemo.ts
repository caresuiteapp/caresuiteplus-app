import { createDomainDemo } from './domainDemoFactory';

/** WP211 — Demo-Daten (officeDocs) */
export const officeDocsDemo = createDomainDemo(211, 'officeDocs', [
  { id: 'officeDocs-demo-001', label: 'Office-Dokument Alpha', status: 'aktiv' },
  { id: 'officeDocs-demo-002', label: 'Office-Dokument Beta', status: 'in_bearbeitung' },
  { id: 'officeDocs-demo-003', label: 'Office-Dokument Gamma', status: 'entwurf' },
]);
