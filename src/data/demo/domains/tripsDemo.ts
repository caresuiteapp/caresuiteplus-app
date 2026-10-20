import { createDomainDemo } from './domainDemoFactory';

/** WP311 — Demo-Daten (trips) */
export const tripsDemo = createDomainDemo(311, 'trips', [
  { id: 'trips-demo-001', label: 'Fahrteneintrag Alpha', status: 'aktiv' },
  { id: 'trips-demo-002', label: 'Fahrteneintrag Beta', status: 'in_bearbeitung' },
  { id: 'trips-demo-003', label: 'Fahrteneintrag Gamma', status: 'entwurf' },
]);
