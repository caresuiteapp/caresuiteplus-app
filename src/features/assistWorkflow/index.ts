export type { AssistExecutionContext, AssistWorkflowActionResult, AssistWorkflowStep } from './types';
export {
  ASSIST_WORKFLOW_STEP_LABELS,
  assignmentStatusToWorkflowStep,
  getPrimaryWorkflowAction,
  getWorkflowTimelineSteps,
  isWorkflowStepComplete,
  validateWorkflowTransition,
  getAllowedWorkflowTransitions,
  isAssignmentLocked,
} from './assistVisitStateMachine';
export {
  createAssistWorkflowError,
  assistWorkflowErrorFromSupabase,
  logAssistWorkflowError,
  assistWorkflowErrorToResult,
} from './assistWorkflowErrors';
export type { AssistWorkflowError, AssistWorkflowErrorCode } from './assistWorkflowErrors';
export { calculateVisitTimes } from './calculateVisitTimes';
export type { VisitTimesSummary, TimeEventLike } from './calculateVisitTimes';
export { getVisitTimeSegments, hasServiceStarted, hasTravelEnded } from './getVisitTimeSegments';
export type { VisitTimeSegment } from './getVisitTimeSegments';
export { saveVisitTimeEvent, ensureVisitTimeEvent } from './saveVisitTimeEvent';
export type { SaveVisitTimeEventInput, VisitTimeEventType } from './saveVisitTimeEvent';
export { resolveEffectiveWorkflowStatus } from './resolveEffectiveWorkflowStatus';
export type { EffectiveWorkflowStatus } from './resolveEffectiveWorkflowStatus';
export { deriveWorkflowStatus } from './deriveWorkflowStatus';
export { detectWorkflowInconsistencies, resolveConsistencyStatus } from './detectWorkflowInconsistencies';
export { repairWorkflowState } from './repairWorkflowState';
export { adminRepairVisitWorkflow, adminRepairVisitWorkflowSafe } from './adminRepairVisitWorkflow';
export type { DerivedWorkflowStatus, WorkflowRepairOption } from './deriveWorkflowStatus';
export type {
  WorkflowInconsistency,
  WorkflowInconsistencyCode,
  WorkflowConsistencyStatus,
} from './detectWorkflowInconsistencies';
export type { AdminRepairVisitWorkflowInput, AdminRepairVisitWorkflowResult } from './adminRepairVisitWorkflow';
export { resolveAssistExecutionContext } from './resolveAssistExecutionContext';
export { startEnRoute } from './startEnRoute';
export {
  markArrived,
  ARRIVED_WITHOUT_GPS_WARNING,
  ARRIVED_MANUAL_WARNING,
  type ArrivalMode,
  type MarkArrivedInput,
  type MarkArrivedResult,
} from './markArrived';
export { startService } from './startService';
export { startPause } from './startPause';
export { endPause } from './endPause';
export { endService } from './endService';
export { saveTaskResults } from './saveTaskResults';
export { saveTaskResultsBatch } from './saveTaskResultsBatch';
export type { TaskResultBatchItem, SaveTaskResultsBatchInput } from './saveTaskResultsBatch';
export {
  resolveAllowedActions,
  resolveAssistExecutionDiagnostics,
  primaryAllowedAction,
  ASSIST_WORKFLOW_ACTION_LABELS,
} from './resolveAllowedActions';
export type {
  AssistWorkflowAllowedAction,
  AssistExecutionDiagnostics,
} from './resolveAllowedActions';
export { saveVisitDocumentation } from './saveVisitDocumentation';
export { saveClientSignature, hasPersistedClientSignature } from './saveClientSignature';
export { generateServiceRecord } from './generateServiceRecord';
export { finalizeVisit } from './finalizeVisit';
export { reportNoShow } from './reportNoShow';
export { buildServiceRecordHtml, buildServiceRecordSnapshot } from './buildServiceRecordHtml';
export { readExecutionStatusForPortals } from './readExecutionStatusForPortals';
export type { PortalExecutionStatusView } from './readExecutionStatusForPortals';
