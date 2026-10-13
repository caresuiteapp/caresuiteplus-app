import type { CalendarEvent, CalendarViewMode } from '@/types/modules/calendarEvent';
import { addDays, addMonths, startOfWeek } from '@/lib/office/calendarDateUtils';

/** Half-open local period, shared by the query and the visible agenda. */
export function employeePortalCalendarPeriod(anchor: Date, view: CalendarViewMode) {
  const day = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (view === 'day') return { start: day, end: addDays(day, 1) };
  if (view === 'week' || view === 'agenda') {
    const start = startOfWeek(day, 1);
    return { start, end: addDays(start, 7) };
  }
  if (view === 'month' || view === 'list') {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    return { start, end: addMonths(start, 1) };
  }
  return { start: new Date(anchor.getFullYear(), 0, 1), end: new Date(anchor.getFullYear() + 1, 0, 1) };
}

export function employeePortalCalendarEventOverlaps(event: CalendarEvent, start: Date, end: Date) {
  const startsAt = new Date(event.start).getTime();
  const endsAt = new Date(event.end).getTime();
  return Number.isFinite(startsAt) && Number.isFinite(endsAt)
    && startsAt < end.getTime() && endsAt >= start.getTime();
}

/** Team events remain readable; only own assignments have an operational detail. */
export function employeePortalCalendarEventHref(event: CalendarEvent, employeeId: string | null): string | null {
  const assignedEmployee = event.employeeId ?? event.record?.relatedEmployeeId;
  if (!employeeId || assignedEmployee !== employeeId) return null;
  if (event.sourceType === 'assist_visit' && event.sourceId) {
    return `/portal/employee/assignments/${event.sourceId}`;
  }
  if (event.record?.id && event.record.isEmployeePortalVisible && !event.record.archivedAt) {
    return `/portal/employee/assignments/calendar:${event.record.id}`;
  }
  return null;
}
