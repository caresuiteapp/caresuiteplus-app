import { createDomainDemo } from './domainDemoFactory';

/** WP291 — Demo-Daten (careRecords) */
export const careRecordsDemo = createDomainDemo(291, 'careRecords', [
  { id: 'careRecords-demo-001', label: 'Pflegenachweis Alpha', status: 'aktiv' },
  { id: 'careRecords-demo-002', label: 'Pflegenachweis Beta', status: 'in_bearbeitung' },
  { id: 'careRecords-demo-003', label: 'Pflegenachweis Gamma', status: 'entwurf' },
]);
