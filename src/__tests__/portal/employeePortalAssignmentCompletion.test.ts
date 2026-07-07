import { describe, expect, it } from 'vitest';
import {
  filterEmployeePortalAppointments,
  mapPortalAppointmentToListItem,
} from '@/lib/portal/employeePortalLiveOverviewService';
import {
  isEmployeePortalAssignmentEditable,
  isEmployeePortalAssignmentLocked,
  resolveEmployeePortalAssignmentPendingFlags,
  shouldShowAssignmentInEmployeePortalList,
} from '@/lib/portal/employeePortalAssignmentCompletion';
import type { PortalAppointmentItem } from '@/lib/portal/appointmentService';

const BASE: PortalAppointmentItem = {
  id: 'assign-1',
  title: 'Haushalt',
  startsAt: '2026-07-07T10:00:00.000Z',
  endsAt: '2026-07-07T12:00:00.000Z',
  status: 'in_bearbeitung',
  location: 'Musterstraße 1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  clientName: 'Max Mustermann',
};

describe('employeePortalAssignmentCompletion', () => {
  it('keeps abgeschlossen assignments editable when documentation is still open', () => {
    const flags = resolveEmployeePortalAssignmentPendingFlags({
      status: 'abgeschlossen',
      requiresDocumentation: true,
      documentationStatus: 'draft',
      assignmentIncomplete: true,
    });
    expect(flags.documentationPending).toBe(true);
    expect(
      isEmployeePortalAssignmentLocked({
        status: 'abgeschlossen',
        requiresDocumentation: true,
        documentationStatus: 'draft',
        assignmentIncomplete: true,
      }),
    ).toBe(false);
    expect(
      isEmployeePortalAssignmentEditable({
        status: 'abgeschlossen',
        requiresDocumentation: true,
        documentationStatus: 'draft',
        assignmentIncomplete: true,
      }),
    ).toBe(true);
  });

  it('locks abgeschlossen assignments when documentation and signature are complete', () => {
    expect(
      isEmployeePortalAssignmentLocked({
        status: 'abgeschlossen',
        requiresDocumentation: true,
        requiresSignature: true,
        documentationStatus: 'submitted',
        signatureStatus: 'captured',
        assignmentIncomplete: false,
      }),
    ).toBe(true);
  });

  it('maps incomplete abgeschlossen list items as unlocked with open signature', () => {
    const item = mapPortalAppointmentToListItem({
      ...BASE,
      assignmentStatus: 'abgeschlossen',
      assignmentIncomplete: true,
    });
    expect(item.status).toBe('abgeschlossen');
    expect(item.isLocked).toBe(false);
    expect(item.documentationPending || item.signaturePending).toBe(true);
  });

  it('hides only past fully complete abgeschlossen assignments from portal lists', () => {
    const now = new Date('2026-07-07T12:00:00.000Z');
    expect(
      shouldShowAssignmentInEmployeePortalList({
        status: 'abgeschlossen',
        plannedStartAt: '2026-07-06T10:00:00.000Z',
        requiresDocumentation: true,
        requiresSignature: true,
        documentationStatus: 'submitted',
        signatureStatus: 'captured',
        assignmentIncomplete: false,
        now,
      }),
    ).toBe(false);

    expect(
      shouldShowAssignmentInEmployeePortalList({
        status: 'abgeschlossen',
        plannedStartAt: '2026-07-06T10:00:00.000Z',
        assignmentIncomplete: true,
        now,
      }),
    ).toBe(true);
  });

  it('filterEmployeePortalAppointments keeps incomplete abgeschlossen rows', () => {
    const filtered = filterEmployeePortalAppointments([
      {
        ...BASE,
        id: 'done-complete',
        assignmentStatus: 'abgeschlossen',
        assignmentIncomplete: false,
        startsAt: '2026-07-06T10:00:00.000Z',
      },
      {
        ...BASE,
        id: 'done-open-signature',
        assignmentStatus: 'abgeschlossen',
        assignmentIncomplete: true,
        startsAt: '2026-07-06T10:00:00.000Z',
      },
    ]);
    expect(filtered.map((item) => item.id)).toEqual(['done-open-signature']);
  });
});
