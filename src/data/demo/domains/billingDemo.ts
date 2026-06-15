import { createDomainDemo } from './domainDemoFactory';

/** WP231 — Demo-Daten (billing) */
export const billingDemo = createDomainDemo(231, 'billing', [
  { id: 'billing-demo-001', label: 'Rechnungsentwurf Alpha', status: 'aktiv' },
  { id: 'billing-demo-002', label: 'Rechnungsentwurf Beta', status: 'in_bearbeitung' },
  { id: 'billing-demo-003', label: 'Rechnungsentwurf Gamma', status: 'entwurf' },
]);
