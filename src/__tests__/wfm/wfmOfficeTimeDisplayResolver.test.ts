import { describe, expect, it } from 'vitest';
import {
  enrichOfficeTimeEntryDisplay,
  resolveWfmOfficeTimeDisplay,
} from '@/lib/wfm/wfmOfficeTimeDisplayResolver';
import {
  formatWfmReviewQueueDuration,
  formatWfmReviewQueueEndLabel,
  formatWfmReviewQueueGesamtLabel,
  formatWfmReviewQueueIstLabel,
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
    expect(display.timeSource).toBe('time_entry');
    expect(display.displayStart).toBe('2026-07-20T07:05:00.000Z');
    expect(display.displayDurationMinutes).toBe(150);
    expect(display.hasTimeEntry).toBe(true);
  });

  it('uses assignment actual when no time entry exists', () => {
    const display = resolveWfmOfficeTimeDisplay(
      baseEntry({
        assignmentActualStartAt: '2026-07-20T07:00:00.000Z',
        assignmentActualEndAt: '2026-07-20T09:30:00.000Z',
      }),
    );
    expect(display.timeSource).toBe('assignment_actual');
    expect(display.displayDurationMinutes).toBe(150);
    expect(display.hasTimeEntry).toBe(false);
  });

  it('falls back to planned times when only plan exists', () => {
    const display = resolveWfmOfficeTimeDisplay(baseEntry());
    expect(display.timeSource).toBe('assignment_planned');
    expect(display.displayStart).toBe('2026-07-20T07:00:00.000Z');
    expect(display.displayEnd).toBe('2026-07-20T09:30:00.000Z');
    expect(display.displayDurationMinutes).toBe(150);
  });

  it('returns missing when no times at all', () => {
    const display = resolveWfmOfficeTimeDisplay(
      baseEntry({
        plannedStartAt: null,
        plannedEndAt: null,
        planDisplayStatus: 'plan_missing',
      }),
    );
    expect(display.timeSource).toBe('missing');
    expect(display.displayDurationMinutes).toBe(0);
  });
});

describe('review queue display helpers', () => {
  it('shows planned start/end labels when booking missing but plan exists', () => {
    const entry = enrichOfficeTimeEntryDisplay(baseEntry());
    expect(formatWfmReviewQueueIstLabel(entry)).toBe('noch nicht gebucht');
    expect(formatWfmReviewQueueStartLabel(entry, null)).toContain('Start geplant:');
    expect(formatWfmReviewQueueEndLabel(entry, null)).toContain('Ende geplant:');
    expect(formatWfmReviewQueueDuration(entry)).not.toBe('—');
    expect(formatWfmReviewQueueGesamtLabel(entry)).toContain('Dauer geplant:');
  });

  it('shows assignment actual label when Einsatz-Ist exists', () => {
    const entry = enrichOfficeTimeEntryDisplay(
      baseEntry({
        assignmentActualStartAt: '2026-07-20T07:00:00.000Z',
        assignmentActualEndAt: '2026-07-20T09:30:00.000Z',
      }),
    );
    expect(formatWfmReviewQueueIstLabel(entry)).toContain('aus Einsatz');
    expect(formatWfmReviewQueueStartLabel(entry, null)).toContain('(Einsatz)');
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
    expect(rows[0].timeSource).toBe('assignment_actual');
    expect(formatWfmReviewQueueDuration(rows[0])).not.toBe('—');
  });
});
