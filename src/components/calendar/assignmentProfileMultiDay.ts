/** Local calendar keys are deliberately kept as YYYY-MM-DD, without UTC conversion. */
export function selectAssignmentProfileDate(
  current: readonly string[],
  dateKey: string,
  clickCount: number,
): string[] {
  if (clickCount >= 2) return [dateKey];
  const next = new Set(current);
  if (next.has(dateKey)) next.delete(dateKey);
  else next.add(dateKey);
  return Array.from(next).sort();
}

export function assignmentProfileClickCount(event: { nativeEvent?: unknown }): number {
  const native = event.nativeEvent;
  if (native && typeof native === 'object' && 'detail' in native && typeof native.detail === 'number') {
    return native.detail;
  }
  // Keyboard activation and native presses count as one selection.
  return 1;
}

type ScheduleResult = { ok: true } | { ok: false; error: string; uncertain?: boolean };

export type AssignmentProfileBatchResult = {
  confirmedDates: string[];
  remainingDates: string[];
  failedDate: string | null;
  error: string | null;
  uncertain: boolean;
  interrupted: boolean;
};

/** Stop on first failure. Never automatically resend a confirmed date. */
export async function scheduleAssignmentProfileDates(
  dates: readonly string[],
  schedule: (dateKey: string) => Promise<ScheduleResult>,
  options: {
    shouldContinue?: () => boolean;
    onConfirmed?: (dateKey: string) => void;
  } = {},
): Promise<AssignmentProfileBatchResult> {
  const pending = Array.from(new Set(dates)).sort();
  const confirmedDates: string[] = [];
  for (let index = 0; index < pending.length; index += 1) {
    const dateKey = pending[index];
    if (options.shouldContinue && !options.shouldContinue()) {
      return {
        confirmedDates, remainingDates: pending.slice(index), failedDate: null,
        error: null, uncertain: false, interrupted: true,
      };
    }
    let result: ScheduleResult;
    try {
      result = await schedule(dateKey);
    } catch {
      return {
        confirmedDates, remainingDates: pending.slice(index), failedDate: dateKey,
        error: 'Die Speicherung konnte nicht bestätigt werden. Bitte zuerst den Kalender prüfen, bevor du diesen Tag erneut freigibst.',
        uncertain: true, interrupted: false,
      };
    }
    if (!result.ok) {
      return {
        confirmedDates, remainingDates: pending.slice(index), failedDate: dateKey,
        error: result.uncertain
          ? `${result.error} Bitte zuerst den Kalender prüfen, bevor du diesen Tag erneut freigibst.`
          : result.error,
        uncertain: result.uncertain ?? false, interrupted: false,
      };
    }
    confirmedDates.push(dateKey);
    options.onConfirmed?.(dateKey);
  }
  return {
    confirmedDates, remainingDates: [], failedDate: null,
    error: null, uncertain: false, interrupted: false,
  };
}
