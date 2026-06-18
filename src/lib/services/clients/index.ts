export { clientService } from './clientService';
export {
  workflowStatusToRemote,
  remoteStatusToWorkflow,
  type RemoteClientStatus,
} from './clientStatusBridge';
export {
  validateClientProductionForm,
  validateClientProductionStep,
  hasProductionErrors,
} from './clientProductionValidation';
export { writeClientAudit, writeClientHistory } from './clientAuditHelper';
export type {
  ClientListOptions,
  ClientUpdateInput,
  ClientRepository,
  ClientMutationContext,
} from './types';
