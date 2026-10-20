import { createDomainDemo } from './domainDemoFactory';

/** WP251 — Demo-Daten (assistPlanning) */
export const assistPlanningDemo = createDomainDemo(251, 'assistPlanning', [
  { id: 'assistPlanning-demo-001', label: 'Einsatzplan Alpha', status: 'aktiv' },
  { id: 'assistPlanning-demo-002', label: 'Einsatzplan Beta', status: 'in_bearbeitung' },
  { id: 'assistPlanning-demo-003', label: 'Einsatzplan Gamma', status: 'entwurf' },
]);
