import type { AssignmentStatus } from '@/types/modules/assignmentStatus';

export type AssignmentLifecycleTimestamps = {
  on_the_way_at?: string | null;
  arrived_at?: string | null;
  actual_start_at?: string | null;
  actual_end_at?: string | null;
  finished_at?: string | null;
};

/** Status transitions after physical service ended must not move execution clocks. */
const POST_SERVICE_STATUSES: AssignmentStatus[] = [
  'dokumentation_offen',
  'unterschrift_offen',
  'abgeschlossen',
];

/**
 * Patch lifecycle timestamps for a status transition.
 * Never overwrites an existing timestamp — re-editing documentation/signature must not shift times.
 */
export function timestampPatchForStatusTransition(
  to: AssignmentStatus,
  now: string,
  existing: AssignmentLifecycleTimestamps = {},
): Record<string, string> {
  if (POST_SERVICE_STATUSES.includes(to)) {
    return {};
  }

  const patch: Record<string, string> = {};

  switch (to) {
    case 'unterwegs':
      if (!existing.on_the_way_at) patch.on_the_way_at = now;
      break;
    case 'angekommen':
      if (!existing.arrived_at) patch.arrived_at = now;
      break;
    case 'gestartet':
      if (!existing.actual_start_at) patch.actual_start_at = now;
      break;
    case 'beendet':
      if (!existing.actual_end_at) patch.actual_end_at = now;
      if (!existing.finished_at) patch.finished_at = now;
      break;
    default:
      break;
  }

  return patch;
}

const FINALIZE_OVERWRITE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Resolve displayed service end — prefer time events / execution_state over assignment rows
 * that may have been overwritten by a late documentation or signature finalize.
 */
export function resolveServiceEndedAt(input: {
  fromEvents?: string | null;
  fromExecutionState?: string | null;
  fromAssignment?: string | null;
}): string | null {
  if (input.fromEvents) return input.fromEvents;

  const executionEnd = input.fromExecutionState ?? null;
  const assignmentEnd = input.fromAssignment ?? null;

  if (executionEnd && assignmentEnd) {
    const executionMs = new Date(executionEnd).getTime();
    const assignmentMs = new Date(assignmentEnd).getTime();
    if (
      Number.isFinite(executionMs) &&
      Number.isFinite(assignmentMs) &&
      assignmentMs - executionMs > FINALIZE_OVERWRITE_THRESHOLD_MS
    ) {
      return executionEnd;
    }
  }

  return executionEnd ?? assignmentEnd;
}
