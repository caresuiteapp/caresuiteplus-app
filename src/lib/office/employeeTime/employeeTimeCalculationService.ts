import type {
  AssignmentPauseEvent,
  AssignmentStatusTimes,
  TimeCalculationInput,
  TimeCalculationResult,
  TimePlausibilityFlag,
  TravelTimeSource,
} from '@/types/modules/employeeTime';

const MAX_WORK_MINUTES = 16 * 60;
const MAX_TRAVEL_MINUTES = 3 * 60;
const MAX_PAUSE_MINUTES = 4 * 60;

export function minutesBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
}

export function isFutureTimestamp(iso: string): boolean {
  return new Date(iso).getTime() > Date.now() + 60_000;
}

export function isFakeTimestampPair(start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  if (start === end) return true;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (endMs <= startMs) return true;
  const rounded = start.endsWith(':00:00.000Z') && end.endsWith(':00:00.000Z');
  const diff = endMs - startMs;
  return rounded && diff <= 60_000;
}

export function extractStatusTimesFromHistory(
  history: Array<{ toStatus: string; createdAt: string }>,
  fallback?: { actualStartAt: string | null; actualEndAt: string | null },
): AssignmentStatusTimes {
  const times: AssignmentStatusTimes = {
    onTheWayAt: null,
    arrivedAt: null,
    startedAt: fallback?.actualStartAt ?? null,
    pausedAt: null,
    resumedAt: null,
    finishedAt: fallback?.actualEndAt ?? null,
    completedAt: null,
  };

  for (const entry of history) {
    switch (entry.toStatus) {
      case 'unterwegs':
        times.onTheWayAt ??= entry.createdAt;
        break;
      case 'angekommen':
        times.arrivedAt ??= entry.createdAt;
        break;
      case 'gestartet':
        times.startedAt ??= entry.createdAt;
        if (times.pausedAt && !times.resumedAt) times.resumedAt = entry.createdAt;
        break;
      case 'pausiert':
        times.pausedAt = entry.createdAt;
        break;
      case 'beendet':
        times.finishedAt = entry.createdAt;
        break;
      case 'abgeschlossen':
        times.completedAt = entry.createdAt;
        break;
      default:
        break;
    }
  }

  return times;
}

export function normalizePauseEvents(
  tenantId: string,
  assignmentId: string,
  pauses: Array<{ id: string; pausedAt: string; resumedAt: string | null; reason: string | null }>,
): AssignmentPauseEvent[] {
  return pauses.map((pause) => ({
    id: pause.id,
    tenantId,
    assignmentId,
    pauseStartAt: pause.pausedAt,
    pauseEndAt: pause.resumedAt,
    pauseDurationMinutes:
      pause.resumedAt != null ? minutesBetween(pause.pausedAt, pause.resumedAt) : null,
    pauseReason: pause.reason,
    source: 'assignment_execution' as const,
    createdAt: pause.pausedAt,
  }));
}

export function totalPauseMinutes(pauses: AssignmentPauseEvent[], now = new Date()): number {
  return pauses.reduce((sum, pause) => {
    if (!pause.pauseEndAt) {
      return sum + minutesBetween(pause.pauseStartAt, now.toISOString());
    }
    return sum + (pause.pauseDurationMinutes ?? minutesBetween(pause.pauseStartAt, pause.pauseEndAt));
  }, 0);
}

export function resolveTravelMinutes(
  travel: TravelTimeSource | null | undefined,
  statusTimes: AssignmentStatusTimes,
  settingsCountsTravel: boolean,
): number {
  if (!settingsCountsTravel) return 0;

  if (travel?.actualTravelMinutes != null && travel.actualTravelMinutes >= 0) {
    return travel.actualTravelMinutes;
  }

  if (travel?.estimatedTravelMinutes != null && travel.estimatedTravelMinutes >= 0) {
    return travel.estimatedTravelMinutes;
  }

  if (statusTimes.onTheWayAt && statusTimes.arrivedAt) {
    return minutesBetween(statusTimes.onTheWayAt, statusTimes.arrivedAt);
  }

  if (travel?.routeStartedAt && travel.routeFinishedAt) {
    return minutesBetween(travel.routeStartedAt, travel.routeFinishedAt);
  }

  return 0;
}

export function collectPlausibilityFlags(input: {
  startedAt: string | null;
  finishedAt: string | null;
  grossMinutes: number;
  pauseMinutes: number;
  travelMinutes: number;
  pauses: AssignmentPauseEvent[];
}): TimePlausibilityFlag[] {
  const flags: TimePlausibilityFlag[] = [];
  const { startedAt, finishedAt, grossMinutes, pauseMinutes, travelMinutes, pauses } = input;

  if (!startedAt || !finishedAt) {
    flags.push('missing_times');
  }

  if (startedAt && finishedAt) {
    if (isFutureTimestamp(startedAt) || isFutureTimestamp(finishedAt)) {
      flags.push('future_timestamp');
    }
    if (isFakeTimestampPair(startedAt, finishedAt)) {
      flags.push('fake_timestamp');
    }
    if (new Date(finishedAt) <= new Date(startedAt)) {
      flags.push('end_before_start');
    }
  }

  if (grossMinutes > MAX_WORK_MINUTES) {
    flags.push('implausible_duration');
  }

  if (pauseMinutes > grossMinutes && grossMinutes > 0) {
    flags.push('implausible_pause');
  }

  if (pauses.some((p) => !p.pauseEndAt)) {
    flags.push('open_pause');
  }

  for (const pause of pauses) {
    const duration =
      pause.pauseDurationMinutes ??
      (pause.pauseEndAt ? minutesBetween(pause.pauseStartAt, pause.pauseEndAt) : 0);
    if (duration > MAX_PAUSE_MINUTES) {
      flags.push('implausible_pause');
      break;
    }
  }

  if (travelMinutes > MAX_TRAVEL_MINUTES) {
    flags.push('implausible_travel');
  }

  return [...new Set(flags)];
}

export function calculateAssignmentWorkTime(input: TimeCalculationInput): TimeCalculationResult {
  const { statusTimes, pauseEvents, plannedDurationMinutes, settings } = input;
  const startedAt = statusTimes.startedAt;
  const finishedAt = statusTimes.finishedAt ?? statusTimes.completedAt;

  const grossMinutes =
    startedAt && finishedAt ? Math.max(0, minutesBetween(startedAt, finishedAt)) : 0;
  const pauseMinutes = totalPauseMinutes(pauseEvents);
  const travelMinutes = resolveTravelMinutes(input.travel, statusTimes, settings.countsTravelAsWorkTime);

  const flags = collectPlausibilityFlags({
    startedAt,
    finishedAt,
    grossMinutes,
    pauseMinutes,
    travelMinutes,
    pauses: pauseEvents,
  });

  const hasBlockingFlags = flags.some((f) =>
    ['missing_times', 'fake_timestamp', 'future_timestamp', 'end_before_start'].includes(f),
  );

  const netMinutes = hasBlockingFlags ? 0 : Math.max(0, grossMinutes - pauseMinutes);
  const paidMinutes = hasBlockingFlags ? 0 : netMinutes + travelMinutes;
  const deviationMinutes = finishedAt ? netMinutes - plannedDurationMinutes : null;

  return {
    grossMinutes,
    pauseMinutes,
    netMinutes,
    travelMinutes,
    paidMinutes,
    unpaidMinutes: hasBlockingFlags ? grossMinutes : pauseMinutes,
    plannedMinutes: plannedDurationMinutes,
    deviationMinutes: deviationMinutes ?? 0,
    plausibilityFlags: flags,
    billable: !hasBlockingFlags && netMinutes > 0,
    traceReference: `assignment:${input.assignmentId}:status+pauses`,
  };
}

export function periodDateFromIso(iso: string): string {
  return iso.slice(0, 10);
}

export function startOfDayIso(date: string): string {
  return `${date}T00:00:00.000Z`;
}

export function endOfDayIso(date: string): string {
  return `${date}T23:59:59.999Z`;
}

export function startOfWeekIso(date: string): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

export function endOfWeekIso(date: string): string {
  const start = new Date(`${startOfWeekIso(date)}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() + 6);
  return start.toISOString().slice(0, 10);
}

export const LOCKED_PERIOD_STATUSES = new Set(['approved', 'exported', 'locked']);

export function isPeriodLocked(status: string): boolean {
  return LOCKED_PERIOD_STATUSES.has(status);
}
