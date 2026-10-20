import { describe, expect, it } from 'vitest';
import { resolveAssignmentActualTimes } from '@/lib/wfm/wfmAssignmentActualResolver';
import {
  enrichOfficeTimeEntryDisplay,
  resolveWfmOfficeTimeDisplay,
} from '@/lib/wfm/wfmOfficeTimeDisplayResolver';
import {
  formatWfmReviewQueueDuration,
  formatWfmReviewQueueEndLabel,
  formatWfmReviewQueueGesamtLabel,
  formatWfmReviewQueueIstLabel,
  formatWfmReviewQueueIstLine,
  formatWfmReviewQueuePlannedDuration,
  formatWfmReviewQueueStartLabel,
} from '@/lib/wfm/wfmDisplayHelpers';
import { joinOfficeTimekeepingData } from '@/lib/wfm/wfmOfficeDataJoinService';
import type { WfmOfficePlannedVisit, WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';

function baseEntry(overrides: Partial<WfmOfficeTimeEntry> = {}): WfmOfficeTimeEntry {
  return {
    id: 'planned:asgn-1:2026-07-20',
    tenantId: 'tenant-1',
    employeeId: 'emp-1',
    employeeName: 'Ramona König',
    workDate: '2026-07-20',
    assignmentId: 'asgn-1',
    visitId: 'asgn-1',
    clientLabel: 'Mhi Aldeen Al Jlelati',
    plannedStartAt: '2026-07-20T07:00:00.000Z',
    plannedEndAt: '2026-07-20T09:30:00.000Z',
    actualStartAt: null,
    actualEndAt: null,
    startDeviationMinutes: null,
    endDeviationMinutes: null,
    startAmpel: null,
    endAmpel: null,
    overallAmpel: null,
    startJustification: null,
    endJustification: null,
    startJustificationAt: null,
    endJustificationAt: null,
    pauseMinutes: 0,
    grossMinutes: 0,
    netMinutes: 0,
    travelMinutes: null,
    workKind: 'einsatz',
    status: 'pending_review',
    source: 'system',
    reviewStatus: 'pending_review',
    exportStatus: 'not_exported',
    sessionId: null,
    officeComment: null,
    hasOpenOfficeMessage: false,
    flags: ['missing_booking'],
    rowKind: 'planned_missing_actual',
    planDisplayStatus: 'planned',
    actualDisplayStatus: 'not_captured',
    ...overrides,
  };
}

describe('wfmAssignmentActualResolver', () => {
  it('falls back to arrived_at and finished_at', () => {
    const resolved = resolveAssignmentActualTimes({
      actual_start_at: null,
      actual_end_at: null,
      arrived_at: '2026-07-20T07:00:00.000Z',
      finished_at: '2026-07-20T09:30:00.000Z',
    });
    expect(resolved.startAt).toBe('2026-07-20T07:00:00.000Z');
    expect(resolved.endAt).toBe('2026-07-20T09:30:00.000Z');
  });
});

describe('wfmOfficeTimeDisplayResolver', () => {
  it('uses time entry when actual booking exists', () => {
    const display = resolveWfmOfficeTimeDisplay(
      baseEntry({
        actualStartAt: '2026-07-20T07:05:00.000Z',
        actualEndAt: '2026-07-20T09:35:00.000Z',
        netMinutes: 150,
        flags: [],
        rowKind: 'planned_with_actual',
      }),
    );
    expect(display.displaySource).toBe('time_entry');
    expect(display.timeEntryStart).toBe('2026-07-20T07:05:00.000Z');
    expect(display.timeEntryDurationMinutes).toBe(150);
    expect(display.hasTimeEntry).toBe(true);
  });

  it('uses assignment actual when no time entry exists', () => {
    const display = resolveWfmOfficeTimeDisplay(
      baseEntry({
        assignmentActualStartAt: '2026-07-20T07:00:00.000Z',
        assignmentActualEndAt: '2026-07-20T09:30:00.000Z',
      }),
    );
    expect(display.displaySource).toBe('assignment_actual');
    expect(display.assignmentActualDurationMinutes).toBe(150);
    expect(display.hasTimeEntry).toBe(false);
    expect(display.bookingStatus).toBe('assignment_only');
  });

  it('marks planned-only without ist duration', () => {
    const display = resolveWfmOfficeTimeDisplay(baseEntry());
    expect(display.displaySource).toBe('planned_only');
    expect(display.plannedDurationMinutes).toBe(150);
    expect(display.displayDurationMinutes).toBe(0);
    expect(display.isPlannedOnly).toBe(true);
    expect(display.bookingStatus).toBe('missing_booking');
  });

  it('returns missing when no times at all', () => {
    const display = resolveWfmOfficeTimeDisplay(
      baseEntry({
        plannedStartAt: null,
        plannedEndAt: null,
        planDisplayStatus: 'plan_missing',
      }),
    );
    expect(display.displaySource).toBe('missing');
    expect(display.plannedDurationMinutes).toBe(0);
  });

  it('exposes review capabilities for open entries', () => {
    const display = resolveWfmOfficeTimeDisplay(baseEntry());
    expect(display.canOpenDetails).toBe(true);
    expect(display.canApprove).toBe(true);
    expect(display.canReject).toBe(true);
    expect(display.canRequestClarification).toBe(true);
  });
});

describe('review queue display helpers', () => {
  it('never shows planned duration on Ist line when booking missing', () => {
    const entry = enrichOfficeTimeEntryDisplay(baseEntry());
    expect(formatWfmReviewQueueIstLabel(entry)).toBe('noch nicht gebucht');
    expect(formatWfmReviewQueueDuration(entry)).toBe('—');
    expect(formatWfmReviewQueueIstLine(entry)).toBe('Ist: noch nicht gebucht');
    expect(formatWfmReviewQueuePlannedDuration(entry)).toBe('2:30 h');
    expect(formatWfmReviewQueueStartLabel(entry, null)).toContain('Start geplant:');
    expect(formatWfmReviewQueueEndLabel(entry, null)).toContain('Ende geplant:');
    expect(formatWfmReviewQueueGesamtLabel(entry)).toContain('Geplante Dauer:');
  });

  it('shows assignment actual label when Einsatz-Ist exists', () => {
    const entry = enrichOfficeTimeEntryDisplay(
      baseEntry({
        assignmentActualStartAt: '2026-07-20T07:00:00.000Z',
        assignmentActualEndAt: '2026-07-20T09:30:00.000Z',
      }),
    );
    expect(formatWfmReviewQueueIstLabel(entry)).toContain('Einsatz-Ist');
    expect(formatWfmReviewQueueDuration(entry)).toBe('2:30 h');
    expect(formatWfmReviewQueueIstLine(entry)).toContain('2:30 h');
    expect(formatWfmReviewQueueStartLabel(entry, null)).toContain('Einsatz-Ist');
  });

  it('keeps missing booking badge semantics via flags', () => {
    const entry = baseEntry();
    expect(entry.flags).toContain('missing_booking');
    expect(resolveWfmOfficeTimeDisplay(entry).hasTimeEntry).toBe(false);
  });

  it('join propagates assignment actual from planned visit', () => {
    const planned: WfmOfficePlannedVisit = {
      assignmentId: 'asgn-1',
      visitId: 'asgn-1',
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      workDate: '2026-07-20',
      plannedStartAt: '2026-07-20T07:00:00.000Z',
      plannedEndAt: '2026-07-20T09:30:00.000Z',
      assignmentActualStartAt: '2026-07-20T07:02:00.000Z',
      assignmentActualEndAt: '2026-07-20T09:28:00.000Z',
      clientLabel: 'Mhi Aldeen Al Jlelati',
      assignmentTitle: 'Einsatz',
      assignmentStatus: 'confirmed',
    };
    const rows = joinOfficeTimekeepingData([planned], [], new Map([['emp-1', 'Ramona König']]));
    expect(rows[0].assignmentActualStartAt).toBe('2026-07-20T07:02:00.000Z');
    expect(rows[0].displaySource ?? resolveWfmOfficeTimeDisplay(rows[0]).displaySource).toBe(
      'assignment_actual',
    );
    expect(formatWfmReviewQueueDuration(rows[0])).toBe('2:26 h');
  });
});
