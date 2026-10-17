import { useCalendarEvents } from './useCalendarEvents.web';

export function useOfficeCalendar(rangeStart?: string, rangeEnd?: string) {
  return useCalendarEvents(rangeStart, rangeEnd, undefined, 'office');
}
