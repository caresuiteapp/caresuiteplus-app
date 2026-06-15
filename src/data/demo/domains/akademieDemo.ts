import { createDomainDemo } from './domainDemoFactory';

/** WP431 — Demo-Daten (akademie) */
export const akademieDemo = createDomainDemo(431, 'akademie', [
  { id: 'akademie-demo-001', label: 'Kurs Alpha', status: 'aktiv' },
  { id: 'akademie-demo-002', label: 'Kurs Beta', status: 'in_bearbeitung' },
  { id: 'akademie-demo-003', label: 'Kurs Gamma', status: 'entwurf' },
]);
