import type { CalendarModuleKey, CalendarEventRecordType } from '@/types/calendar';
import type { CalendarEventType } from '@/types/modules/calendarEvent';

export const MODULE_CALENDAR_COLORS: Record<CalendarModuleKey, string> = {
  office: '#62F3FF',
  assist: '#FFB020',
  pflege: '#22D3EE',
  stationaer: '#A78BFA',
  beratung: '#06B6D4',
  akademie: '#EC4899',
  portal: '#94A3B8',
  global: '#7C5CFF',
  all: '#62F3FF',
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  termin: '#62F3FF',
  einsatz: '#FFB020',
  abwesenheit: '#94A3B8',
  urlaub: '#38BDF8',
  urlaub_legacy: '#38BDF8',
  krankheit: '#EF4444',
  krank: '#F97316',
  schulung: '#EC4899',
  weiterbildung: '#EC4899',
  besprechung: '#7C5CFF',
  team_meeting: '#7C5CFF',
  frist: '#FACC15',
  wiedervorlage: '#FACC15',
  beratung: '#06B6D4',
  besuch: '#22C55E',
  aktivitaet: '#A78BFA',
  pflegevisite: '#14B8A6',
  rueckruf: '#F472B6',
  dokument: '#CBD5E1',
  abrechnung: '#FBBF24',
  sonstiges: '#64748B',
  erinnerung: '#94A3B8',
  uebergabe: '#FFD166',
};

export function resolveCalendarEventColor(
  moduleKey: CalendarModuleKey,
  eventType: CalendarEventRecordType | CalendarEventType,
  colorKey?: string | null,
): string {
  if (colorKey && MODULE_CALENDAR_COLORS[colorKey as CalendarModuleKey]) {
    return MODULE_CALENDAR_COLORS[colorKey as CalendarModuleKey];
  }
  return EVENT_TYPE_COLORS[eventType] ?? MODULE_CALENDAR_COLORS[moduleKey] ?? '#62F3FF';
}

export const MODULE_EVENT_TYPES: Partial<Record<CalendarModuleKey, CalendarEventRecordType[]>> = {
  assist: ['einsatz', 'termin', 'urlaub', 'krankheit', 'abwesenheit', 'besprechung', 'frist', 'rueckruf'],
  pflege: ['pflegevisite', 'einsatz', 'termin', 'frist', 'besprechung', 'abwesenheit'],
  stationaer: ['aktivitaet', 'besuch', 'termin', 'besprechung', 'frist', 'wiedervorlage'],
  beratung: ['beratung', 'termin', 'wiedervorlage', 'frist', 'rueckruf'],
  akademie: ['schulung', 'termin', 'frist'],
};
