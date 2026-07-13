import type { AssistWorkflowAllowedAction } from '@/features/assistWorkflow/resolveAllowedActions';
import type { WorkflowConsistencyStatus } from '@/features/assistWorkflow/detectWorkflowInconsistencies';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';

const TASK_STATUSES: AssignmentStatus[] = [
  'gestartet',
  'pausiert',
  'beendet',
  'dokumentation_offen',
  'unterschrift_offen',
];

const POST_SERVICE_STATUSES: AssignmentStatus[] = [
  'beendet',
  'dokumentation_offen',
  'unterschrift_offen',
];

export type VisitExecutionUiStateInput = {
  visit: EmployeePortalAssignmentDetail;
  effectiveStatus: AssignmentStatus;
  consistencyStatus: WorkflowConsistencyStatus;
  allowedActions: AssistWorkflowAllowedAction[];
  awaitingSignature: boolean;
  /** True when service_end time event exists — avoids blocking doc/signature after valid end. */
  hasServiceEnded?: boolean;
};

export type VisitExecutionUiState = {
  statusBlocksDoc: boolean;
  showTasks: boolean;
  documentationSubmitted: boolean;
  signatureCaptured: boolean;
  signatureDeferred: boolean;
  showDocumentationForm: boolean;
  showSignature: boolean;
  showFinalize: boolean;
  canFinalizeDeferred: boolean;
};

export function resolveVisitExecutionUiState(
  input: VisitExecutionUiStateInput,
): VisitExecutionUiState {
  const {
    visit,
    effectiveStatus,
    consistencyStatus,
    allowedActions,
    awaitingSignature,
    hasServiceEnded = false,
  } = input;

  const documentationSubmitted = visit.documentationStatus === 'submitted';
  const signatureCaptured = visit.signatureStatus === 'captured';
  const signatureDeferred = visit.signatureStatus === 'deferred_to_client_portal';

  const statusBlocksDoc =
    consistencyStatus === 'repairable' &&
    POST_SERVICE_STATUSES.includes(visit.status) &&
    !hasServiceEnded &&
    !documentationSubmitted;

  const showTasks =
    TASK_STATUSES.includes(effectiveStatus) && !statusBlocksDoc;

  const showDocumentationForm =
    !statusBlocksDoc &&
    !documentationSubmitted &&
    (effectiveStatus === 'gestartet' ||
      POST_SERVICE_STATUSES.includes(effectiveStatus) ||
      (hasServiceEnded && !documentationSubmitted));

  const postServiceReady =
    POST_SERVICE_STATUSES.includes(effectiveStatus) ||
    (hasServiceEnded && documentationSubmitted);

  const showSignature =
    visit.requiresSignature &&
    !statusBlocksDoc &&
    documentationSubmitted &&
    !signatureCaptured &&
    !signatureDeferred;

  const showFinalize =
    !statusBlocksDoc &&
    allowedActions.includes('finalize_visit');

  const canFinalizeDeferred =
    !statusBlocksDoc &&
    allowedActions.includes('finalize_visit_deferred_signature');

  return {
    statusBlocksDoc,
    showTasks,
    documentationSubmitted,
    signatureCaptured,
    signatureDeferred,
    showDocumentationForm,
    showSignature,
    showFinalize,
    canFinalizeDeferred,
  };
}
