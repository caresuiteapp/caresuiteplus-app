import type { CalendarEventRecord, CalendarViewConfig } from '@/types/calendar';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { MODULE_EVENT_TYPES } from '@/lib/calendar/calendarColors';
import { mapCalendarEventRecordToUi } from '@/lib/calendar/calendarEventMapper';

export type CalendarFilterState = {
  moduleKey?: string | null;
  eventType?: string | null;
  status?: string | null;
  clientId?: string | null;
  employeeId?: string | null;
  onlyOpen?: boolean;
  onlyToday?: boolean;
  onlyConflicts?: boolean;
};

export function filterCalendarRecords(
  records: CalendarEventRecord[],
  config: CalendarViewConfig,
  filters?: CalendarFilterState,
): CalendarEventRecord[] {
  let result = records.filter((record) => !record.archivedAt);

  if (!filters?.status) {
    result = result.filter((record) => record.status !== 'cancelled' && record.status !== 'archiviert');
  }

  if (config.calendarScope === 'office' || config.showAllModules) {
    result = result.filter((record) => record.isOfficeVisible);
  } else if (config.calendarScope === 'module' && config.moduleKey !== 'all') {
    result = result.filter(
      (record) => record.moduleKey === config.moduleKey && record.isModuleVisible,
    );
    const allowed = MODULE_EVENT_TYPES[config.moduleKey];
    if (allowed?.length) {
      result = result.filter((record) => allowed.includes(record.eventType));
    }
  }

  if (config.allowedEventTypes?.length) {
    result = result.filter((record) => config.allowedEventTypes!.includes(record.eventType));
  }

  if (config.entityContext?.clientId) {
    result = result.filter((record) => record.relatedClientId === config.entityContext!.clientId);
  }
  if (config.entityContext?.employeeId) {
    result = result.filter((record) => record.relatedEmployeeId === config.entityContext!.employeeId);
  }

  if (filters?.moduleKey) {
    result = result.filter((record) => record.moduleKey === filters.moduleKey);
  }
  if (filters?.eventType) {
    result = result.filter((record) => record.eventType === filters.eventType);
  }
  if (filters?.status) {
    result = result.filter((record) => record.status === filters.status);
  }
  if (filters?.clientId) {
    result = result.filter((record) => record.relatedClientId === filters.clientId);
  }
  if (filters?.employeeId) {
    result = result.filter((record) => record.relatedEmployeeId === filters.employeeId);
  }
  if (filters?.onlyOpen) {
    result = result.filter((record) => !['abgeschlossen', 'cancelled', 'archiviert'].includes(record.status));
  }

  return result;
}

export function filterCalendarRecordsByRange(
  records: CalendarEventRecord[],
  rangeStart?: string,
  rangeEnd?: string,
): CalendarEventRecord[] {
  if (!rangeStart && !rangeEnd) return records;
  const startMs = rangeStart ? new Date(rangeStart).getTime() : -Infinity;
  const endMs = rangeEnd ? new Date(rangeEnd).getTime() : Infinity;
  return records.filter((record) => {
    const eventStart = new Date(record.startAt).getTime();
    const eventEnd = new Date(record.endAt).getTime();
    return eventStart <= endMs && eventEnd >= startMs;
  });
}

export function recordsToUiEvents(records: CalendarEventRecord[]): CalendarEvent[] {
  return records.map(mapCalendarEventRecordToUi).sort((a, b) => a.start.localeCompare(b.start));
}
