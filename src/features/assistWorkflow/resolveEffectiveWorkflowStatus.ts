/**
 * ASSIST.WORKFLOW.2 — Detect and repair inconsistent assignment status vs time events.
 */
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { VisitTimesSummary } from './calculateVisitTimes';

export type EffectiveWorkflowStatus = {
  /** Status used for UI actions and timers. */
  effectiveStatus: AssignmentStatus;
  /** Raw DB assignment status. */
  recordedStatus: AssignmentStatus;
  inconsistent: boolean;
  repairHint: string | null;
};

const POST_SERVICE_DOC_STATUSES: AssignmentStatus[] = [
  'beendet',
  'dokumentation_offen',
  'unterschrift_offen',
];

/** When documentation/signature steps exist without service_start, revert UI to correct step. */
export function resolveEffectiveWorkflowStatus(
  recordedStatus: AssignmentStatus,
  visitTimes: VisitTimesSummary | null,
): EffectiveWorkflowStatus {
  if (
    POST_SERVICE_DOC_STATUSES.includes(recordedStatus) &&
    !visitTimes?.serviceStartedAt
  ) {
    const effectiveStatus: AssignmentStatus = visitTimes?.arrivedAt
      ? 'angekommen'
      : visitTimes?.driveStartedAt
        ? 'unterwegs'
        : 'angekommen';

    return {
      effectiveStatus,
      recordedStatus,
      inconsistent: true,
      repairHint:
        'Einsatz wurde ohne „Einsatz starten“ beendet — bitte Einsatz starten und erneut beenden.',
    };
  }

  return {
    effectiveStatus: recordedStatus,
    recordedStatus,
    inconsistent: false,
    repairHint: null,
  };
}
