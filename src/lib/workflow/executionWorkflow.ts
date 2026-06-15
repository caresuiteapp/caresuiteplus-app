import { createDomainWorkflow } from './domainWorkflowFactory';

/** WP275 — Workflow & Status (execution) */
export const executionWorkflow = createDomainWorkflow(275, 'execution', 'entwurf');
