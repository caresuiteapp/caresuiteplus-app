import { describe, expect, it } from 'vitest';
import {
  mergeExpandedAssistVisitCalendarEvents,
  visitListItemToCalendarEvent,
} from '@/lib/calendar/assistVisitCalendarRecurrence';
import { buildVisitOccurrenceId } from '@/lib/assist/visitRecurrenceExpansion';
import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';
import type { CalendarEvent } from '@/types/modules/calendarEvent';

const VISIT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function baseListItem(overrides: Partial<VisitDispositionListItem> = {}): VisitDispositionListItem {
  return {
    id: VISIT_ID,
    tenantId: 'tenant-1',
    clientId: 'client-1',
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

function masterCalendarEvent(): CalendarEvent {
  return {
    id: 'cal-1',
    title: 'Alltagsbegleitung',
    start: '2026-07-07T07:00:00.000Z',
    end: '2026-07-07T09:00:00.000Z',
    type: 'einsatz',
    color: '#FFB020',
    sourceId: VISIT_ID,
    sourceType: 'assist_visit',
    moduleKey: 'assist',
  };
}

describe('assistVisitCalendarRecurrence', () => {
  it('mappt Visit-Listeneintrag auf Kalenderereignis', () => {
    const event = visitListItemToCalendarEvent(baseListItem());
    expect(event.sourceId).toBe(VISIT_ID);
    expect(event.type).toBe('einsatz');
    expect(event.start).toBe('2026-07-07T07:00:00.000Z');
  });

  it('ersetzt Master-Einsatz durch expandierte Serientermine', () => {
    const expanded = [
      baseListItem(),
      baseListItem({
        id: buildVisitOccurrenceId(VISIT_ID, '2026-07-14'),
        scheduledStart: '2026-07-14T07:00:00.000Z',
        scheduledEnd: '2026-07-14T09:00:00.000Z',
      }),
      baseListItem({
        id: buildVisitOccurrenceId(VISIT_ID, '2026-07-21'),
        scheduledStart: '2026-07-21T07:00:00.000Z',
        scheduledEnd: '2026-07-21T09:00:00.000Z',
      }),
    ];

    const merged = mergeExpandedAssistVisitCalendarEvents([masterCalendarEvent()], expanded);

    expect(merged).toHaveLength(3);
    expect(merged.some((event) => event.sourceId === VISIT_ID)).toBe(true);
    expect(merged.some((event) => event.sourceId === buildVisitOccurrenceId(VISIT_ID, '2026-07-14'))).toBe(
      true,
    );
    expect(merged.filter((event) => event.sourceId === VISIT_ID)).toHaveLength(1);
  });

  it('lässt einmalige Kalenderereignisse unverändert', () => {
    const single = baseListItem({
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      scheduledStart: '2026-08-01T07:00:00.000Z',
      scheduledEnd: '2026-08-01T09:00:00.000Z',
    });
    const event: CalendarEvent = {
      ...masterCalendarEvent(),
      id: 'cal-2',
      sourceId: single.id,
      start: single.scheduledStart,
      end: single.scheduledEnd,
    };

    const merged = mergeExpandedAssistVisitCalendarEvents([event], [single]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.sourceId).toBe(single.id);
  });
});
