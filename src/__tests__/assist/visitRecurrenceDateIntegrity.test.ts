import { describe, expect, it } from 'vitest';
import { expandVisitRecurrenceDates } from '@/lib/assist/calculateAssistBudgetAllocation';

describe('visit recurrence date integrity', () => {
  it('keeps a one-time visit unchanged', () => {
    expect(
      expandVisitRecurrenceDates({
        assignmentDate: '2026-07-24',
        recurrencePattern: 'none',
      }),
    ).toEqual(['2026-07-24']);
  });

  it('creates daily occurrences as separate calendar dates', () => {
    expect(
      expandVisitRecurrenceDates({
        assignmentDate: '2026-07-24',
        recurrencePattern: 'daily',
        recurrenceOccurrenceCount: 4,
      }),
    ).toEqual(['2026-07-24', '2026-07-25', '2026-07-26', '2026-07-27']);
  });

  it('supports several selected weekdays without inheriting the anchor weekday', () => {
    expect(
      expandVisitRecurrenceDates({
        assignmentDate: '2026-07-24',
        recurrencePattern: 'weekly',
        recurrenceWeekdays: ['mo', 'mi'],
        recurrenceOccurrenceCount: 4,
      }),
    ).toEqual(['2026-07-27', '2026-07-29', '2026-08-03', '2026-08-05']);
  });

  it('anchors biweekly occurrences to alternating seven-day blocks', () => {
    expect(
      expandVisitRecurrenceDates({
        assignmentDate: '2026-07-24',
        recurrencePattern: 'biweekly',
        recurrenceWeekdays: ['mo', 'fr'],
        recurrenceOccurrenceCount: 6,
      }),
    ).toEqual([
      '2026-07-24',
      '2026-07-27',
      '2026-08-07',
      '2026-08-10',
      '2026-08-21',
      '2026-08-24',
    ]);
  });

  it('clamps month-end occurrences and returns to the anchor day', () => {
    expect(
      expandVisitRecurrenceDates({
        assignmentDate: '2026-01-31',
        recurrencePattern: 'monthly',
        recurrenceOccurrenceCount: 4,
      }),
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('includes the configured end date and never crosses it', () => {
    expect(
      expandVisitRecurrenceDates({
        assignmentDate: '2026-07-24',
        recurrencePattern: 'daily',
        recurrenceEndDate: '2026-07-26',
        maxOccurrences: 20,
      }),
    ).toEqual(['2026-07-24', '2026-07-25', '2026-07-26']);
  });
});
