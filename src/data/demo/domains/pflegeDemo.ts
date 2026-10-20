import { createDomainDemo } from './domainDemoFactory';

/** WP371 — Demo-Daten (pflege) */
export const pflegeDemo = createDomainDemo(371, 'pflege', [
  { id: 'pflege-demo-001', label: 'Pflegeplan Alpha', status: 'aktiv' },
  { id: 'pflege-demo-002', label: 'Pflegeplan Beta', status: 'in_bearbeitung' },
  { id: 'pflege-demo-003', label: 'Pflegeplan Gamma', status: 'entwurf' },
]);
