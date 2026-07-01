/**
 * Pure visit-timer display logic — safe to import from Vitest without React Native.
 */
import {
  calculateVisitTimes,
  type TimeEventLike,
  type VisitTimesSummary,
} from './calculateVisitTimes';
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

export function isActiveVisitTimerStatus(
  status: AssignmentStatus | null | undefined,
): status is AssignmentStatus {
  return status === 'unterwegs' || status === 'gestartet' || status === 'pausiert';
}

/** Rebuild minimal time events from cached visit-time anchors for offline tick. */
export function buildTimeEventsFromVisitTimesSummary(summary: VisitTimesSummary): TimeEventLike[] {
  const events: TimeEventLike[] = [];
  if (summary.driveStartedAt) {
    events.push({ eventType: 'drive_start', occurredAt: summary.driveStartedAt });
  }
  if (summary.arrivedAt) {
    events.push({ eventType: 'arrive', occurredAt: summary.arrivedAt });
  }
  if (summary.serviceStartedAt) {
    events.push({ eventType: 'service_start', occurredAt: summary.serviceStartedAt });
  }
  if (summary.serviceEndedAt) {
    events.push({ eventType: 'service_end', occurredAt: summary.serviceEndedAt });
  }
  if (summary.pauseStartedAt) {
    events.push({ eventType: 'pause_start', occurredAt: summary.pauseStartedAt });
  }
  return events;
}

export function computeLiveVisitTimers(
  timeEvents: TimeEventLike[],
  effectiveStatus: AssignmentStatus | null,
  fallbackTimes: VisitTimesSummary | null,
  now: Date,
  enabled = true,
  localTimers?: (now: Date) => EmployeePortalLiveTimers | null,
): EmployeePortalLiveTimers | null {
  if (!enabled || !effectiveStatus) return null;

  const needsLiveTick = isActiveVisitTimerStatus(effectiveStatus);
  const tickNow = needsLiveTick ? now : new Date();

  if (timeEvents.length > 0) {
    return toLiveTimers(calculateVisitTimes(timeEvents, effectiveStatus, tickNow));
  }

  if (fallbackTimes) {
    const anchorEvents = buildTimeEventsFromVisitTimesSummary(fallbackTimes);
    if (anchorEvents.length > 0) {
      return toLiveTimers(calculateVisitTimes(anchorEvents, effectiveStatus, tickNow));
    }
    return toLiveTimers(fallbackTimes);
  }

  return localTimers?.(tickNow) ?? null;
}
