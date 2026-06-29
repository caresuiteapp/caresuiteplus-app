/**
 * ASSIST.WORKFLOW.2 — Derive drive / service / pause segments from assist_time_events.
 */
import type { TimeEventLike } from './calculateVisitTimes';

export type VisitTimeSegment = {
  kind: 'drive' | 'service' | 'pause';
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
};

function byType(events: TimeEventLike[], type: string): string[] {
  return events.filter((e) => e.eventType === type).map((e) => e.occurredAt);
}

function diffSeconds(from: string, to: string): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
}

/** Build ordered time segments — travel stops at arrive/drive_end (never extends past arrival). */
export function getVisitTimeSegments(
  events: TimeEventLike[],
  now: Date = new Date(),
): VisitTimeSegment[] {
  const nowIso = now.toISOString();
  const segments: VisitTimeSegment[] = [];

  const driveStart = byType(events, 'drive_start').at(-1) ?? null;
  const driveEnd = byType(events, 'drive_end').at(-1) ?? byType(events, 'arrive').at(-1) ?? null;

  if (driveStart) {
    segments.push({
      kind: 'drive',
      startedAt: driveStart,
      endedAt: driveEnd,
      durationSeconds: driveEnd ? diffSeconds(driveStart, driveEnd) : null,
    });
  }

  const serviceStart = byType(events, 'service_start').at(-1) ?? null;
  const serviceEnd = byType(events, 'service_end').at(-1) ?? null;
  if (serviceStart) {
    segments.push({
      kind: 'service',
      startedAt: serviceStart,
      endedAt: serviceEnd,
      durationSeconds: serviceEnd ? diffSeconds(serviceStart, serviceEnd) : null,
    });
  }

  const pauseStarts = byType(events, 'pause_start');
  const pauseEnds = byType(events, 'pause_end');
  pauseStarts.forEach((start, idx) => {
    const end = pauseEnds[idx] ?? null;
    segments.push({
      kind: 'pause',
      startedAt: start,
      endedAt: end,
      durationSeconds: end ? diffSeconds(start, end) : diffSeconds(start, nowIso),
    });
  });

  return segments;
}

export function hasServiceStarted(events: TimeEventLike[]): boolean {
  return events.some((e) => e.eventType === 'service_start');
}

export function hasTravelEnded(events: TimeEventLike[]): boolean {
  return events.some((e) => e.eventType === 'drive_end' || e.eventType === 'arrive');
}
