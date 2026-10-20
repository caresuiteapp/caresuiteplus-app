import { createDomainWorkflow } from './domainWorkflowFactory';

/** WP415 — Workflow & Status (beratung) */
export const beratungWorkflow = createDomainWorkflow(415, 'beratung', 'entwurf');
