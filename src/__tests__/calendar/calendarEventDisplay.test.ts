import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '@/types/modules/calendarEvent';
import {
  enrichCalendarEventWithAssignment,
  formatCalendarEventCompactLabel,
  parseLegacyAssignmentTitle,
  resolveCalendarEventDisplay,
} from '@/lib/calendar/calendarEventDisplay';

const assignmentEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'evt-1',
  title: 'Regelmäßige Alltagsbegleitung',
  start: '2026-06-26T07:30:00.000Z',
  end: '2026-06-26T09:30:00.000Z',
  type: 'einsatz',
  color: '#FFB020',
  sourceId: 'visit-1',
  sourceType: 'assist_visit',
  moduleKey: 'assist',
  ...overrides,
});

describe('calendarEventDisplay', () => {
  it('parses legacy service · client titles', () => {
    expect(parseLegacyAssignmentTitle('Alltagsbegleitung · Ellen Zacharias')).toEqual({
      serviceTitle: 'Alltagsbegleitung',
      clientName: 'Ellen Zacharias',
    });
  });

  it('renders stacked assignment display with client, time and employee', () => {
    const display = resolveCalendarEventDisplay(
      assignmentEvent({
        clientName: 'Ellen Zacharias',
        employeeName: 'Kathrin Pott',
        serviceTitle: 'Regelmäßige Alltagsbegleitung',
      }),
    );

    expect(display.primaryLine).toBe('Ellen Zacharias');
    expect(display.employeeName).toBe('Kathrin Pott');
    expect(display.serviceTitle).toBe('Regelmäßige Alltagsbegleitung');
    expect(display.timeRange).toMatch(/ – /);
  });

  it('builds compact assignment label', () => {
    const label = formatCalendarEventCompactLabel(
      assignmentEvent({
        clientName: 'Ellen Zacharias',
        employeeName: 'Kathrin Pott',
      }),
    );

    expect(label).toContain('Ellen Zacharias');
    expect(label).toContain('Kathrin Pott');
    expect(label).toMatch(/ – /);
  });

  it('enriches assignment events from assignment list data', () => {
    const enriched = enrichCalendarEventWithAssignment(assignmentEvent(), {
      clientName: 'Ellen Zacharias',
      employeeName: 'Kathrin Pott',
      title: 'Regelmäßige Alltagsbegleitung',
      serviceName: 'Regelmäßige Alltagsbegleitung',
    });

    expect(enriched.clientName).toBe('Ellen Zacharias');
    expect(enriched.employeeName).toBe('Kathrin Pott');
    expect(enriched.serviceTitle).toBe('Regelmäßige Alltagsbegleitung');
  });
});
