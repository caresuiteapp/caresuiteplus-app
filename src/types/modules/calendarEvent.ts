/** Office Kalender — unified event model across Termine, Einsätze, Abwesenheiten, etc. */

export type CalendarEventType =
  | 'termin'
  | 'einsatz'
  | 'erinnerung'
  | 'urlaub'
  | 'krank'
  | 'abwesenheit'
  | 'team_meeting'
  | 'uebergabe'
  | 'weiterbildung';

export type CalendarViewMode = 'day' | 'week' | 'month' | 'year';

export type WeekStartDay = 0 | 1;

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  type: CalendarEventType;
  color: string;
  allDay?: boolean;
  sourceId?: string;
  href?: string;
};

export const CALENDAR_EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  termin: 'Termine',
  einsatz: 'Einsätze',
  erinnerung: 'Erinnerungen',
  urlaub: 'Urlaub',
  krank: 'Krank',
  abwesenheit: 'Abwesenheiten',
  team_meeting: 'Team Meetings',
  uebergabe: 'Übergaben',
  weiterbildung: 'Weiterbildungen',
};

export const CALENDAR_EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  termin: '#62F3FF',
  einsatz: '#FFB020',
  erinnerung: '#94A3B8',
  urlaub: '#22C55E',
  krank: '#F97316',
  abwesenheit: '#A78BFA',
  team_meeting: '#7C5CFF',
  uebergabe: '#FFD166',
  weiterbildung: '#EC4899',
};

export type TenantCalendarSettings = {
  tenantId: string;
  defaultView: CalendarViewMode;
  weekStartDay: WeekStartDay;
  dayViewStartHour: number;
  weekFullDay: boolean;
  maxCollapsedEvents: number;
  visibleTypes: Record<CalendarEventType, boolean>;
  updatedAt: string;
};

export type TenantCalendarSettingsForm = Omit<TenantCalendarSettings, 'tenantId' | 'updatedAt'>;

export const DEFAULT_VISIBLE_TYPES: Record<CalendarEventType, boolean> = {
  termin: true,
  einsatz: true,
  erinnerung: true,
  urlaub: true,
  krank: true,
  abwesenheit: true,
  team_meeting: true,
  uebergabe: true,
  weiterbildung: true,
};

export function buildDefaultTenantCalendarSettings(tenantId: string): TenantCalendarSettings {
  return {
    tenantId,
    defaultView: 'month',
    weekStartDay: 1,
    dayViewStartHour: 6,
    weekFullDay: true,
    maxCollapsedEvents: 3,
    visibleTypes: { ...DEFAULT_VISIBLE_TYPES },
    updatedAt: new Date().toISOString(),
  };
}
