import { beforeEach, describe, expect, it, vi } from 'vitest';

const f = vi.hoisted(() => ({ detail: vi.fn(), request: vi.fn(), calendar: vi.fn(), list: vi.fn() }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => null }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/portal/assist/portalRequestService', () => ({ createPortalRequest: f.request }));
vi.mock('@/lib/portal/portalAppointmentsLiveService', () => ({
  fetchLivePortalClientAppointmentDetail: f.detail,
  fetchLivePortalAppointmentsForClient: f.list,
  fetchLivePortalAppointmentsForEmployee: vi.fn(),
}));
vi.mock('@/lib/calendar/calendarEventService', () => ({
  getPortalCalendarEvents: f.calendar,
  getEmployeeCalendarEvents: vi.fn(),
  portalEventsToAppointmentItems: (events: any[]) => events.map((event) => ({
    id: event.sourceId ?? event.id, title: event.title, startsAt: event.start, endsAt: event.end,
    status: event.status ?? 'aktiv', clientId: event.record?.relatedClientId, employeeId: null,
  })),
}));
import { fetchPortalAppointments, fetchPortalClientAppointmentDetail, requestPortalAppointmentChange } from '@/lib/portal/appointmentService';

const context = { tenantId: 'tenant-1', clientId: 'client-1' };
beforeEach(() => {
  vi.clearAllMocks();
  f.detail.mockResolvedValue({ ok: true, data: {
    id: 'calendar:event-1', title: 'Pflegeberatung', startsAt: '2026-11-01T10:00:00Z', endsAt: '2026-11-01T11:00:00Z', moduleKey: 'pflege', canRequestChange: true,
  } });
  f.request.mockResolvedValue({ ok: true, data: { id: 'persisted-request' } });
});

describe('Client appointment changes persist before success', () => {
  it('creates the existing office request with the scoped appointment and returns its real ID', async () => {
    const result = await requestPortalAppointmentChange('calendar:event-1', 'portal-account', 'client_portal', '  Bitte einen späteren Termin.  ', context);
    expect(f.detail).toHaveBeenCalledWith('tenant-1', 'client-1', 'calendar:event-1', undefined);
    expect(f.request).toHaveBeenCalledWith(expect.objectContaining({
      ...context, portalUserId: 'portal-account', moduleKey: 'pflege', requestType: 'termin_aendern',
      description: 'Bitte einen späteren Termin.',
      payload: expect.objectContaining({ appointmentId: 'calendar:event-1', appointmentLabel: 'Pflegeberatung', nachricht: 'Bitte einen späteren Termin.' }),
    }));
    expect(result).toEqual({ ok: true, data: { requestId: 'persisted-request' } });
  });
  it('returns persistence failure without manufacturing success', async () => {
    f.request.mockResolvedValue({ ok: false, error: 'Anfrage konnte nicht gespeichert werden.' });
    expect(await requestPortalAppointmentChange('visit-1', 'portal-account', 'client_portal', 'Bitte ändern.', context))
      .toEqual({ ok: false, error: 'Anfrage konnte nicht gespeichert werden.' });
  });
  it('does not create a request when the appointment is no longer changeable', async () => {
    f.detail.mockResolvedValue({ ok: true, data: { canRequestChange: false } });
    expect((await requestPortalAppointmentChange('visit-1', 'portal-account', 'client_portal', 'Bitte ändern.', context)).ok).toBe(false);
    expect(f.request).not.toHaveBeenCalled();
  });
  it('does not fall back to demo detail when the live client scope is missing', async () => {
    const result = await fetchPortalClientAppointmentDetail('appt-001', 'portal-account', 'client_portal', { tenantId: 'tenant-1' });
    expect(result.ok).toBe(false);
    expect(f.detail).not.toHaveBeenCalled();
  });
  it('keeps calendar-only identity distinct while preserving real Assist identity', async () => {
    f.list.mockResolvedValue({ ok: true, data: [{ id: 'assist-1', title: 'Assist', startsAt: '2026-11-01T10:00:00Z' }] });
    f.calendar.mockResolvedValue({ ok: true, data: [
      { id: 'central-1', sourceId: 'care-1', sourceType: 'care_visit', title: 'Pflege', start: '2026-11-02T10:00:00Z', record: { id: 'central-1', relatedClientId: 'client-1' } },
      { id: 'central-2', sourceId: 'assist-1', sourceType: 'assist_visit', title: 'Assist', start: '2026-11-01T10:00:00Z', record: { id: 'central-2', relatedClientId: 'client-1' } },
    ] });
    const result = await fetchPortalAppointments('portal-account', 'client_portal', context);
    expect(result.ok && result.data.map((item) => item.id)).toEqual(['assist-1', 'calendar:central-1']);
  });
});
