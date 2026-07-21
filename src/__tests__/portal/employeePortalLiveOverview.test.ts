import { describe, expect, it } from 'vitest';
import {
  buildEmployeePortalOverviewFromAppointments,
  dedupeEmployeePortalAppointments,
  isActiveEmployeeAssignment,
  isDocumentationPendingEmployeeAssignment,
  mapPortalAppointmentToListItem,
  resolveDashboardCurrentAssignment,
} from '@/lib/portal/employeePortalLiveOverviewService';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';

const BASE: PortalAppointmentItem = {
  id: 'assign-live-1',
  title: 'Haushalt',
  startsAt: '2026-06-27T09:00:00.000Z',
  endsAt: '2026-06-27T10:00:00.000Z',
  status: 'aktiv',
  location: 'Musterstraße 1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  clientName: 'Max Mustermann',
};

describe('employeePortalLiveOverviewService', () => {
  it('shows one card and one KPI entry for duplicate technical series rows', () => {
    const start = new Date();
    start.setHours(9, 50, 0, 0);
    const end = new Date(start);
    end.setHours(11, 50, 0, 0);
    const duplicateRows = Array.from({ length: 7 }, (_, index) => ({
      ...BASE,
      id: `series-copy-${index}`,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      title: 'Haushaltswirtschaftliche Unterstützung',
    }));

    expect(dedupeEmployeePortalAppointments(duplicateRows)).toHaveLength(1);
    expect(buildEmployeePortalOverviewFromAppointments(duplicateRows).todayAssignments).toHaveLength(1);
  });

  it('keeps a separately planned replacement when its schedule differs', () => {
    const first = {
      ...BASE,
      id: 'series-old',
      startsAt: '2026-07-21T07:50:00.000Z',
      endsAt: '2026-07-21T09:50:00.000Z',
    };
    const replacement = {
      ...first,
      id: 'replacement-new',
      startsAt: '2026-07-21T07:55:00.000Z',
      endsAt: '2026-07-21T09:55:00.000Z',
    };

    expect(dedupeEmployeePortalAppointments([first, replacement])).toHaveLength(2);
  });

  it('maps live portal appointments into employee list items', () => {
    const item = mapPortalAppointmentToListItem(BASE);
    expect(item.assignmentId).toBe('assign-live-1');
    expect(item.status).toBe('bestaetigt');
    expect(item.clientName).toBe('Max Mustermann');
  });

  it('builds today and weekly slices from appointment items', () => {
    const start = new Date();
    start.setHours(Math.max(0, start.getHours() - 1), 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    const overview = buildEmployeePortalOverviewFromAppointments([
      { ...BASE, startsAt: start.toISOString(), endsAt: end.toISOString() },
    ]);
    expect(overview.todayAssignments).toHaveLength(1);
    expect(overview.weeklyPlan).toHaveLength(1);
    expect(overview.nextAssignments).toHaveLength(0);
  });

  it('recognises active assignment statuses', () => {
    expect(isActiveEmployeeAssignment('gestartet')).toBe(true);
    expect(isActiveEmployeeAssignment('geplant')).toBe(false);
    expect(isActiveEmployeeAssignment('abgeschlossen')).toBe(false);
  });

  it('preserves abgeschlossen when assignmentStatus is provided (not collapsed to gestartet)', () => {
    const item = mapPortalAppointmentToListItem({
      ...BASE,
      status: 'in_bearbeitung',
      assignmentStatus: 'abgeschlossen',
    });
    expect(item.status).toBe('abgeschlossen');
    expect(item.isLocked).toBe(true);
  });

  it('keeps abgeschlossen editable in portal when visit overlay marks incomplete', () => {
    const item = mapPortalAppointmentToListItem({
      ...BASE,
      status: 'in_bearbeitung',
      assignmentStatus: 'abgeschlossen',
      assignmentIncomplete: true,
    });
    expect(item.status).toBe('abgeschlossen');
    expect(item.isLocked).toBe(false);
    expect(item.documentationPending || item.signaturePending).toBe(true);
  });

  it('maps finished/beendet workflow slice back to gestartet without assignmentStatus (legacy)', () => {
    const item = mapPortalAppointmentToListItem({
      ...BASE,
      status: 'in_bearbeitung',
    });
    expect(item.status).toBe('gestartet');
  });

  it('prefers assignmentStatus over stale workflow status after end service', () => {
    const item = mapPortalAppointmentToListItem({
      ...BASE,
      status: 'aktiv',
      assignmentStatus: 'beendet',
    });
    expect(item.status).toBe('beendet');
    expect(isActiveEmployeeAssignment(item.status)).toBe(false);
    expect(item.documentationPending).toBe(true);
  });

  it('does not show Start for beendet assignments in today overview', () => {
    const start = new Date();
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(13, 0, 0, 0);

    const overview = buildEmployeePortalOverviewFromAppointments([
      {
        ...BASE,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        status: 'aktiv',
        assignmentStatus: 'beendet',
      },
    ]);
    expect(overview.todayAssignments[0]?.status).toBe('beendet');
    expect(isActiveEmployeeAssignment(overview.todayAssignments[0]?.status ?? 'geplant')).toBe(false);
  });

  it('prefers active assignment for dashboard current slot', () => {
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(11, 0, 0, 0);
    const laterStart = new Date(start);
    laterStart.setHours(14, 0, 0, 0);
    const laterEnd = new Date(laterStart);
    laterEnd.setHours(16, 0, 0, 0);

    const overview = buildEmployeePortalOverviewFromAppointments([
      {
        ...BASE,
        id: 'done-1',
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        assignmentStatus: 'beendet',
      },
      {
        ...BASE,
        id: 'active-1',
        startsAt: laterStart.toISOString(),
        endsAt: laterEnd.toISOString(),
        assignmentStatus: 'gestartet',
      },
    ]);

    expect(resolveDashboardCurrentAssignment(overview.todayAssignments)?.assignmentId).toBe('active-1');
  });

  it('falls back to documentation-pending assignment when none active', () => {
    const start = new Date();
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(12, 0, 0, 0);

    const overview = buildEmployeePortalOverviewFromAppointments([
      {
        ...BASE,
        id: 'doc-1',
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        assignmentStatus: 'beendet',
      },
    ]);

    const current = resolveDashboardCurrentAssignment(overview.todayAssignments);
    expect(current?.assignmentId).toBe('doc-1');
    expect(isDocumentationPendingEmployeeAssignment(current?.status ?? 'geplant')).toBe(true);
  });
});
