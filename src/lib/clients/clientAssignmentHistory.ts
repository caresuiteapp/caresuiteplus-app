import { APP_LOCALE, APP_TIME_ZONE } from '@/lib/i18n/locale';
import type { AssignmentListItem } from '@/types/modules/assist';

export type ClientAssignmentHistoryView = 'upcoming' | 'past' | 'all';
export type ClientAssignmentMonthGroup = {
  key: string;
  label: string;
  assignments: AssignmentListItem[];
};

const monthParts = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit',
});
const monthLabel = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE, year: 'numeric', month: 'long',
});
const endedStatuses = new Set(['beendet', 'dokumentation_offen', 'unterschrift_offen', 'abgeschlossen']);

/** Use the same civil month as the displayed appointment, including UTC month boundaries. */
export function clientAssignmentMonthKey(start: string): string {
  const date = new Date(start);
  if (!Number.isFinite(date.getTime())) return 'undated';
  const parts = monthParts.formatToParts(date);
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
}

/** History includes unfinished, cancelled and unsigned appointments once their time has passed. */
export function isPastClientAssignment(item: AssignmentListItem, now = Date.now()): boolean {
  const actualEnd = item.actualEndAt ? Date.parse(item.actualEndAt) : NaN;
  if (Number.isFinite(actualEnd) && actualEnd <= now) return true;
  const start = Date.parse(item.scheduledStart);
  if (start <= now && (endedStatuses.has(item.assignmentStatus ?? '') || item.status === 'abgeschlossen')) {
    return true;
  }
  const end = Date.parse(item.scheduledEnd);
  return (Number.isFinite(end) ? end : start) <= now;
}

export function partitionClientAssignments(items: AssignmentListItem[], now = Date.now()) {
  const upcoming: AssignmentListItem[] = [];
  const past: AssignmentListItem[] = [];
  for (const item of items) (isPastClientAssignment(item, now) ? past : upcoming).push(item);
  return { upcoming, past };
}

/** No row or month cap: all authorized records remain reachable in the archive. */
export function groupClientAssignmentsByMonth(
  items: AssignmentListItem[],
  direction: 'asc' | 'desc' = 'desc',
): ClientAssignmentMonthGroup[] {
  const byMonth = new Map<string, ClientAssignmentMonthGroup>();
  for (const item of items) {
    const key = clientAssignmentMonthKey(item.scheduledStart);
    let group = byMonth.get(key);
    if (!group) {
      group = {
        key,
        label: key === 'undated' ? 'Ohne gültigen Termin' : monthLabel.format(new Date(item.scheduledStart)),
        assignments: [],
      };
      byMonth.set(key, group);
    }
    group.assignments.push(item);
  }
  const sign = direction === 'asc' ? 1 : -1;
  const groups = [...byMonth.values()].sort((a, b) => {
    if (a.key === 'undated') return 1;
    if (b.key === 'undated') return -1;
    return sign * a.key.localeCompare(b.key);
  });
  for (const group of groups) {
    group.assignments.sort((a, b) => {
      const aTime = Date.parse(a.scheduledStart);
      const bTime = Date.parse(b.scheduledStart);
      if (!Number.isFinite(aTime) || !Number.isFinite(bTime) || aTime === bTime) return a.id.localeCompare(b.id);
      return sign * (aTime - bTime);
    });
  }
  return groups;
}
