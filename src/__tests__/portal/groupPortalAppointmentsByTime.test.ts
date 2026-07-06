import { describe, expect, it } from 'vitest';
import { groupPortalAppointmentsByTime } from '@/lib/portal/groupPortalAppointmentsByTime';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';

function appt(id: string, startsAt: string): PortalAppointmentItem {
  return {
    id,
    title: `Einsatz ${id}`,
    startsAt,
    endsAt: startsAt,
    status: 'geplant',
    location: 'Berlin',
    clientId: 'c1',
    employeeId: 'e1',
  };
}

describe('groupPortalAppointmentsByTime', () => {
  it('splits upcoming and past appointments', () => {
    const now = new Date('2026-07-06T12:00:00.000Z');
    const groups = groupPortalAppointmentsByTime(
      [
        appt('past', '2026-07-05T10:00:00.000Z'),
        appt('future', '2026-07-07T10:00:00.000Z'),
      ],
      now,
    );

    expect(groups.map((g) => g.key)).toEqual(['upcoming', 'past']);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['future']);
    expect(groups[1]?.items.map((i) => i.id)).toEqual(['past']);
  });
});
