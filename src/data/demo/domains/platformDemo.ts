import { createDomainDemo } from './domainDemoFactory';

/** WP471 — Demo-Daten (platform) */
export const platformDemo = createDomainDemo(471, 'platform', [
  { id: 'platform-demo-001', label: 'OCR-Job Alpha', status: 'aktiv' },
  { id: 'platform-demo-002', label: 'OCR-Job Beta', status: 'in_bearbeitung' },
  { id: 'platform-demo-003', label: 'OCR-Job Gamma', status: 'entwurf' },
]);
