const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function calculateContractTargetMinutesForRange(
  workDays: unknown,
  fromDate: string,
  toDate: string,
): number {
  if (!workDays || typeof workDays !== 'object') return 0;
  const schedule = workDays as Record<string, unknown>;
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return 0;

  let targetMinutes = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    const hours = Number(schedule[weekdayKeys[cursor.getUTCDay()]]);
    if (Number.isFinite(hours) && hours > 0) {
      targetMinutes += Math.round(hours * 60);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return targetMinutes;
}

