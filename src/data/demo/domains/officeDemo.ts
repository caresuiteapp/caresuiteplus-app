import { createDomainDemo } from './domainDemoFactory';

/** WP151 — Demo-Daten (office) */
export const officeDemo = createDomainDemo(151, 'office', [
  { id: 'office-demo-001', label: 'Office-Stammdaten Alpha', status: 'aktiv' },
  { id: 'office-demo-002', label: 'Office-Stammdaten Beta', status: 'in_bearbeitung' },
  { id: 'office-demo-003', label: 'Office-Stammdaten Gamma', status: 'entwurf' },
]);
