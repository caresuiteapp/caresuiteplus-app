/**
 * ASSIST.WORKFLOW.1 — Compute drive / service / pause durations from time events.
 */
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';

export type TimeEventLike = {
  eventType: string;
  occurredAt: string;
};

export type VisitTimesSummary = {
  driveSeconds: number | null;
  serviceSeconds: number | null;
  pauseSeconds: number | null;
  totalSeconds: number | null;
  driveStartedAt: string | null;
  serviceStartedAt: string | null;
  pauseStartedAt: string | null;
  arrivedAt: string | null;
  serviceEndedAt: string | null;
  activeTimer: 'drive' | 'service' | 'pause' | null;
};

function byType(events: TimeEventLike[], type: string): string[] {
  return events.filter((e) => e.eventType === type).map((e) => e.occurredAt);
}

function diffSeconds(from: string, to: string): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
}

/** Derive visit timers from assist_time_events rows (or equivalent). */
export function calculateVisitTimes(
  events: TimeEventLike[],
  currentStatus: AssignmentStatus,
  now: Date = new Date(),
): VisitTimesSummary {
  const nowIso = now.toISOString();
  const driveStart = byType(events, 'drive_start').at(-1) ?? null;
  const driveEnd = byType(events, 'drive_end').at(-1) ?? byType(events, 'arrive').at(-1) ?? null;
  const serviceStart = byType(events, 'service_start').at(-1) ?? null;
  const serviceEnd = byType(events, 'service_end').at(-1) ?? null;
  const arrivedAt = byType(events, 'arrive').at(-1) ?? null;

  let driveSeconds: number | null = null;
  if (driveStart) {
    const end = driveEnd ?? (currentStatus === 'unterwegs' ? nowIso : null);
    if (end) driveSeconds = diffSeconds(driveStart, end);
  }

  const pauseStarts = byType(events, 'pause_start');
  const pauseEnds = byType(events, 'pause_end');
  let pauseSeconds: number | null = null;
  if (pauseStarts.length) {
    pauseSeconds = pauseStarts.reduce((sum, start, idx) => {
      const end = pauseEnds[idx] ?? (currentStatus === 'pausiert' ? nowIso : start);
      return sum + diffSeconds(start, end);
    }, 0);
  }

  let serviceSeconds: number | null = null;
  if (serviceStart) {
    const end =
      serviceEnd ??
      (currentStatus === 'gestartet' || currentStatus === 'pausiert' ? nowIso : null);
    if (end) {
      serviceSeconds = Math.max(0, diffSeconds(serviceStart, end) - (pauseSeconds ?? 0));
    }
  }

  let activeTimer: VisitTimesSummary['activeTimer'] = null;
  if (currentStatus === 'unterwegs') activeTimer = 'drive';
  else if (currentStatus === 'pausiert') activeTimer = 'pause';
  else if (currentStatus === 'gestartet') activeTimer = 'service';

  const parts = [driveSeconds, serviceSeconds].filter((v): v is number => v != null);
  const totalSeconds = parts.length ? parts.reduce((a, b) => a + b, 0) : null;

  return {
    driveSeconds,
    serviceSeconds,
    pauseSeconds: pauseSeconds && pauseSeconds > 0 ? pauseSeconds : null,
    totalSeconds,
    driveStartedAt: driveStart,
    serviceStartedAt: serviceStart,
    pauseStartedAt: currentStatus === 'pausiert' ? (pauseStarts.at(-1) ?? null) : null,
    arrivedAt,
    serviceEndedAt: serviceEnd,
    activeTimer,
  };
}
