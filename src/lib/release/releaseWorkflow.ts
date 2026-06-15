import { createDomainWorkflow } from '@/lib/workflow/domainWorkflowFactory';

/** WP535 — Workflow & Status (release) */
export const releaseWorkflow = createDomainWorkflow(535, 'release', 'entwurf');
