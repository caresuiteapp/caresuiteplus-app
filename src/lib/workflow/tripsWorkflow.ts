import { createDomainWorkflow } from './domainWorkflowFactory';

/** WP315 — Workflow & Status (trips) */
export const tripsWorkflow = createDomainWorkflow(315, 'trips', 'entwurf');
