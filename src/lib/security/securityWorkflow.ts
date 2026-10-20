import { createDomainWorkflow } from '@/lib/workflow/domainWorkflowFactory';

/** WP555 — Workflow & Status (security) */
export const securityWorkflow = createDomainWorkflow(555, 'security', 'in_bearbeitung');
