import { createDomainDemo } from './domainDemoFactory';

/** WP491 — Demo-Daten (integrations) */
export const integrationsDemo = createDomainDemo(491, 'integrations', [
  { id: 'integrations-demo-001', label: 'Integration Alpha', status: 'aktiv' },
  { id: 'integrations-demo-002', label: 'Integration Beta', status: 'in_bearbeitung' },
  { id: 'integrations-demo-003', label: 'Integration Gamma', status: 'entwurf' },
]);
