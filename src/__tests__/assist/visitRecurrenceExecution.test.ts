import { describe, expect, it } from 'vitest';
import {
  buildRecurrenceJsonWithMaterializedOccurrence,
  isVirtualRecurringOccurrenceId,
  resetVirtualOccurrenceExecutionState,
  resetVirtualOccurrenceListItem,
  shouldIsolateOccurrenceExecution,
} from '@/lib/assist/visitRecurrenceExecution';
import { buildVisitOccurrenceId } from '@/lib/assist/visitRecurrenceExpansion';
import { expandVisitRowToListItems } from '@/lib/assist/visitRecurrenceExpansion';
import type { VisitDispositionDetail, VisitDispositionListItem } from '@/lib/assist/visitTypes';

const VISIT_ID = 'c8969244-db7e-4f72-9570-3467e2960502';

function baseListItem(overrides: Partial<VisitDispositionListItem> = {}): VisitDispositionListItem {
  return {
    id: VISIT_ID,
    tenantId: 'tenant-1',
    clientId: 'client-1',
    title: 'Entlastungsleistung',
    serviceName: 'Entlastungsleistung §45b SGB XI',
    scheduledStart: '2026-07-03T07:30:00.000Z',
    scheduledEnd: '2026-07-03T09:30:00.000Z',
    durationMinutes: 120,
    status: 'in_bearbeitung',
    assignmentStatus: 'beendet',
    planningStatus: 'confirmed',
    proofStatus: 'pending',
    billingStatus: 'preview',
    location: 'Seydlitzstraße 23',
    clientName: 'Ellen Zacharias',
    employeeId: 'employee-1',
    employeeName: 'Kathrin Pott',
    isAtRisk: false,
    isIncomplete: true,
    updatedAt: '2026-07-03T10:00:00.000Z',
    ...overrides,
  };
}

function baseDetail(overrides: Partial<VisitDispositionDetail> = {}): VisitDispositionDetail {
  return {
    ...baseListItem(),
    clientId: 'client-1',
    employeeId: 'employee-1',
    serviceKey: 'relief',
    assignmentDate: '2026-07-03',
    description: null,
    notes: null,
    employeeNotes: 'Erledigt',
    executionStatus: 'completed',
    documentationStatus: 'complete',
    portalStatus: 'scheduled',
    allowedStatusTransitions: [],
    tasks: [
      { id: 't1', title: 'Einsatz antreten', status: 'done', isRequired: true, notDoneReason: null },
      { id: 't2', title: 'Unterwegs markieren', status: 'done', isRequired: true, notDoneReason: null },
    ],
    budget: null,
    portalReleaseEnabled: true,
    employeePortalVisible: true,
    errorCode: null,
    errorMessage: null,
    onTheWayAt: '2026-07-03T07:00:00.000Z',
    arrivedAt: '2026-07-03T07:15:00.000Z',
    finishedAt: '2026-07-03T09:30:00.000Z',
    actualStartAt: '2026-07-03T07:20:00.000Z',
    actualEndAt: '2026-07-03T09:30:00.000Z',
    createdAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('visitRecurrenceExecution', () => {
  it('erkennt virtuelle Serientermin-IDs', () => {
    expect(isVirtualRecurringOccurrenceId(VISIT_ID)).toBe(false);
    expect(isVirtualRecurringOccurrenceId(buildVisitOccurrenceId(VISIT_ID, '2026-07-10'))).toBe(true);
    expect(shouldIsolateOccurrenceExecution({ itemId: buildVisitOccurrenceId(VISIT_ID, '2026-07-10') })).toBe(
      true,
    );
  });

  it('setzt virtuellen Serientermin auf geplanten Ausgangszustand zurück', () => {
    const occurrenceId = buildVisitOccurrenceId(VISIT_ID, '2026-07-10');
    const reset = resetVirtualOccurrenceExecutionState(
      baseDetail({
        id: occurrenceId,
        scheduledStart: '2026-07-10T07:30:00.000Z',
        scheduledEnd: '2026-07-10T09:30:00.000Z',
      }),
    );

    expect(reset.assignmentStatus).toBe('bestaetigt');
    expect(reset.onTheWayAt).toBeNull();
    expect(reset.actualStartAt).toBeNull();
    expect(reset.tasks.every((task) => task.status === 'open')).toBe(true);
    expect(reset.employeeNotes).toBeNull();
  });

  it('toleriert fehlende Aufgabenliste beim Serientermin-Reset', () => {
    const reset = resetVirtualOccurrenceExecutionState(
      baseDetail({
        id: buildVisitOccurrenceId(VISIT_ID, '2026-07-10'),
        tasks: undefined,
      }),
    );

    expect(reset.tasks).toEqual([]);
    expect(reset.assignmentStatus).toBe('bestaetigt');
  });

  it('setzt Listen-Einträge für virtuelle Termine zurück', () => {
    const reset = resetVirtualOccurrenceListItem(
      baseListItem({
        id: buildVisitOccurrenceId(VISIT_ID, '2026-07-10'),
        scheduledStart: '2026-07-10T07:30:00.000Z',
        scheduledEnd: '2026-07-10T09:30:00.000Z',
      }),
    );

    expect(reset.assignmentStatus).toBe('bestaetigt');
    expect(reset.status).toBe('bestaetigt');
    expect(reset.proofStatus).toBe('none');
    expect(reset.isIncomplete).toBe(false);
  });

  it('speichert materialisierte Termine in recurrence_json', () => {
    const next = buildRecurrenceJsonWithMaterializedOccurrence(
      { pattern: 'weekly', weekdays: ['do'], occurrenceCount: 4 },
      '2026-07-10',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    );

    expect(next.detachedOccurrenceDates).toContain('2026-07-10');
    expect(next.materializedOccurrences?.['2026-07-10']).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  });

  it('filtert abgetrennte Termine aus Serien-Expansion', () => {
    const expanded = expandVisitRowToListItems(
      {
        assignment_date: '2026-07-03',
        planned_start_at: '2026-07-03T07:30:00.000Z',
        planned_end_at: '2026-07-03T09:30:00.000Z',
        recurrence_json: {
          pattern: 'weekly',
          weekdays: ['fr'],
          occurrenceCount: 3,
          detachedOccurrenceDates: ['2026-07-17'],
        },
      },
      baseListItem(),
    );

    expect(expanded.some((item) => item.id === buildVisitOccurrenceId(VISIT_ID, '2026-07-17'))).toBe(false);
    expect(expanded.some((item) => item.id === buildVisitOccurrenceId(VISIT_ID, '2026-07-10'))).toBe(true);
  });
});
