import { createDomainWorkflow } from './domainWorkflowFactory';

/** WP375 — Workflow & Status (pflege) */
export const pflegeWorkflow = createDomainWorkflow(375, 'pflege', 'entwurf');
