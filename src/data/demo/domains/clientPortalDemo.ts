import { createDomainDemo } from './domainDemoFactory';

/** WP351 — Demo-Daten (clientPortal) */
export const clientPortalDemo = createDomainDemo(351, 'clientPortal', [
  { id: 'clientPortal-demo-001', label: 'Klientenanfrage Alpha', status: 'aktiv' },
  { id: 'clientPortal-demo-002', label: 'Klientenanfrage Beta', status: 'in_bearbeitung' },
  { id: 'clientPortal-demo-003', label: 'Klientenanfrage Gamma', status: 'entwurf' },
]);
