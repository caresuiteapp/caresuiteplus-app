import { createDomainDemo } from './domainDemoFactory';

/** WP191 — Demo-Daten (employees) */
export const employeesDemo = createDomainDemo(191, 'employees', [
  { id: 'employees-demo-001', label: 'Mitarbeitende:r Alpha', status: 'aktiv' },
  { id: 'employees-demo-002', label: 'Mitarbeitende:r Beta', status: 'in_bearbeitung' },
  { id: 'employees-demo-003', label: 'Mitarbeitende:r Gamma', status: 'entwurf' },
]);
