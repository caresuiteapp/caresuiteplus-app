import { createDomainWorkflow } from '@/lib/workflow/domainWorkflowFactory';

/** WP515 — Workflow & Status Reporting */
export const reportingWorkflow = createDomainWorkflow(515, 'reporting', 'entwurf');
