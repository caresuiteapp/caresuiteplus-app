import { createDomainDemo } from './domainDemoFactory';

/** WP271 — Demo-Daten (execution) */
export const executionDemo = createDomainDemo(271, 'execution', [
  { id: 'execution-demo-001', label: 'Durchführungsprotokoll Alpha', status: 'aktiv' },
  { id: 'execution-demo-002', label: 'Durchführungsprotokoll Beta', status: 'in_bearbeitung' },
  { id: 'execution-demo-003', label: 'Durchführungsprotokoll Gamma', status: 'entwurf' },
]);
