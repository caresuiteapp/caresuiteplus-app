import { describe, expect, it } from 'vitest';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';
import { groupPortalPastAppointmentsByMonth } from '@/lib/portal/groupPortalAppointmentsByTime';
import { resolvePortalUpcomingCareTeam, selectPortalSectionAppointments } from '@/lib/portal/portalSectionAppointments';
import { resolvePortalOverviewAction } from '@/lib/portal/portalOverviewAction';

const item = (id: string, startsAt: string, overrides: Partial<PortalAppointmentItem> = {}): PortalAppointmentItem => ({
  id, title: 'Haushalt', startsAt, endsAt: startsAt, status: 'aktiv', location: null, clientId: 'client-1', employeeId: 'employee-1', employeeName: 'Betreuungskraft A', ...overrides,
});
describe('Client history and released section datasets', () => {
  it('offers each actual history month newest first without mixing years or changing the input', () => {
    const source = [item('old', '2025-09-15T12:00:00Z'), item('first', '2026-10-01T12:00:00Z'), item('latest', '2026-10-10T12:00:00Z'), item('summer', '2026-08-01T12:00:00Z')];
    const months = groupPortalPastAppointmentsByMonth(source);
    expect(months.map((group) => group.key)).toEqual(['2026-10', '2026-08', '2025-09']);
    expect(months[0].items.map((entry) => entry.id)).toEqual(['latest', 'first']);
    expect(source[0].id).toBe('old');
  });
  it('shows actual accompaniment visits without unrelated household visits', () => {
    const items = [item('household', '2026-11-01'), item('trip', '2026-11-02', { serviceName: 'Arztbegleitung' }), item('daily', '2026-11-03', { title: 'Alltagsbegleitung' })];
    expect(selectPortalSectionAppointments(items, 'begleitungen').map((entry) => entry.id)).toEqual(['trip', 'daily']);
    expect(selectPortalSectionAppointments(items, 'betreuung')).toEqual(items);
  });
  it('derives a unique current team from upcoming own assignments, excluding past and cancelled visits', () => {
    const now = new Date('2026-10-11T10:00:00Z');
    const entries = [item('past', '2026-09-01', { employeeId: 'old', employeeName: 'Frühere Kraft' }), item('new-1', '2026-11-01'), item('new-2', '2026-11-02'), item('cancelled', '2026-11-03', { assignmentStatus: 'storniert', employeeId: 'cancelled', employeeName: 'Abgesagte Kraft' })];
    expect(resolvePortalUpcomingCareTeam(entries, now)).toEqual([{ id: 'employee-1', name: 'Betreuungskraft A' }]);
  });
  it('rejects direct request, upload and proof actions without the corresponding release', () => {
    const none = { requestsReleased: false, proofsReleased: false, uploadReleased: false };
    for (const action of ['upload', 'nachweise', 'termin_aendern', 'zusatztermin', 'rueckruf']) {
      expect(resolvePortalOverviewAction(action, none)).toBeNull();
    }
    expect(resolvePortalOverviewAction('termin_aendern', { ...none, requestsReleased: true })).toBe('termin_aendern');
    expect(resolvePortalOverviewAction('upload', { ...none, uploadReleased: true })).toBe('upload');
    expect(resolvePortalOverviewAction('nachweise', { ...none, proofsReleased: true })).toBe('nachweise');
    expect(resolvePortalOverviewAction('unknown', { requestsReleased: true, proofsReleased: true, uploadReleased: true })).toBeNull();
  });
});
