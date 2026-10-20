import type { WfmTimeEvent, WfmWorkSession } from '@/types/modules/wfm';

const BLOCK_START_EVENTS = new Set<WfmTimeEvent['eventType']>([
  'clock_in',
  'office_check_in',
  'homeoffice_start',
  'visit_started',
  'standby_start',
  'training_start',
  'meeting_start',
  'travel_start',
]);

export type WfmTimelineTotals = {
  grossMinutes: number;
  pauseMinutes: number;
  netMinutes: number;
  blockCount: number;
};

function toMillis(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function elapsedMinutes(start: number, end: number): number {
  return Math.max(0, Math.round((end - start) / 60_000));
}

/**
 * Derives the productive daily totals from the append-only event timeline.
 * A new start after clock_out opens another work block on the same day.
 * Activity changes inside an open block do not double count the interval.
 */
export function deriveWfmTimelineTotals(
  events: WfmTimeEvent[],
  options?: {
    nowIso?: string;
    session?: WfmWorkSession | null;
  },
): WfmTimelineTotals {
  const ordered = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const now = toMillis(options?.nowIso) ?? Date.now();
  let blockStart: number | null = null;
  let pauseStart: number | null = null;
  let grossMinutes = 0;
  let pauseMinutes = 0;
  let blockCount = 0;

  for (const event of ordered) {
    const occurredAt = toMillis(event.occurredAt);
    if (occurredAt == null) continue;

    if (BLOCK_START_EVENTS.has(event.eventType) && blockStart == null) {
      blockStart = occurredAt;
      blockCount += 1;
      continue;
    }

    if (event.eventType === 'pause_start' && blockStart != null && pauseStart == null) {
      pauseStart = occurredAt;
      continue;
    }

    if (event.eventType === 'pause_end' && pauseStart != null) {
      pauseMinutes += elapsedMinutes(pauseStart, occurredAt);
      pauseStart = null;
      continue;
    }

    if (event.eventType === 'clock_out' && blockStart != null) {
      if (pauseStart != null) {
        pauseMinutes += elapsedMinutes(pauseStart, occurredAt);
        pauseStart = null;
      }
      grossMinutes += elapsedMinutes(blockStart, occurredAt);
      blockStart = null;
    }
  }

  if (blockStart != null) {
    const session = options?.session;
    const active = Boolean(session && !['offline', 'ended'].includes(session.status));
    const blockEnd = active ? now : toMillis(session?.endedAt);
    if (blockEnd != null) {
      if (pauseStart != null) pauseMinutes += elapsedMinutes(pauseStart, blockEnd);
      grossMinutes += elapsedMinutes(blockStart, blockEnd);
    }
  }

  pauseMinutes = Math.min(pauseMinutes, grossMinutes);
  return {
    grossMinutes,
    pauseMinutes,
    netMinutes: Math.max(0, grossMinutes - pauseMinutes),
    blockCount,
  };
}
