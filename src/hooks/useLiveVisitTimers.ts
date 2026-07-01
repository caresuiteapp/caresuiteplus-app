/**
 * ASSIST.WORKFLOW.3 — 1s UI tick for visit timers without per-second DB writes.
 */
import { useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { TimeEventLike, VisitTimesSummary } from '@/features/assistWorkflow/calculateVisitTimes';
import {
  computeLiveVisitTimers,
  isActiveVisitTimerStatus,
} from '@/features/assistWorkflow/computeLiveVisitTimers';
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import type { EmployeePortalLiveTimers } from '@/types/modules/employeePortalTracking';

export {
  buildTimeEventsFromVisitTimesSummary,
  computeLiveVisitTimers,
  isActiveVisitTimerStatus,
} from '@/features/assistWorkflow/computeLiveVisitTimers';

export function useLiveVisitTimers(
  timeEvents: TimeEventLike[],
  effectiveStatus: AssignmentStatus | null,
  fallbackTimes: VisitTimesSummary | null = null,
  enabled = true,
  localTimers?: (now: Date) => EmployeePortalLiveTimers | null,
): EmployeePortalLiveTimers | null {
  const [now, setNow] = useState(() => new Date());

  const needsLiveTick = enabled && isActiveVisitTimerStatus(effectiveStatus);

  useEffect(() => {
    if (!needsLiveTick) return;

    const isHidden = () => {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        return document.visibilityState === 'hidden';
      }
      return AppState.currentState !== 'active';
    };

    const id = setInterval(() => {
      if (!isHidden()) setNow(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, [needsLiveTick]);

  return useMemo(
    () =>
      computeLiveVisitTimers(
        timeEvents,
        effectiveStatus,
        fallbackTimes,
        now,
        enabled,
        localTimers,
      ),
    [timeEvents, effectiveStatus, fallbackTimes, now, enabled, localTimers],
  );
}
