import { createDomainWorkflow } from './domainWorkflowFactory';

/** WP235 — Workflow & Status (billing) */
export const billingWorkflow = createDomainWorkflow(235, 'billing', 'entwurf');
