import { calculateVisitTimes, type TimeEventLike, type VisitTimesSummary } from '@/features/assistWorkflow/calculateVisitTimes';
import { mergeTimeEventsWithVisitTimesFallback } from '@/features/assistWorkflow/computeLiveVisitTimers';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';

/** Reconcile timer and badge from the same status and recorded time anchors. */
export function resolveMonitoringVisitTimers(
  events: TimeEventLike[],
  status: AssignmentStatus,
  recordedTimes: VisitTimesSummary | null,
  now: Date = new Date(),
): VisitTimesSummary {
  return calculateVisitTimes(mergeTimeEventsWithVisitTimesFallback(events, recordedTimes), status, now);
}
