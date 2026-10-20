import { describe, expect, it } from 'vitest';
import { buildEmploymentLiveUpdatePayload } from '@/lib/office/employeePersonnelFileMapper';
import { mapEmploymentStatusToDbStatus } from '@/lib/office/employeeStatusMapping';

describe('employeePersonnelEmploymentUpdate', () => {
  it('buildEmploymentLiveUpdatePayload maps employment fields to live columns', () => {
    expect(
      buildEmploymentLiveUpdatePayload({
        contractType: 'part_time',
        weeklyHours: 20,
        entryDate: '2026-01-15',
        employmentStatus: 'active',
      }),
    ).toEqual({
      employment_type: 'part_time',
      weekly_hours: 20,
      entry_date: '2026-01-15',
      status: 'active',
    });
  });

  it('mapEmploymentStatusToDbStatus maps personnel statuses to DB enum', () => {
    expect(mapEmploymentStatusToDbStatus('onboarding')).toBe('draft');
    expect(mapEmploymentStatusToDbStatus('sick_long_term')).toBe('sick');
    expect(mapEmploymentStatusToDbStatus('on_leave')).toBe('vacation');
    expect(mapEmploymentStatusToDbStatus('suspended')).toBe('blocked');
    expect(mapEmploymentStatusToDbStatus('terminated')).toBe('terminated');
  });
});
