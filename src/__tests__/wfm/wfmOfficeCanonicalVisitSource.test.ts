import { describe, expect, it } from 'vitest';
import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';
import { mapCanonicalVisitToPlannedVisit } from '@/lib/wfm/wfmOfficePlannedVisitRepository';

function canonicalVisit(
  overrides: Partial<VisitDispositionListItem> = {},
): VisitDispositionListItem {
  return {
    id: 'visit-1',
    tenantId: 'tenant-1',
    clientId: 'client-1',
    title: 'Hauswirtschaft',
    serviceName: 'Alltagsbegleitung',
    scheduledStart: '2026-07-21T09:50:00.000Z',
    scheduledEnd: '2026-07-21T11:50:00.000Z',
    durationMinutes: 120,
    status: 'aktiv',
    assignmentStatus: 'geplant',
    planningStatus: 'scheduled',
    executionStatus: 'pending',
    onTheWayAt: null,
    arrivedAt: null,
    actualStartAt: null,
    actualEndAt: null,
    documentationStatus: 'none',
    proofStatus: 'none',
    billingStatus: 'none',
    location: 'Dortmund',
    clientName: 'Doris Niemeyer',
    employeeId: 'employee-1',
    employeeName: 'Kathrin Pott',
    isAtRisk: false,
    isIncomplete: false,
    updatedAt: '2026-07-20T12:00:00.000Z',
    ...overrides,
  };
}

describe('Office Arbeitszeit canonical visit source', () => {
  it('maps plan and actual times from the same canonical visit used by Einsaetze', () => {
    const mapped = mapCanonicalVisitToPlannedVisit(
      canonicalVisit({
        actualStartAt: '2026-07-21T09:54:00.000Z',
        actualEndAt: '2026-07-21T11:51:00.000Z',
        assignmentStatus: 'beendet',
      }),
    );

    expect(mapped).toMatchObject({
      assignmentId: 'visit-1',
      visitId: 'visit-1',
      employeeId: 'employee-1',
      workDate: '2026-07-21',
      plannedStartAt: '2026-07-21T09:50:00.000Z',
      plannedEndAt: '2026-07-21T11:50:00.000Z',
      assignmentActualStartAt: '2026-07-21T09:54:00.000Z',
      assignmentActualEndAt: '2026-07-21T11:51:00.000Z',
      clientLabel: 'Doris Niemeyer',
      assignmentTitle: 'Alltagsbegleitung',
      assignmentStatus: 'beendet',
    });
  });

  it('preserves virtual recurring occurrence IDs and their occurrence date', () => {
    const mapped = mapCanonicalVisitToPlannedVisit(
      canonicalVisit({
        id: 'visit-master::2026-07-28',
        scheduledStart: '2026-07-28T09:50:00.000Z',
        scheduledEnd: '2026-07-28T11:50:00.000Z',
      }),
    );

    expect(mapped?.assignmentId).toBe('visit-master::2026-07-28');
    expect(mapped?.workDate).toBe('2026-07-28');
  });

  it('excludes drafts, cancelled visits and visits without an employee', () => {
    expect(mapCanonicalVisitToPlannedVisit(canonicalVisit({ planningStatus: 'draft' }))).toBeNull();
    expect(
      mapCanonicalVisitToPlannedVisit(canonicalVisit({ assignmentStatus: 'storniert' })),
    ).toBeNull();
    expect(mapCanonicalVisitToPlannedVisit(canonicalVisit({ employeeId: null }))).toBeNull();
  });
});
