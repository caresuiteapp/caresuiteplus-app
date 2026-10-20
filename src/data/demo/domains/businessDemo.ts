import { createDomainDemo } from './domainDemoFactory';

/** WP131 — Demo-Daten (business) */
export const businessDemo = createDomainDemo(131, 'business', [
  { id: 'business-demo-001', label: 'Business-KPI Alpha', status: 'aktiv' },
  { id: 'business-demo-002', label: 'Business-KPI Beta', status: 'in_bearbeitung' },
  { id: 'business-demo-003', label: 'Business-KPI Gamma', status: 'entwurf' },
]);
