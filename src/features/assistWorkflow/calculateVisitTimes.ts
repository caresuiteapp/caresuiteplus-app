/**
 * ASSIST.WORKFLOW.2 — Compute drive / service / pause durations from time events.
 * Supabase assist_time_events is source of truth; travel stops at arrive/drive_end.
 */
import type { AssignmentStatus } from '@/types/modules/assignmentStatus';
import { getVisitTimeSegments } from './getVisitTimeSegments';

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

const PAST_ARRIVAL_STATUSES: AssignmentStatus[] = [
  'angekommen',
  'gestartet',
  'pausiert',
  'beendet',
  'dokumentation_offen',
  'unterschrift_offen',
  'abgeschlossen',
];

/** Derive visit timers from assist_time_events rows (or equivalent). */
export function calculateVisitTimes(
  events: TimeEventLike[],
  currentStatus: AssignmentStatus,
  now: Date = new Date(),
): VisitTimesSummary {
  const nowIso = now.toISOString();
  const segments = getVisitTimeSegments(events, now);

  const driveStart = byType(events, 'drive_start').at(-1) ?? null;
  const driveEnd = byType(events, 'drive_end').at(-1) ?? byType(events, 'arrive').at(-1) ?? null;
  const serviceStart = byType(events, 'service_start').at(-1) ?? null;
  const serviceEnd = byType(events, 'service_end').at(-1) ?? null;
  const arrivedAt = byType(events, 'arrive').at(-1) ?? null;

  let driveSeconds: number | null = segments.find((s) => s.kind === 'drive')?.durationSeconds ?? null;

  // Travel timer STOPS at arrived — never extend drive past arrival even if drive_end missing.
  if (driveStart && driveSeconds == null && PAST_ARRIVAL_STATUSES.includes(currentStatus)) {
    if (arrivedAt) {
      driveSeconds = diffSeconds(driveStart, arrivedAt);
    } else if (driveEnd) {
      driveSeconds = diffSeconds(driveStart, driveEnd);
    }
  }

  if (driveStart && driveSeconds == null && currentStatus === 'unterwegs') {
    driveSeconds = diffSeconds(driveStart, nowIso);
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

  const completedPauseSeconds = pauseStarts.reduce((sum, start, idx) => {
    const end = pauseEnds[idx];
    if (!end) return sum;
    return sum + diffSeconds(start, end);
  }, 0);

  let serviceSeconds: number | null = null;
  if (serviceStart) {
    const openPauseStart =
      pauseStarts.length > pauseEnds.length ? (pauseStarts.at(-1) ?? null) : null;
    const end =
      serviceEnd ??
      (currentStatus === 'gestartet'
        ? nowIso
        : currentStatus === 'pausiert'
          ? openPauseStart
          : null);
    if (end) {
      const pauseDeduction =
        currentStatus === 'pausiert' && openPauseStart
          ? completedPauseSeconds
          : (pauseSeconds ?? 0);
      serviceSeconds = Math.max(0, diffSeconds(serviceStart, end) - pauseDeduction);
    }
  }

  // Active timer: drive ONLY while unterwegs and travel not yet ended in events.
  let activeTimer: VisitTimesSummary['activeTimer'] = null;
  if (currentStatus === 'unterwegs' && driveStart && !driveEnd && !arrivedAt) {
    activeTimer = 'drive';
  } else if (currentStatus === 'pausiert') {
    activeTimer = 'pause';
  } else if (currentStatus === 'gestartet') {
    activeTimer = 'service';
  }

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
