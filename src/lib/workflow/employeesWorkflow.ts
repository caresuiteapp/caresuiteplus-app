import { createDomainWorkflow } from './domainWorkflowFactory';

/** WP195 — Workflow & Status (employees) */
export const employeesWorkflow = createDomainWorkflow(195, 'employees', 'entwurf');
