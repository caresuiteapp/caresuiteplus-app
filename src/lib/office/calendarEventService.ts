import type { RoleKey, ServiceResult } from '@/types';
import type { AppointmentListItem } from '@/types/modules/appointmentList';
import type { AbsenceType } from '@/types/modules/employeeAbsence';
import type { CalendarEvent, CalendarEventType } from '@/types/modules/calendarEvent';
import { CALENDAR_EVENT_TYPE_COLORS } from '@/types/modules/calendarEvent';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { fetchAppointmentList } from './appointmentListService';
import { listAbsenceScheduleEntries } from './absenceScheduleService';
import { listScheduleEntries } from '@/lib/assist/assignmentWorkflowService';
import { addDays, startOfDay, toDateKey } from './calendarDateUtils';

function mapAbsenceType(absenceType: AbsenceType): CalendarEventType {
  if (absenceType === 'vacation') return 'urlaub';
  if (absenceType === 'sick_leave' || absenceType === 'child_sick_leave') return 'krank';
  if (absenceType === 'training') return 'weiterbildung';
  return 'abwesenheit';
}

function mapAppointment(item: AppointmentListItem): CalendarEvent {
  return {
    id: `termin-${item.id}`,
    title: item.clientName ? `${item.title} · ${item.clientName}` : item.title,
    start: item.startsAt,
    end: item.endsAt,
    type: 'termin',
    color: CALENDAR_EVENT_TYPE_COLORS.termin,
    sourceId: item.id,
    href: `/office/appointments/${item.id}`,
  };
}

function mapAssignment(entry: {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  clientName?: string;
}): CalendarEvent {
  return {
    id: `einsatz-${entry.id}`,
    title: entry.clientName ? `${entry.title} · ${entry.clientName}` : entry.title,
    start: entry.startsAt,
    end: entry.endsAt,
    type: 'einsatz',
    color: CALENDAR_EVENT_TYPE_COLORS.einsatz,
    sourceId: entry.id,
    href: `/assist/assignments/${entry.id}`,
  };
}

function mapAbsence(entry: {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  absenceType: AbsenceType;
}): CalendarEvent {
  const type = mapAbsenceType(entry.absenceType);
  return {
    id: entry.id,
    title: entry.title,
    start: entry.startsAt,
    end: entry.endsAt,
    type,
    color: CALENDAR_EVENT_TYPE_COLORS[type],
    allDay: true,
    sourceId: entry.absenceId,
  };
}

function buildDemoStubEvents(tenantId: string, anchor: Date): CalendarEvent[] {
  const base = startOfDay(anchor);
  const day = toDateKey(base);
  const mk = (
    id: string,
    type: CalendarEventType,
    title: string,
    offsetDays: number,
    startHour: number,
    endHour: number,
    allDay = false,
  ): CalendarEvent => {
    const date = addDays(base, offsetDays);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      id: `demo-${tenantId}-${id}`,
      title,
      start: allDay ? `${y}-${m}-${d}T00:00:00.000Z` : `${y}-${m}-${d}T${pad(startHour)}:00:00.000Z`,
      end: allDay ? `${y}-${m}-${d}T23:59:59.000Z` : `${y}-${m}-${d}T${pad(endHour)}:00:00.000Z`,
      type,
      color: CALENDAR_EVENT_TYPE_COLORS[type],
      allDay,
    };
  };

  return [
    mk('reminder', 'erinnerung', 'Medikamenten-Check Klient Müller', 1, 9, 9),
    mk('vacation', 'urlaub', 'Urlaub — Team Assist', 3, 0, 0, true),
    mk('vacation', 'urlaub', 'Urlaub — Team Assist', 4, 0, 0, true),
    mk('sick', 'krank', 'Krankmeldung — Schmidt', 2, 0, 0, true),
    mk('meeting', 'team_meeting', 'Team-Besprechung Office', 5, 10, 11),
    mk('handover', 'uebergabe', 'Übergabe Frühdienst', 0, 14, 14),
    mk('training', 'weiterbildung', 'Hygiene-Schulung Pflicht', 8, 13, 16),
    mk('absence', 'abwesenheit', 'Fortbildungstag — Weber', 6, 0, 0, true),
    mk('reminder', 'erinnerung', `Tages-Review ${day}`, 0, 17, 17),
  ];
}

export type FetchCalendarEventsOptions = {
  rangeStart?: string;
  rangeEnd?: string;
  includeDemoStubs?: boolean;
};

export async function fetchCalendarEvents(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
  options?: FetchCalendarEventsOptions,
): Promise<ServiceResult<CalendarEvent[]>> {
  const denied = enforcePermission<CalendarEvent[]>(actorRoleKey, 'office.appointments.view');
  if (denied) return denied;

  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;

  const appointmentsResult = await fetchAppointmentList(tenantId, actorRoleKey);
  if (!appointmentsResult.ok) return appointmentsResult;

  const events: CalendarEvent[] = appointmentsResult.data.map(mapAppointment);

  for (const entry of listScheduleEntries(tenantId)) {
    events.push(
      mapAssignment({
        id: entry.id,
        title: entry.title,
        startsAt: entry.startsAt,
        endsAt: entry.endsAt,
      }),
    );
  }

  for (const entry of listAbsenceScheduleEntries(tenantId)) {
    events.push(mapAbsence(entry));
  }

  if (options?.includeDemoStubs !== false) {
    const anchor = options?.rangeStart ? new Date(options.rangeStart) : new Date();
    events.push(...buildDemoStubEvents(tenantId, anchor));
  }

  const filtered = events.filter((event) => {
    if (!options?.rangeStart && !options?.rangeEnd) return true;
    const start = new Date(event.start).getTime();
    const end = new Date(event.end).getTime();
    const rangeStart = options.rangeStart ? new Date(options.rangeStart).getTime() : -Infinity;
    const rangeEnd = options.rangeEnd ? new Date(options.rangeEnd).getTime() : Infinity;
    return start <= rangeEnd && end >= rangeStart;
  });

  filtered.sort((a, b) => a.start.localeCompare(b.start));
  return { ok: true, data: filtered };
}

export function filterEventsByVisibleTypes(
  events: CalendarEvent[],
  visibleTypes: Record<CalendarEventType, boolean>,
): CalendarEvent[] {
  return events.filter((event) => visibleTypes[event.type] !== false);
}
