export { SERVICE_ERRORS } from './errors';
export { getServiceMode, type ServiceMode } from './mode';
export { runService, assertTenant } from './serviceRunner';
export {
  clientService,
  type ClientListOptions,
  type ClientUpdateInput,
  type ClientMutationContext,
} from './clients';
export {
  CLIENT_STATUS_TRANSITIONS,
  CLIENT_STATUS_HINTS,
  canTransitionStatus,
  getAllowedStatusActions,
} from './workflow/clientStatus';
export {
  validateTransition,
  getNextActions,
  getStatusTransitions,
  type WorkflowAction,
  type TransitionValidation,
} from './workflow/workflowEngine';
