import { createDomainWorkflow } from './domainWorkflowFactory';

/** WP295 — Workflow & Status (careRecords) */
export const careRecordsWorkflow = createDomainWorkflow(295, 'careRecords', 'entwurf');
