/**
 * ASSIST.STABILIZE.1 — Single derived status from timestamps + recorded status.
 */
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { VisitTimesSummary } from './calculateVisitTimes';
import {
  detectWorkflowInconsistencies,
  resolveConsistencyStatus,
  type WorkflowConsistencyStatus,
  type WorkflowInconsistency,
} from './detectWorkflowInconsistencies';
export type WorkflowRepairOption = {
  action: 'reset_status' | 'backfill_service_start';
  targetStatus: AssignmentStatus;
  label: string;
};

function buildRepairOptions(inconsistencies: WorkflowInconsistency[]): WorkflowRepairOption[] {
  return inconsistencies
    .filter((i) => i.repairable)
    .map((i) => ({
      action:
        i.code === 'in_service_without_service_start' && i.recordedStatus === 'gestartet'
          ? 'backfill_service_start'
          : 'reset_status',
      targetStatus: i.expectedStatus,
      label:
        i.expectedStatus === 'angekommen'
          ? 'Status auf „Angekommen“ zurücksetzen'
          : 'Status korrigieren',
    }));
}

const IN_SERVICE_STATUSES: AssignmentStatus[] = ['gestartet', 'pausiert'];
const POST_SERVICE_STATUSES: AssignmentStatus[] = [
  'beendet',
  'dokumentation_offen',
  'unterschrift_offen',
];

export type DerivedWorkflowStatus = {
  derivedStatus: AssignmentStatus;
  recordedStatus: AssignmentStatus;
  consistencyStatus: WorkflowConsistencyStatus;
  inconsistencies: WorkflowInconsistency[];
  repairOptions: WorkflowRepairOption[];
  canStartService: boolean;
  /** Soft UI hint when repairable — not a blocking error. */
  nextActionHint: string | null;
};

export function deriveWorkflowStatus(
  recordedStatus: AssignmentStatus,
  visitTimes: VisitTimesSummary | null,
): DerivedWorkflowStatus {
  const inconsistencies = detectWorkflowInconsistencies(recordedStatus, visitTimes);
  const consistencyStatus = resolveConsistencyStatus(inconsistencies);
  const repairOptions = buildRepairOptions(inconsistencies);

  let derivedStatus = recordedStatus;

  if (
    IN_SERVICE_STATUSES.includes(recordedStatus) &&
    !visitTimes?.serviceStartedAt
  ) {
    derivedStatus = visitTimes?.arrivedAt ? 'angekommen' : 'unterwegs';
  } else if (
    POST_SERVICE_STATUSES.includes(recordedStatus) &&
    !visitTimes?.serviceStartedAt
  ) {
    derivedStatus = visitTimes?.arrivedAt
      ? 'angekommen'
      : visitTimes?.driveStartedAt
        ? 'unterwegs'
        : 'angekommen';
  } else if (recordedStatus === 'unterwegs' && visitTimes?.arrivedAt) {
    derivedStatus = 'angekommen';
  }

  // Time events are source of truth when DB status lagged (e.g. after manual repair + re-run flow).
  if (visitTimes?.serviceEndedAt) {
    const preCompletion: AssignmentStatus[] = [
      'geplant',
      'bestaetigt',
      'unterwegs',
      'angekommen',
      'gestartet',
      'pausiert',
    ];
    if (preCompletion.includes(derivedStatus)) {
      derivedStatus = 'beendet';
    }
  } else if (visitTimes?.serviceStartedAt) {
    if (derivedStatus === 'unterwegs' || derivedStatus === 'angekommen') {
      derivedStatus = 'gestartet';
    }
  }

  const canStartService =
    derivedStatus === 'angekommen' &&
    Boolean(visitTimes?.arrivedAt || recordedStatus === 'angekommen');

  const nextActionHint =
    consistencyStatus === 'repairable' && canStartService
      ? 'Bitte „Einsatz starten“ bestätigen, um fortzufahren.'
      : consistencyStatus === 'repairable' && inconsistencies[0]
        ? inconsistencies[0].userHint
        : null;

  return {
    derivedStatus,
    recordedStatus,
    consistencyStatus,
    inconsistencies,
    repairOptions,
    canStartService,
    nextActionHint,
  };
}
