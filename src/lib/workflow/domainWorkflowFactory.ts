import type { WorkflowStatus } from '@/types/core/base';
import { validateTransition, getNextActions } from '@/lib/services/workflow/workflowEngine';

export type DomainWorkflowConfig = {
  wpNumber: number;
  domain: string;
  initialStatus: WorkflowStatus;
  validate: typeof validateTransition;
  getActions: typeof getNextActions;
};

export function createDomainWorkflow(
  wpNumber: number,
  domain: string,
  initialStatus: WorkflowStatus = 'entwurf',
): DomainWorkflowConfig {
  return {
    wpNumber,
    domain,
    initialStatus,
    validate: validateTransition,
    getActions: getNextActions,
  };
}
