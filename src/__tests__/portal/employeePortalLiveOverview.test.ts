import { describe, expect, it } from 'vitest';
import {
  buildEmployeePortalOverviewFromAppointments,
  isActiveEmployeeAssignment,
  mapPortalAppointmentToListItem,
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
  it('maps live portal appointments into employee list items', () => {
    const item = mapPortalAppointmentToListItem(BASE);
    expect(item.assignmentId).toBe('assign-live-1');
    expect(item.status).toBe('bestaetigt');
    expect(item.clientName).toBe('Max Mustermann');
  });

  it('builds today and weekly slices from appointment items', () => {
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(10, 0, 0, 0);
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
});
