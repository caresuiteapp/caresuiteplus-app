import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarEventRecord } from '@/types/calendar';

const f = vi.hoisted(() => ({ calendar: vi.fn(), visit: vi.fn(), list: vi.fn() }));
vi.mock('@/lib/calendar/calendarEventRepository', () => ({ calendarEventRepository: { listForPortal: f.calendar } }));
vi.mock('@/lib/assist/visitService', () => ({ fetchVisitDispositionDetail: f.visit }));
vi.mock('@/lib/assist/repositories/visitRepository.supabase', () => ({ visitSupabaseRepository: { list: f.list } }));
vi.mock('@/lib/portal/clientPortalAssistLiveVisitService', () => ({
  projectClientPortalAssistLiveVisit: vi.fn(), sanitizeClientPortalLiveVisitPayload: vi.fn(),
}));
import { fetchLivePortalClientAppointmentDetail } from '@/lib/portal/portalAppointmentsLiveService';

const event = (override: Partial<CalendarEventRecord> = {}): CalendarEventRecord => ({
  id: 'central-1', tenantId: 'tenant-1', sourceId: 'care-1', moduleKey: 'pflege', sourceType: 'care_visit',
  relatedClientId: 'client-1', isClientPortalVisible: true, archivedAt: null,
  title: 'Pflegeberatung', startAt: '2026-12-01T10:00:00Z', endAt: '2026-12-01T11:00:00Z',
  status: 'aktiv', locationName: 'Beratungsraum', publicNote: 'Bitte klingeln.', internalNote: 'Private Dienstplanung', description: 'Nur intern',
  ...override,
} as CalendarEventRecord);
beforeEach(() => {
  vi.clearAllMocks();
  f.calendar.mockResolvedValue({ ok: true, data: [event()] });
  f.visit.mockResolvedValue({ ok: false, error: 'Einsatz nicht gefunden.' });
  f.list.mockResolvedValue({ ok: true, data: [] });
});

describe('Freigegebene zentrale Termine im Klientenportal', () => {
  it('opens its own released calendar entry and projects only public notes', async () => {
    const result = await fetchLivePortalClientAppointmentDetail('tenant-1', 'client-1', 'calendar:central-1');
    expect(f.calendar).toHaveBeenCalledWith('tenant-1', { portalType: 'client', clientId: 'client-1' });
    expect(result).toMatchObject({ ok: true, data: {
      id: 'calendar:central-1', title: 'Pflegeberatung', moduleKey: 'pflege', preparationNotes: 'Bitte klingeln.', liveVisit: null,
    } });
    expect(JSON.stringify(result)).not.toContain('Private Dienstplanung');
    expect(JSON.stringify(result)).not.toContain('Nur intern');
    expect(f.visit).not.toHaveBeenCalled();
  });
  it.each([
    { tenantId: 'other-tenant' }, { relatedClientId: 'other-client' },
    { isClientPortalVisible: false }, { archivedAt: '2026-09-01' },
  ])('rejects a foreign, hidden or archived record: %j', async (override) => {
    f.calendar.mockResolvedValue({ ok: true, data: [event(override)] });
    expect(await fetchLivePortalClientAppointmentDetail('tenant-1', 'client-1', 'calendar:central-1'))
      .toEqual({ ok: false, error: 'Einsatz nicht gefunden.' });
  });
  it('preserves a calendar read failure instead of presenting a successful empty detail', async () => {
    f.calendar.mockResolvedValue({ ok: false, error: 'Termine konnten nicht gelesen werden.' });
    expect(await fetchLivePortalClientAppointmentDetail('tenant-1', 'client-1', 'calendar:central-1'))
      .toEqual({ ok: false, error: 'Termine konnten nicht gelesen werden.' });
  });
  it('resolves an existing source-ID deep link through the same own-client calendar scope', async () => {
    const result = await fetchLivePortalClientAppointmentDetail('tenant-1', 'client-1', 'care-1');
    expect(result).toMatchObject({ ok: true, data: { id: 'calendar:central-1', title: 'Pflegeberatung' } });
  });
  it('does not select an arbitrary record when an old source-ID link is ambiguous', async () => {
    f.calendar.mockResolvedValue({ ok: true, data: [event(), event({ id: 'central-2' })] });
    expect((await fetchLivePortalClientAppointmentDetail('tenant-1', 'client-1', 'care-1')).ok).toBe(false);
  });
  it('does not offer changes for cancelled or past calendar entries', async () => {
    f.calendar.mockResolvedValue({ ok: true, data: [event({ status: 'cancelled' })] });
    const cancelled = await fetchLivePortalClientAppointmentDetail('tenant-1', 'client-1', 'calendar:central-1');
    expect(cancelled.ok && cancelled.data.canRequestChange).toBe(false);
    f.calendar.mockResolvedValue({ ok: true, data: [event({ endAt: '2020-01-01T10:00:00Z' })] });
    const past = await fetchLivePortalClientAppointmentDetail('tenant-1', 'client-1', 'calendar:central-1');
    expect(past.ok && past.data.canRequestChange).toBe(false);
  });
});
