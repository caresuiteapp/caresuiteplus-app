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
  return events
    .filter((e) => e.eventType === type)
    .map((e) => e.occurredAt)
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());
}

function diffSeconds(from: string, to: string): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
}

function firstAfter(values: string[], start: string | null): string | null {
  if (!start) return null;
  const startMs = new Date(start).getTime();
  return values.find((value) => new Date(value).getTime() >= startMs) ?? null;
}

/** Build ordered time segments — travel stops at arrive/drive_end (never extends past arrival). */
export function getVisitTimeSegments(
  events: TimeEventLike[],
  now: Date = new Date(),
): VisitTimeSegment[] {
  const nowIso = now.toISOString();
  const segments: VisitTimeSegment[] = [];

  const driveStart = byType(events, 'drive_start').at(-1) ?? null;
  const driveEndCandidates = [
    ...byType(events, 'drive_end'),
    ...byType(events, 'arrive'),
  ].sort((left, right) => new Date(left).getTime() - new Date(right).getTime());
  const driveEnd = firstAfter(driveEndCandidates, driveStart);

  if (driveStart) {
    segments.push({
      kind: 'drive',
      startedAt: driveStart,
      endedAt: driveEnd,
      durationSeconds: driveEnd ? diffSeconds(driveStart, driveEnd) : null,
    });
  }

  const serviceStart = byType(events, 'service_start').at(-1) ?? null;
  const serviceEnd = firstAfter(byType(events, 'service_end'), serviceStart);
  if (serviceStart) {
    segments.push({
      kind: 'service',
      startedAt: serviceStart,
      endedAt: serviceEnd,
      durationSeconds: serviceEnd ? diffSeconds(serviceStart, serviceEnd) : null,
    });
  }

  const serviceStartMs = serviceStart ? new Date(serviceStart).getTime() : Number.NEGATIVE_INFINITY;
  const pauseStarts = byType(events, 'pause_start').filter(
    (value) => new Date(value).getTime() >= serviceStartMs,
  );
  const pauseEnds = byType(events, 'pause_end').filter(
    (value) => new Date(value).getTime() >= serviceStartMs,
  );
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
  const latestStart = byType(events, 'service_start').at(-1) ?? null;
  return Boolean(latestStart && !firstAfter(byType(events, 'service_end'), latestStart));
}

export function hasTravelEnded(events: TimeEventLike[]): boolean {
  const latestStart = byType(events, 'drive_start').at(-1) ?? null;
  if (!latestStart) return false;
  const endCandidates = [
    ...byType(events, 'drive_end'),
    ...byType(events, 'arrive'),
  ].sort((left, right) => new Date(left).getTime() - new Date(right).getTime());
  return Boolean(firstAfter(endCandidates, latestStart));
}
