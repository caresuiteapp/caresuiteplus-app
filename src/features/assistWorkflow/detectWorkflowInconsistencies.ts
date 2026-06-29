/**
 * ASSIST.STABILIZE.1 — Detect mismatches between assignment status and time events.
 */
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { VisitTimesSummary } from './calculateVisitTimes';

export type WorkflowInconsistencyCode =
  | 'status_ahead_without_service_start'
  | 'status_ahead_without_travel_end'
  | 'in_service_without_service_start'
  | 'post_service_without_service_start';

export type WorkflowInconsistency = {
  code: WorkflowInconsistencyCode;
  recordedStatus: AssignmentStatus;
  expectedStatus: AssignmentStatus;
  repairable: boolean;
  /** User-facing hint — action-oriented, not a dead-end error. */
  userHint: string;
};

const IN_SERVICE_STATUSES: AssignmentStatus[] = ['gestartet', 'pausiert'];
const POST_SERVICE_STATUSES: AssignmentStatus[] = [
  'beendet',
  'dokumentation_offen',
  'unterschrift_offen',
];

export function detectWorkflowInconsistencies(
  recordedStatus: AssignmentStatus,
  visitTimes: VisitTimesSummary | null,
): WorkflowInconsistency[] {
  const inconsistencies: WorkflowInconsistency[] = [];
  const hasArrived = Boolean(visitTimes?.arrivedAt);
  const hasServiceStart = Boolean(visitTimes?.serviceStartedAt);
  const hasDriveStart = Boolean(visitTimes?.driveStartedAt);

  if (IN_SERVICE_STATUSES.includes(recordedStatus) && !hasServiceStart) {
    inconsistencies.push({
      code: 'in_service_without_service_start',
      recordedStatus,
      expectedStatus: hasArrived ? 'angekommen' : hasDriveStart ? 'unterwegs' : 'angekommen',
      repairable: true,
      userHint: 'Bitte „Einsatz starten“ bestätigen, um fortzufahren.',
    });
  }

  if (POST_SERVICE_STATUSES.includes(recordedStatus) && !hasServiceStart) {
    inconsistencies.push({
      code: 'post_service_without_service_start',
      recordedStatus,
      expectedStatus: hasArrived ? 'angekommen' : hasDriveStart ? 'unterwegs' : 'angekommen',
      repairable: true,
      userHint: 'Einsatz wurde noch nicht gestartet — bitte „Einsatz starten“ bestätigen.',
    });
  }

  if (
    recordedStatus === 'unterwegs' &&
    hasArrived &&
    !visitTimes?.serviceStartedAt
  ) {
    inconsistencies.push({
      code: 'status_ahead_without_travel_end',
      recordedStatus,
      expectedStatus: 'angekommen',
      repairable: true,
      userHint: 'Ankunft erkannt — bitte „Einsatz starten“ bestätigen.',
    });
  }

  return inconsistencies;
}

export type WorkflowConsistencyStatus = 'consistent' | 'repairable' | 'blocked';

export function resolveConsistencyStatus(
  inconsistencies: WorkflowInconsistency[],
): WorkflowConsistencyStatus {
  if (inconsistencies.length === 0) return 'consistent';
  if (inconsistencies.every((i) => i.repairable)) return 'repairable';
  return 'blocked';
}
