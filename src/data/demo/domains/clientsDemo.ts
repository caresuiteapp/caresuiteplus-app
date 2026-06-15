import { createDomainDemo } from './domainDemoFactory';

/** WP171 — Demo-Daten (clients) */
export const clientsDemo = createDomainDemo(171, 'clients', [
  { id: 'clients-demo-001', label: 'Klient:in Alpha', status: 'aktiv' },
  { id: 'clients-demo-002', label: 'Klient:in Beta', status: 'in_bearbeitung' },
  { id: 'clients-demo-003', label: 'Klient:in Gamma', status: 'entwurf' },
]);
