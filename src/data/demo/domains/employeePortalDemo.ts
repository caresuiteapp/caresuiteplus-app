import { createDomainDemo } from './domainDemoFactory';

/** WP331 — Demo-Daten (employeePortal) */
export const employeePortalDemo = createDomainDemo(331, 'employeePortal', [
  { id: 'employeePortal-demo-001', label: 'Portal-Zeiteintrag Alpha', status: 'aktiv' },
  { id: 'employeePortal-demo-002', label: 'Portal-Zeiteintrag Beta', status: 'in_bearbeitung' },
  { id: 'employeePortal-demo-003', label: 'Portal-Zeiteintrag Gamma', status: 'entwurf' },
]);
