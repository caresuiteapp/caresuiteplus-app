import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';
import { resolveVisitMasterId } from '@/lib/assist/visitRecurrenceExpansion';
import { resolveCalendarEventColor } from '@/lib/calendar/calendarColors';
import type { CalendarEvent } from '@/types/modules/calendarEvent';

export function visitListItemToCalendarEvent(item: VisitDispositionListItem): CalendarEvent {
  const serviceTitle = item.serviceName?.trim() || item.title;
  const descriptionParts = [item.clientName, item.employeeName].filter(Boolean);

  return {
    id: `assist-visit-${item.id}`,
    title: serviceTitle,
    start: item.scheduledStart,
    end: item.scheduledEnd,
    type: 'einsatz',
    color: resolveCalendarEventColor('assist', 'einsatz', 'assist'),
    sourceId: item.id,
    sourceType: 'assist_visit',
    moduleKey: 'assist',
    status: item.status,
    clientName: item.clientName,
    employeeName: item.employeeName,
    serviceTitle,
    href: `/assist/assignments/${item.id}`,
    record: {
      description: descriptionParts.length > 0 ? descriptionParts.join(' · ') : null,
      relatedClientId: item.clientId ?? null,
      relatedEmployeeId: item.employeeId ?? null,
    } as CalendarEvent['record'],
  };
}

/**
 * Replace assist_visit rows from calendar_events with expanded visit-disposition items.
 * Uses the visit repository as source of truth (same path as Einsatzplanung list).
 */
export function mergeExpandedAssistVisitCalendarEvents(
  events: CalendarEvent[],
  expandedVisits: VisitDispositionListItem[],
): CalendarEvent[] {
  if (expandedVisits.length === 0) return events;

  const visitMasterIds = new Set(expandedVisits.map((item) => resolveVisitMasterId(item.id)));

  const withoutAssistVisits = events.filter((event) => {
    if (event.sourceType !== 'assist_visit' || !event.sourceId) return true;
    return !visitMasterIds.has(resolveVisitMasterId(event.sourceId));
  });

  const visitEvents = expandedVisits.map(visitListItemToCalendarEvent);

  return [...withoutAssistVisits, ...visitEvents].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}
