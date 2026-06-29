/**
 * ASSIST.WORKFLOW.3 — 1s UI tick for visit timers without per-second DB writes.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  calculateVisitTimes,
  type TimeEventLike,
  type VisitTimesSummary,
} from '@/features/assistWorkflow/calculateVisitTimes';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { EmployeePortalLiveTimers } from '@/types/modules/employeePortalTracking';

function toLiveTimers(summary: ReturnType<typeof calculateVisitTimes>): EmployeePortalLiveTimers {
  return {
    driveSeconds: summary.driveSeconds,
    serviceSeconds: summary.serviceSeconds,
    pauseSeconds: summary.pauseSeconds,
    activeTimer: summary.activeTimer,
    driveStartedAt: summary.driveStartedAt,
    serviceStartedAt: summary.serviceStartedAt,
    pauseStartedAt: summary.pauseStartedAt,
  };
}

export function useLiveVisitTimers(
  timeEvents: TimeEventLike[],
  effectiveStatus: AssignmentStatus | null,
  fallbackTimes: VisitTimesSummary | null = null,
): EmployeePortalLiveTimers | null {
  const [now, setNow] = useState(() => new Date());

  const needsLiveTick =
    effectiveStatus === 'unterwegs' ||
    effectiveStatus === 'gestartet' ||
    effectiveStatus === 'pausiert';

  useEffect(() => {
    if (!needsLiveTick) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [needsLiveTick]);

  return useMemo(() => {
    if (!effectiveStatus) return null;
    if (timeEvents.length === 0 && fallbackTimes) {
      return toLiveTimers(fallbackTimes);
    }
    if (timeEvents.length === 0) return null;
    const summary = calculateVisitTimes(
      timeEvents,
      effectiveStatus,
      needsLiveTick ? now : new Date(),
    );
    return toLiveTimers(summary);
  }, [timeEvents, effectiveStatus, needsLiveTick, now, fallbackTimes]);
}
