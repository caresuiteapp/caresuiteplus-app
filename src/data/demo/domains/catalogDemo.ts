import { createDomainDemo } from './domainDemoFactory';

/** WP451 — Demo-Daten (catalog) */
export const catalogDemo = createDomainDemo(451, 'catalog', [
  { id: 'catalog-demo-001', label: 'Katalogposition Alpha', status: 'aktiv' },
  { id: 'catalog-demo-002', label: 'Katalogposition Beta', status: 'in_bearbeitung' },
  { id: 'catalog-demo-003', label: 'Katalogposition Gamma', status: 'entwurf' },
]);
