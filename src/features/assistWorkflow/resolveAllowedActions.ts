/**
 * ASSIST.WORKFLOW.3 — Single source for employee-portal workflow button visibility.
 */
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';
import { isAssignmentLocked } from './assistVisitStateMachine';
import type { VisitTimesSummary } from './calculateVisitTimes';
import { deriveWorkflowStatus } from './deriveWorkflowStatus';
import type { DerivedWorkflowStatus } from './deriveWorkflowStatus';

export type AssistWorkflowAllowedAction =
  | 'start_en_route'
  | 'mark_arrived'
  | 'start_service'
  | 'end_service'
  | 'start_pause'
  | 'end_pause'
  | 'report_no_show'
  | 'open_route';

export type AssistExecutionDiagnostics = {
  isServiceStarted: boolean;
  isServiceEnded: boolean;
  isTravelEnded: boolean;
  canEndService: boolean;
  inconsistentStatus: boolean;
  repairHint: string | null;
};

export function resolveAssistExecutionDiagnostics(
  recordedStatus: AssignmentStatus,
  visitTimes: VisitTimesSummary | null,
  workflow?: DerivedWorkflowStatus,
): AssistExecutionDiagnostics {
  const derived = workflow ?? deriveWorkflowStatus(recordedStatus, visitTimes);
  const isServiceStarted = Boolean(visitTimes?.serviceStartedAt);
  const isServiceEnded = Boolean(visitTimes?.serviceEndedAt);
  const isTravelEnded = Boolean(visitTimes?.arrivedAt);

  return {
    isServiceStarted,
    isServiceEnded,
    isTravelEnded,
    canEndService: isServiceStarted && !isServiceEnded,
    inconsistentStatus: derived.consistencyStatus !== 'consistent',
    repairHint: derived.nextActionHint,
  };
}

export function resolveAllowedActions(input: {
  assignmentStatus: AssignmentStatus;
  visitTimes: VisitTimesSummary | null;
  detail: EmployeePortalAssignmentDetail;
  derivedStatus?: AssignmentStatus;
  canStartService?: boolean;
}): AssistWorkflowAllowedAction[] {
  const { assignmentStatus, visitTimes, detail } = input;

  if (isAssignmentLocked(assignmentStatus) || detail.isLocked) {
    return ['open_route'];
  }

  const workflow = deriveWorkflowStatus(assignmentStatus, visitTimes);
  const status = input.derivedStatus ?? workflow.derivedStatus;
  const diagnostics = resolveAssistExecutionDiagnostics(assignmentStatus, visitTimes, workflow);
  const actions: AssistWorkflowAllowedAction[] = ['open_route'];

  if (status === 'geplant' || status === 'bestaetigt') {
    actions.push('start_en_route');
  }
  if (status === 'unterwegs') {
    actions.push('mark_arrived');
  }
  if (status === 'angekommen' && (input.canStartService ?? workflow.canStartService)) {
    actions.push('start_service');
  }
  if (status === 'gestartet' && diagnostics.canEndService) {
    actions.push('end_service');
    actions.push('start_pause');
  }
  if (status === 'pausiert' && diagnostics.canEndService) {
    actions.push('end_pause');
    actions.push('end_service');
  }
  if (detail.allowedTransitions.includes('nicht_erschienen')) {
    actions.push('report_no_show');
  }

  return actions;
}

export function primaryAllowedAction(
  actions: AssistWorkflowAllowedAction[],
  status: AssignmentStatus,
): AssistWorkflowAllowedAction | null {
  if (actions.includes('mark_arrived') && status === 'unterwegs') return 'mark_arrived';
  if (actions.includes('start_service') && status === 'angekommen') return 'start_service';
  if (actions.includes('end_service') && status === 'gestartet') return 'end_service';
  if (actions.includes('end_pause') && status === 'pausiert') return 'end_pause';
  if (actions.includes('start_en_route')) return 'start_en_route';
  return null;
}

export const ASSIST_WORKFLOW_ACTION_LABELS: Record<AssistWorkflowAllowedAction, string> = {
  start_en_route: 'Anfahrt starten',
  mark_arrived: 'Angekommen',
  start_service: 'Einsatz starten',
  end_service: 'Einsatz beenden',
  start_pause: 'Pause',
  end_pause: 'Pause beenden',
  report_no_show: 'Nicht angetroffen',
  open_route: 'Karte / Route',
};
