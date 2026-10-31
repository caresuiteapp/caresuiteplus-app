import type { CalendarEvent } from '@/types/modules/calendarEvent';

type EmployeeRelations = {
  relatedEmployeeId?: string | null;
  participantEmployeeIds?: readonly string[] | null;
};

/** Stable IDs are used for membership; names are presentation only. */
export function calendarEmployeeIds(relations: EmployeeRelations): string[] {
  return [...new Set([relations.relatedEmployeeId, ...(relations.participantEmployeeIds ?? [])]
    .map(id => id?.trim()).filter((id): id is string => Boolean(id)))];
}

export function calendarEventEmployeeIds(event: CalendarEvent): string[] {
  return calendarEmployeeIds({
    relatedEmployeeId: event.employeeId ?? event.record?.relatedEmployeeId,
    participantEmployeeIds: event.record?.participantEmployeeIds,
  });
}
