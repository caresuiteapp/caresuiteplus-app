import { createDomainWorkflow } from '@/lib/workflow/domainWorkflowFactory';

/** WP575 — Workflow & Status (qa) */
export const qaWorkflow = createDomainWorkflow(575, 'qa', 'in_bearbeitung');
