import { isAssignmentToday } from '@/data/demo/assistAssignments';

export type AssignmentDateRangeFilter = 'all' | 'today' | 'tomorrow' | 'week';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isAssignmentTomorrow(scheduledStart: string): boolean {
  const start = new Date(scheduledStart);
  const tomorrow = addDays(new Date(), 1);
  return start >= startOfDay(tomorrow) && start <= endOfDay(tomorrow);
}

export function isAssignmentThisWeek(scheduledStart: string): boolean {
  const start = new Date(scheduledStart);
  const now = new Date();
  const weekStart = startOfDay(now);
  const weekEnd = endOfDay(addDays(now, 6));
  return start >= weekStart && start <= weekEnd;
}

export function matchesDateRangeFilter(
  scheduledStart: string,
  filter: AssignmentDateRangeFilter,
): boolean {
  switch (filter) {
    case 'today':
      return isAssignmentToday(scheduledStart);
    case 'tomorrow':
      return isAssignmentTomorrow(scheduledStart);
    case 'week':
      return isAssignmentThisWeek(scheduledStart);
    default:
      return true;
  }
}

export const ASSIGNMENT_DATE_RANGE_FILTERS: { key: AssignmentDateRangeFilter; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'today', label: 'Heute' },
  { key: 'tomorrow', label: 'Morgen' },
  { key: 'week', label: 'Woche' },
];
