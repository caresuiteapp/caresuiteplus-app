import { createDomainDemo } from './domainDemoFactory';

/** WP411 — Demo-Daten (beratung) */
export const beratungDemo = createDomainDemo(411, 'beratung', [
  { id: 'beratung-demo-001', label: 'Beratungsfall Alpha', status: 'aktiv' },
  { id: 'beratung-demo-002', label: 'Beratungsfall Beta', status: 'in_bearbeitung' },
  { id: 'beratung-demo-003', label: 'Beratungsfall Gamma', status: 'entwurf' },
]);
