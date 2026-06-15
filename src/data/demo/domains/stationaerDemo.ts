import { createDomainDemo } from './domainDemoFactory';

/** WP391 — Demo-Daten (stationaer) */
export const stationaerDemo = createDomainDemo(391, 'stationaer', [
  { id: 'stationaer-demo-001', label: 'Bewohner:in Alpha', status: 'aktiv' },
  { id: 'stationaer-demo-002', label: 'Bewohner:in Beta', status: 'in_bearbeitung' },
  { id: 'stationaer-demo-003', label: 'Bewohner:in Gamma', status: 'entwurf' },
]);
