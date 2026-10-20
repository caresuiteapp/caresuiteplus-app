import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { EmployeeLiveContext } from '@/features/liveTracking/resolveEmployeeLiveContext';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';
import type { TimeEventLike, VisitTimesSummary } from './calculateVisitTimes';
import type {
  AssistExecutionDiagnostics,
  AssistWorkflowAllowedAction,
} from './resolveAllowedActions';
import type { WorkflowConsistencyStatus, WorkflowInconsistency } from './detectWorkflowInconsistencies';
import type { WorkflowRepairOption } from './deriveWorkflowStatus';

/** Guided employee-portal workflow steps (ASSIST.WORKFLOW.1). */
export type AssistWorkflowStep =
  | 'consent'
  | 'en_route'
  | 'arrived'
  | 'in_service'
  | 'paused'
  | 'tasks'
  | 'documentation'
  | 'signature'
  | 'finalize'
  | 'completed'
  | 'no_show'
  | 'locked';

export type AssistExecutionContext = {
  tenantId: string;
  assignmentId: string;
  employeeId: string;
  profileId: string | null;
  roleKey: string | null;
  assistVisitId: string;
  assignmentStatus: AssignmentStatus;
  /** Timestamp-derived status for UI and actions (single source). */
  derivedStatus: AssignmentStatus;
  consistencyStatus: WorkflowConsistencyStatus;
  inconsistencies: WorkflowInconsistency[];
  repairOptions: WorkflowRepairOption[];
  detail: EmployeePortalAssignmentDetail;
  liveContext: EmployeeLiveContext | null;
  visitTimes: VisitTimesSummary | null;
  /** Raw assist_time_events for live timer ticks (no per-second DB reads). */
  timeEvents: TimeEventLike[];
  allowedActions: AssistWorkflowAllowedAction[];
  diagnostics: AssistExecutionDiagnostics;
};

export type AssistWorkflowActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };
