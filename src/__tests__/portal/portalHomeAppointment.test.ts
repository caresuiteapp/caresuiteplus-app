import { describe, expect, it } from 'vitest';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';
import {
  employeePortalHomeAppointmentTitle,
  selectPortalHomeAppointment,
} from '@/lib/portal/portalHomeAppointment';

function appointment(
  id: string,
  startsAt: string,
  endsAt: string,
  assignmentStatus: PortalAppointmentItem['assignmentStatus'] = 'bestaetigt',
): PortalAppointmentItem {
  return {
    id,
    title: 'Entlastungsleistung §45b SGB XI',
    startsAt,
    endsAt,
    status: 'aktiv',
    location: 'Dortmund',
    clientId: 'client-1',
    employeeId: 'employee-1',
    assignmentStatus,
  };
}

describe('portal home appointment focus', () => {
  const now = new Date('2026-07-30T08:00:00.000Z');

  it('ignores a historical appointment and selects the upcoming visit', () => {
    const selected = selectPortalHomeAppointment(
      [
        appointment(
          'old',
          '2026-07-03T07:30:00.000Z',
          '2026-07-03T09:30:00.000Z',
        ),
        appointment(
          'next',
          '2026-07-31T07:30:00.000Z',
          '2026-07-31T09:30:00.000Z',
        ),
      ],
      now,
    );

    expect(selected?.id).toBe('next');
  });

  it('keeps an incomplete visit visible until documentation is finished', () => {
    const incomplete = {
      ...appointment(
        'documentation',
        '2026-07-29T07:30:00.000Z',
        '2026-07-29T09:30:00.000Z',
        'dokumentation_offen',
      ),
      assignmentIncomplete: true,
    };

    expect(selectPortalHomeAppointment([incomplete], now)?.id).toBe('documentation');
  });

  it('uses an operational employee title instead of a billing label', () => {
    const item = {
      ...appointment(
        'next',
        '2026-07-31T07:30:00.000Z',
        '2026-07-31T09:30:00.000Z',
      ),
      clientName: 'Iris Jäger',
    };

    expect(employeePortalHomeAppointmentTitle(item)).toBe('Einsatz bei Iris Jäger');
  });

  it('never exposes a billing title when no client name is available', () => {
    const item = appointment(
      'next',
      '2026-07-31T07:30:00.000Z',
      '2026-07-31T09:30:00.000Z',
    );

    expect(employeePortalHomeAppointmentTitle(item)).toBe('Nächster Einsatz');
  });
});
