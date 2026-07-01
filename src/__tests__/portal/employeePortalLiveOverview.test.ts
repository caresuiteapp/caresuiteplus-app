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
    const overview = buildEmployeePortalOverviewFromAppointments([BASE]);
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
});
