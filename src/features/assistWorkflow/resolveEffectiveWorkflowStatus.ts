/**
 * ASSIST.WORKFLOW.2 / STABILIZE.1 — Back-compat wrapper around deriveWorkflowStatus.
 */
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { VisitTimesSummary } from './calculateVisitTimes';
import { deriveWorkflowStatus } from './deriveWorkflowStatus';

export type EffectiveWorkflowStatus = {
  effectiveStatus: AssignmentStatus;
  recordedStatus: AssignmentStatus;
  inconsistent: boolean;
  repairHint: string | null;
};

export function resolveEffectiveWorkflowStatus(
  recordedStatus: AssignmentStatus,
  visitTimes: VisitTimesSummary | null,
): EffectiveWorkflowStatus {
  const derived = deriveWorkflowStatus(recordedStatus, visitTimes);
  return {
    effectiveStatus: derived.derivedStatus,
    recordedStatus: derived.recordedStatus,
    inconsistent: derived.consistencyStatus !== 'consistent',
    repairHint: derived.nextActionHint,
  };
}
