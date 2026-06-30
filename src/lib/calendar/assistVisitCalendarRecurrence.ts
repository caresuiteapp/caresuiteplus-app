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

/** Replace single master assist_visit calendar rows with expanded recurrence occurrences. */
export function mergeExpandedAssistVisitCalendarEvents(
  events: CalendarEvent[],
  expandedVisits: VisitDispositionListItem[],
): CalendarEvent[] {
  if (expandedVisits.length === 0) return events;

  const recurringMasterIds = new Set<string>();
  for (const item of expandedVisits) {
    const masterId = resolveVisitMasterId(item.id);
    if (item.id !== masterId) {
      recurringMasterIds.add(masterId);
    }
  }

  const filtered = events.filter((event) => {
    if (event.sourceType !== 'assist_visit' || !event.sourceId) return true;
    const masterId = resolveVisitMasterId(event.sourceId);
    return !(recurringMasterIds.has(masterId) && event.sourceId === masterId);
  });

  const existingSourceIds = new Set(
    filtered
      .filter((event) => event.sourceType === 'assist_visit' && event.sourceId)
      .map((event) => event.sourceId!),
  );

  const synthetic = expandedVisits
    .filter((item) => !existingSourceIds.has(item.id))
    .map(visitListItemToCalendarEvent);

  return [...filtered, ...synthetic].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}
