import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';
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
    // The canonical assignment status drives calendar interaction and styling.
    // Generic workflow status (for example "fehlerhaft") loses cancellation semantics.
    status: item.assignmentStatus,
    isAtRisk: item.isAtRisk,
    isIncomplete: item.isIncomplete,
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
  // The visit repository is the source of truth. Central assist_visit rows that
  // no longer have a visit are deletion remnants and must not be rendered.
  const withoutAssistVisits = events.filter(
    (event) => event.sourceType !== 'assist_visit',
  );

  const visitEvents = expandedVisits.map(visitListItemToCalendarEvent);

  return [...withoutAssistVisits, ...visitEvents].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}
