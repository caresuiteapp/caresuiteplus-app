import { describe, expect, it } from 'vitest';
import {
  isPlannedVisitAutoBookable,
  joinOfficeTimekeepingData,
} from '@/lib/wfm/wfmOfficeDataJoinService';
import type { WfmOfficePlannedVisit, WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';

const NOW = new Date('2026-07-21T12:00:00.000Z');

function planned(overrides: Partial<WfmOfficePlannedVisit> = {}): WfmOfficePlannedVisit {
  return {
    assignmentId: 'visit-1',
    visitId: 'visit-1',
    tenantId: 'tenant-1',
    employeeId: 'employee-1',
    workDate: '2026-07-20',
    plannedStartAt: '2026-07-20T13:30:00.000Z',
    plannedEndAt: '2026-07-20T15:30:00.000Z',
    assignmentActualStartAt: '2026-07-20T13:34:00.000Z',
    assignmentActualEndAt: '2026-07-20T15:35:00.000Z',
    clientLabel: 'Margret Schmidt',
    assignmentTitle: 'Hauswirtschaft',
    assignmentStatus: 'beendet',
    ...overrides,
  };
}

describe('automatic Assist actual booking', () => {
  it('books complete green Assist actuals without an open review', () => {
    expect(isPlannedVisitAutoBookable(planned(), [], NOW)).toBe(true);

    const entries = joinOfficeTimekeepingData(
      [planned()],
      [],
      new Map([['employee-1', 'Mhi Aldeen Al Jlelati']]),
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      rowKind: 'planned_with_actual',
      actualStartAt: '2026-07-20T13:34:00.000Z',
      actualEndAt: '2026-07-20T15:35:00.000Z',
      netMinutes: 121,
      reviewStatus: 'approved',
      exportStatus: 'export_ready',
    });
    expect(entries[0].flags).toContain('auto_booked_from_assignment_actual');
    expect(entries[0].flags).not.toContain('missing_booking');
  });

  it('keeps deviations above five minutes in review', () => {
    const visit = planned({ assignmentActualStartAt: '2026-07-20T13:36:00.000Z' });
    expect(isPlannedVisitAutoBookable(visit, [], NOW)).toBe(false);
  });

  it('does not auto-book an interval that overlaps another booking', () => {
    const existing = {
      employeeId: 'employee-1',
      actualStartAt: '2026-07-20T15:00:00.000Z',
      actualEndAt: '2026-07-20T16:00:00.000Z',
      assignmentId: 'other-visit',
      visitId: 'other-visit',
    } as WfmOfficeTimeEntry;

    expect(isPlannedVisitAutoBookable(planned(), [existing], NOW)).toBe(false);
  });

  it('keeps incomplete and still-running visits out of automatic booking', () => {
    expect(isPlannedVisitAutoBookable(planned({ assignmentActualEndAt: null }), [], NOW)).toBe(false);
    expect(
      isPlannedVisitAutoBookable(
        planned({
          assignmentActualStartAt: '2026-07-21T13:30:00.000Z',
          assignmentActualEndAt: '2026-07-21T15:30:00.000Z',
        }),
        [],
        NOW,
      ),
    ).toBe(false);
  });
});
