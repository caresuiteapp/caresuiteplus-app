import type { CalendarEventRecord } from '@/types/calendar';
import {
  isStationaerCalendarSourceType,
  resolveStationaerEventHref,
} from '@/lib/calendar/calendarSourceRegistry';

export function resolveCalendarEventHref(record: CalendarEventRecord): string | undefined {
  const id = record.sourceId ?? record.id;
  if (isStationaerCalendarSourceType(record.sourceType)) {
    return resolveStationaerEventHref(record.sourceType, id);
  }
  switch (record.sourceType) {
    case 'appointment':
      return `/office/appointments/${id}`;
    case 'assist_visit':
      return `/assist/assignments/${id}`;
    case 'care_visit':
      return `/pflege/plans/${id}`;
    case 'consultation_appointment':
      return `/beratung/cases/${record.relatedCaseId ?? id}`;
    case 'academy_training':
      return `/akademie/courses/${id}`;
    case 'absence':
    case 'vacation':
    case 'sick_leave':
      return record.relatedEmployeeId
        ? `/office/employees/${record.relatedEmployeeId}`
        : undefined;
    default:
      return undefined;
  }
}

export const CALENDAR_MODULE_ROUTES: Record<string, string> = {
  office: '/office/calendar',
  assist: '/assist/calendar',
  pflege: '/pflege/calendar',
  stationaer: '/stationaer/calendar',
  beratung: '/beratung/calendar',
  akademie: '/akademie/calendar',
};

export const CALENDAR_ROUTE_ALIASES: Record<string, string> = {
  '/office/kalender': '/office/calendar',
  '/assist/kalender': '/assist/calendar',
  '/pflege/kalender': '/pflege/calendar',
  '/stationaer/kalender': '/stationaer/calendar',
  '/beratung/kalender': '/beratung/calendar',
  '/akademie/kalender': '/akademie/calendar',
  '/business/office/calendar': '/office/calendar',
};
