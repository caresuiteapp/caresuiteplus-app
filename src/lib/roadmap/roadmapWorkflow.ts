import { createDomainWorkflow } from '@/lib/workflow/domainWorkflowFactory';

/** WP595 — Workflow & Status (roadmap) */
export const roadmapWorkflow = createDomainWorkflow(595, 'roadmap', 'entwurf');
