import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEventRecord } from '@/types/calendar';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import { employeePortalCalendarEventHref, employeePortalCalendarEventOverlaps, employeePortalCalendarPeriod } from '@/lib/portal/employeePortalCalendarNavigation';

const f = vi.hoisted(() => ({ calendar: vi.fn(), ownCalendar: vi.fn(), liveList: vi.fn(), execution: vi.fn() }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/calendar/calendarEventRepository', () => ({ calendarEventRepository: { listForPortal: f.calendar } }));
vi.mock('@/lib/calendar/calendarEventService', () => ({
  getEmployeeCalendarEvents: f.ownCalendar, getPortalCalendarEvents: vi.fn(),
  portalEventsToAppointmentItems: () => [],
}));
vi.mock('@/lib/portal/portalAppointmentsLiveService', () => ({
  fetchLivePortalAppointmentsForEmployee: f.liveList, fetchLivePortalAppointmentsForClient: vi.fn(), fetchLivePortalClientAppointmentDetail: vi.fn(),
}));
vi.mock('@/lib/portal/employeePortalExecutionLiveService', () => ({ fetchLiveEmployeePortalAssignmentDetail: f.execution }));
import { fetchPortalAppointmentDetail, fetchPortalAppointments } from '@/lib/portal/appointmentService';

const record = (patch: Partial<CalendarEventRecord> = {}): CalendarEventRecord => ({
  id: 'central-1', tenantId: 'tenant-1', relatedEmployeeId: 'employee-1', isEmployeePortalVisible: true,
  archivedAt: null, sourceType: 'appointment', title: 'Teamtermin', startAt: '2026-10-12T10:00:00Z', endAt: '2026-10-12T11:00:00Z',
  status: 'aktiv', publicNote: 'Bitte Unterlagen mitbringen', internalNote: 'Interne Notiz', description: 'Interne Beschreibung', ...patch,
} as CalendarEventRecord);
const event = (patch: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'event-1', title: 'Termin', type: 'termin', color: '#000', start: '2026-10-12T10:00:00Z', end: '2026-10-12T11:00:00Z', ...patch,
});
beforeEach(() => {
  vi.clearAllMocks();
  f.calendar.mockResolvedValue({ ok: true, data: [record()] });
  f.liveList.mockResolvedValue({ ok: true, data: [] });
  f.ownCalendar.mockResolvedValue({ ok: true, data: [] });
});
describe('Employee details read only the linked employee data', () => {
  it.each([{ tenantId: null, employeeId: 'employee-1' }, { tenantId: 'tenant-1', employeeId: null }])('fails closed for an incomplete live scope', async (scope) => {
    expect((await fetchPortalAppointmentDetail('appt-001', 'profile-1', 'employee_portal', scope)).ok).toBe(false);
    expect(f.execution).not.toHaveBeenCalled();
    expect(f.calendar).not.toHaveBeenCalled();
  });
  it('opens a released own calendar entry without offering execution or internal notes', async () => {
    const result = await fetchPortalAppointmentDetail('calendar:central-1', 'profile-1', 'employee_portal', { tenantId: 'tenant-1', employeeId: 'employee-1' });
    expect(f.calendar).toHaveBeenCalledWith('tenant-1', { portalType: 'employee', employeeId: 'employee-1' });
    expect(result).toMatchObject({ ok: true, data: { id: 'calendar:central-1', assignmentId: null, notes: 'Bitte Unterlagen mitbringen', canOpenExecution: false, executionRoute: null } });
    expect(JSON.stringify(result)).not.toContain('Interne');
    expect(f.execution).not.toHaveBeenCalled();
  });
  it.each([{ tenantId: 'foreign' }, { relatedEmployeeId: 'colleague' }, { isEmployeePortalVisible: false }, { archivedAt: '2026-10-01' }])('rejects a record outside the active scope: %j', async (patch) => {
    f.calendar.mockResolvedValue({ ok: true, data: [record(patch)] });
    expect((await fetchPortalAppointmentDetail('calendar:central-1', 'profile-1', 'employee_portal', { tenantId: 'tenant-1', employeeId: 'employee-1' })).ok).toBe(false);
  });
  it.each(['live', 'calendar'])('does not report a successful partial list when %s fails', async (source) => {
    (source === 'live' ? f.liveList : f.ownCalendar).mockResolvedValue({ ok: false, error: 'Datenabruf verweigert.' });
    expect(await fetchPortalAppointments('profile-1', 'employee_portal', { tenantId: 'tenant-1', employeeId: 'employee-1' })).toEqual({ ok: false, error: 'Datenabruf verweigert.' });
  });
});
describe('Team calendar navigation and periods', () => {
  it('routes own assignments to the portal and opens colleague or administrative events as information', () => {
    expect(employeePortalCalendarEventHref(event({ sourceType: 'assist_visit', sourceId: 'visit-1', employeeId: 'employee-1', href: '/assist/assignments/visit-1' }), 'employee-1')).toBe('/portal/employee/assignments/visit-1');
    expect(employeePortalCalendarEventHref(event({ sourceType: 'assist_visit', sourceId: 'visit-2', employeeId: 'colleague', href: '/portal/employee/assignments/visit-2' }), 'employee-1')).toBeNull();
    expect(employeePortalCalendarEventHref(event({ href: '/office/appointments/one' }), 'employee-1')).toBeNull();
    expect(employeePortalCalendarEventHref(event({ record: record() }), 'employee-1')).toBe('/portal/employee/assignments/calendar:central-1');
  });
  it('uses the same exact week for agenda and week, including Monday midnight', () => {
    const agenda = employeePortalCalendarPeriod(new Date(2026, 9, 15, 18, 30), 'agenda');
    expect(agenda).toEqual(employeePortalCalendarPeriod(new Date(2026, 9, 15, 18, 30), 'week'));
    expect(agenda.start).toEqual(new Date(2026, 9, 12));
    expect(agenda.end).toEqual(new Date(2026, 9, 19));
    expect(employeePortalCalendarEventOverlaps(event({ start: new Date(2026, 9, 11, 23).toISOString(), end: new Date(2026, 9, 12, 1).toISOString() }), agenda.start, agenda.end)).toBe(true);
    expect(employeePortalCalendarEventOverlaps(event({ start: agenda.end.toISOString(), end: new Date(2026, 9, 19, 1).toISOString() }), agenda.start, agenda.end)).toBe(false);
  });
  it('keeps month boundaries at the first day when the anchor is the 31st', () => {
    expect(employeePortalCalendarPeriod(new Date(2026, 0, 31, 19), 'month')).toEqual({ start: new Date(2026, 0, 1), end: new Date(2026, 1, 1) });
  });
});
