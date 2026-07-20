import { describe, expect, it } from 'vitest';
import { expandVisitRecurrenceDates } from '@/lib/assist/calculateAssistBudgetAllocation';
import {
  applyOccurrenceDateToVisitDetail,
  buildVisitOccurrenceId,
  dedupeVisitDispositionListItems,
  expandVisitDispositionListItems,
  expandVisitRowToListItems,
  filterVisitListItemsByDateRange,
  isResolvableVisitId,
  parseVisitOccurrenceId,
  parseVisitRecurrenceJson,
  resolveVisitMasterId,
  shiftVisitScheduleToDate,
} from '@/lib/assist/visitRecurrenceExpansion';
import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';

const VISIT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function baseListItem(overrides: Partial<VisitDispositionListItem> = {}): VisitDispositionListItem {
  return {
    id: VISIT_ID,
    tenantId: 'tenant-1',
    title: 'Alltagsbegleitung',
    serviceName: 'Alltagsbegleitung',
    scheduledStart: '2026-07-07T07:00:00.000Z',
    scheduledEnd: '2026-07-07T09:00:00.000Z',
    durationMinutes: 120,
    status: 'aktiv',
    planningStatus: 'scheduled',
    proofStatus: 'none',
    billingStatus: 'preview',
    location: 'Musterstraße 1',
    clientName: 'Frau Müller',
    employeeId: 'employee-1',
    employeeName: 'Anna Pflege',
    isAtRisk: false,
    isIncomplete: false,
    updatedAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('visitRecurrenceExpansion', () => {
  it('parst Serien-IDs mit Datumssuffix', () => {
    const occurrenceId = buildVisitOccurrenceId(VISIT_ID, '2026-07-14');
    expect(parseVisitOccurrenceId(occurrenceId)).toEqual({
      visitId: VISIT_ID,
      occurrenceDate: '2026-07-14',
    });
    expect(resolveVisitMasterId(occurrenceId)).toBe(VISIT_ID);
    expect(isResolvableVisitId(occurrenceId)).toBe(true);
  });

  it('ignoriert ungültige Serien-IDs', () => {
    expect(parseVisitOccurrenceId(`${VISIT_ID}::invalid`)).toEqual({
      visitId: `${VISIT_ID}::invalid`,
      occurrenceDate: null,
    });
    expect(isResolvableVisitId(`${VISIT_ID}::invalid`)).toBe(false);
  });

  it('parst recurrence_json', () => {
    expect(parseVisitRecurrenceJson({ pattern: 'none' })).toEqual({ pattern: 'none' });
    expect(parseVisitRecurrenceJson({ pattern: 'weekly', weekdays: ['mo', 'we'], occurrenceCount: 4 })).toEqual({
      pattern: 'weekly',
      weekdays: ['mo', 'we'],
      endDate: null,
      occurrenceCount: 4,
    });
  });

  it('verschiebt Start- und Endzeit auf Wiederholungstermin', () => {
    const shifted = shiftVisitScheduleToDate(
      '2026-07-07T07:00:00.000Z',
      '2026-07-07T09:00:00.000Z',
      '2026-07-14',
    );
    expect(shifted.scheduledStart.slice(0, 10)).toBe('2026-07-14');
    expect(shifted.scheduledEnd.slice(0, 10)).toBe('2026-07-14');
    expect(
      new Date(shifted.scheduledEnd).getTime() - new Date(shifted.scheduledStart).getTime(),
    ).toBe(2 * 60 * 60 * 1000);
  });

  it('expandiert wöchentliche Serien in einzelne Listeneinträge', () => {
    const assignmentDate = '2026-07-06';
    const dates = expandVisitRecurrenceDates({
      assignmentDate,
      recurrencePattern: 'weekly',
      recurrenceWeekdays: ['mo'],
      recurrenceOccurrenceCount: 3,
    });
    const item = baseListItem({
      scheduledStart: `${assignmentDate}T07:00:00.000Z`,
      scheduledEnd: `${assignmentDate}T09:00:00.000Z`,
    });
    const expanded = expandVisitRowToListItems(
      {
        assignment_date: assignmentDate,
        planned_start_at: item.scheduledStart,
        planned_end_at: item.scheduledEnd,
        recurrence_json: {
          pattern: 'weekly',
          weekdays: ['mo'],
          occurrenceCount: 3,
        },
      },
      item,
    );

    expect(expanded).toHaveLength(3);
    expect(expanded[0]?.id).toBe(VISIT_ID);
    expect(expanded[1]?.id).toBe(buildVisitOccurrenceId(VISIT_ID, dates[1]!));
    expect(expanded[2]?.id).toBe(buildVisitOccurrenceId(VISIT_ID, dates[2]!));
    expect(expanded.map((entry) => entry.scheduledStart.slice(0, 10))).toEqual(dates);
  });

  it('lässt einmalige Einsätze unverändert', () => {
    const item = baseListItem();
    const expanded = expandVisitRowToListItems(
      {
        assignment_date: '2026-07-07',
        planned_start_at: item.scheduledStart,
        planned_end_at: item.scheduledEnd,
        recurrence_json: { pattern: 'none' },
      },
      item,
    );

    expect(expanded).toEqual([item]);
  });

  it('sortiert expandierte Listeneinträge nach Termin', () => {
    const seriesDate = '2026-07-06';
    const seriesDates = expandVisitRecurrenceDates({
      assignmentDate: seriesDate,
      recurrencePattern: 'weekly',
      recurrenceWeekdays: ['mo'],
      recurrenceOccurrenceCount: 2,
    });
    const later = baseListItem({
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      scheduledStart: '2026-08-01T07:00:00.000Z',
      scheduledEnd: '2026-08-01T09:00:00.000Z',
    });
    const series = baseListItem({
      scheduledStart: `${seriesDate}T07:00:00.000Z`,
      scheduledEnd: `${seriesDate}T09:00:00.000Z`,
    });

    const expanded = expandVisitDispositionListItems([
      {
        row: {
          assignment_date: seriesDate,
          planned_start_at: series.scheduledStart,
          planned_end_at: series.scheduledEnd,
          recurrence_json: { pattern: 'weekly', weekdays: ['mo'], occurrenceCount: 2 },
        },
        item: series,
      },
      {
        row: {
          assignment_date: '2026-08-01',
          planned_start_at: later.scheduledStart,
          planned_end_at: later.scheduledEnd,
          recurrence_json: { pattern: 'none' },
        },
        item: later,
      },
    ]);

    expect(expanded).toHaveLength(3);
    expect(expanded[0]?.scheduledStart.slice(0, 10)).toBe(seriesDates[0]);
    expect(expanded[1]?.scheduledStart.slice(0, 10)).toBe(seriesDates[1]);
    expect(expanded[2]?.scheduledStart.slice(0, 10)).toBe('2026-08-01');
  });

  it('zeigt denselben materialisierten Serientermin nur einmal', () => {
    const duplicateStart = '2026-07-21T07:50:00.000Z';
    const duplicateEnd = '2026-07-21T09:50:00.000Z';
    const duplicates = Array.from({ length: 6 }, (_, index) =>
      baseListItem({
        id: `00000000-0000-4000-8000-00000000000${index}`,
        scheduledStart: duplicateStart,
        scheduledEnd: duplicateEnd,
        clientName: 'Doris Niemeyer',
        employeeName: 'Kathrin Pott',
        assignmentStatus: 'geplant',
        executionStatus: 'pending',
      }),
    );

    expect(dedupeVisitDispositionListItems(duplicates)).toHaveLength(1);
  });

  it('bevorzugt den beendeten Einsatz vor einer geplanten Serienkopie', () => {
    const shared = {
      scheduledStart: '2026-07-23T07:00:00.000Z',
      scheduledEnd: '2026-07-23T09:00:00.000Z',
      clientName: 'Gerd Ingo Peine',
      employeeName: 'Kathrin Pott',
    };
    const planned = baseListItem({
      ...shared,
      id: '00000000-0000-4000-8000-000000000001',
      assignmentStatus: 'geplant',
      executionStatus: 'pending',
    });
    const completed = baseListItem({
      ...shared,
      id: '00000000-0000-4000-8000-000000000002',
      assignmentStatus: 'bestaetigt',
      executionStatus: 'completed',
      actualEndAt: '2026-07-23T09:01:00.000Z',
    });

    expect(dedupeVisitDispositionListItems([planned, completed])).toEqual([completed]);
  });

  it('erzeugt einen gelöschten abgetrennten Serientermin nicht erneut', () => {
    const childId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const series = baseListItem({
      scheduledStart: '2026-07-03T07:00:00.000Z',
      scheduledEnd: '2026-07-03T09:00:00.000Z',
    });
    const expanded = expandVisitDispositionListItems([
      {
        row: {
          assignment_date: '2026-07-03',
          planned_start_at: series.scheduledStart,
          planned_end_at: series.scheduledEnd,
          recurrence_json: {
            pattern: 'weekly',
            weekdays: ['fr'],
            occurrenceCount: 3,
            detachedOccurrenceDates: ['2026-07-10'],
            materializedOccurrences: { '2026-07-10': childId },
          },
        },
        item: series,
      },
    ]);

    expect(expanded.some((item) => item.id === buildVisitOccurrenceId(VISIT_ID, '2026-07-10'))).toBe(false);
  });

  it('unterdrückt Serienkopie, wenn der abgetrennte Einzeleinsatz geladen ist', () => {
    const childId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const series = baseListItem({
      scheduledStart: '2026-07-03T07:00:00.000Z',
      scheduledEnd: '2026-07-03T09:00:00.000Z',
    });
    const child = baseListItem({
      id: childId,
      scheduledStart: '2026-07-10T07:00:00.000Z',
      scheduledEnd: '2026-07-10T09:00:00.000Z',
    });
    const expanded = expandVisitDispositionListItems([
      {
        row: {
          assignment_date: '2026-07-03',
          planned_start_at: series.scheduledStart,
          planned_end_at: series.scheduledEnd,
          recurrence_json: {
            pattern: 'weekly',
            weekdays: ['fr'],
            occurrenceCount: 3,
            detachedOccurrenceDates: ['2026-07-10'],
            materializedOccurrences: { '2026-07-10': childId },
          },
        },
        item: series,
      },
      {
        row: {
          assignment_date: '2026-07-10',
          planned_start_at: child.scheduledStart,
          planned_end_at: child.scheduledEnd,
          recurrence_json: { pattern: 'none' },
        },
        item: child,
      },
    ]);

    expect(expanded.filter((item) => item.scheduledStart.slice(0, 10) === '2026-07-10')).toHaveLength(1);
    expect(expanded.some((item) => item.id === childId)).toBe(true);
  });

  it('filtert expandierte Termine auf sichtbaren Datumsbereich', () => {
    const assignmentDate = '2026-07-06';
    const item = baseListItem({
      scheduledStart: `${assignmentDate}T07:00:00.000Z`,
      scheduledEnd: `${assignmentDate}T09:00:00.000Z`,
    });
    const expanded = expandVisitRowToListItems(
      {
        assignment_date: assignmentDate,
        planned_start_at: item.scheduledStart,
        planned_end_at: item.scheduledEnd,
        recurrence_json: { pattern: 'weekly', weekdays: ['mo'], occurrenceCount: 4 },
      },
      item,
      { dateFrom: '2026-07-13T00:00:00.000Z', dateTo: '2026-07-31T23:59:59.999Z' },
    );

    expect(expanded.length).toBeGreaterThan(0);
    expect(expanded.every((entry) => entry.scheduledStart >= '2026-07-13')).toBe(true);
    expect(expanded.every((entry) => entry.scheduledStart <= '2026-07-31T23:59:59.999Z')).toBe(true);
  });

  it('filterVisitListItemsByDateRange schneidet außerhalb liegende Termine', () => {
    const items = [
      baseListItem({ scheduledStart: '2026-07-07T07:00:00.000Z' }),
      baseListItem({
        id: buildVisitOccurrenceId(VISIT_ID, '2026-07-14'),
        scheduledStart: '2026-07-14T07:00:00.000Z',
      }),
    ];

    const filtered = filterVisitListItemsByDateRange(
      items,
      '2026-07-10T00:00:00.000Z',
      '2026-07-20T23:59:59.999Z',
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.scheduledStart.slice(0, 10)).toBe('2026-07-14');
  });

  it('passt Detailansicht für Serientermin an', () => {
    const detail = {
      ...baseListItem(),
      clientId: 'client-1',
      employeeId: 'employee-1',
      serviceKey: 'alltag',
      description: null,
      notes: null,
      employeeNotes: null,
      executionStatus: 'pending' as const,
      documentationStatus: 'none' as const,
      portalStatus: 'hidden' as const,
      assignmentStatus: 'geplant' as const,
      allowedStatusTransitions: [],
      tasks: [],
      budget: null,
      portalReleaseEnabled: false,
      employeePortalVisible: true,
      errorCode: null,
      errorMessage: null,
      onTheWayAt: null,
      arrivedAt: null,
      finishedAt: null,
      actualStartAt: null,
      actualEndAt: null,
      createdAt: '2026-07-01T10:00:00.000Z',
    };

    const occurrenceId = buildVisitOccurrenceId(VISIT_ID, '2026-07-14');
    const adjusted = applyOccurrenceDateToVisitDetail(detail, '2026-07-14', occurrenceId);

    expect(adjusted.id).toBe(occurrenceId);
    expect(adjusted.scheduledStart.slice(0, 10)).toBe('2026-07-14');
    expect(adjusted.scheduledEnd.slice(0, 10)).toBe('2026-07-14');
  });
});
