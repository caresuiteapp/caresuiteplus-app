import { describe, expect, it } from 'vitest';
import {
  buildAbsenceEvents,
  buildBirthdayEvents,
  buildPublicHolidayEvents,
  mergeOperationalCalendarEvents,
} from '@/lib/calendar/assistCalendarOperationalEvents';
import { eventsForDay } from '@/lib/office/calendarDateUtils';

describe('Assist Kalender – operative Ereignisse', () => {
  it('zeigt eine mehrtägige genehmigte Abwesenheit an jedem betroffenen Tag', () => {
    const events = buildAbsenceEvents([
      {
        id: 'absence-1', tenant_id: 'tenant-1', employee_id: 'employee-1',
        absence_type: 'vacation', status: 'approved',
        starts_at: '2026-08-03T00:00:00.000Z', ends_at: '2026-08-07T00:00:00.000Z',
        all_day: true, requested_days: 5, employee_note: '', internal_note: '',
        created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z',
      },
    ], new Map([['employee-1', 'Kathrin Pott']]));

    expect(events[0]?.title).toBe('Urlaub · Kathrin Pott');
    expect(eventsForDay(events, new Date(2026, 7, 3))).toHaveLength(1);
    expect(eventsForDay(events, new Date(2026, 7, 7))).toHaveLength(1);
    expect(eventsForDay(events, new Date(2026, 7, 8))).toHaveLength(0);
  });

  it('zeigt beantragte Abwesenheiten, blendet aber abgelehnte und stornierte aus', () => {
    const base = {
      tenant_id: 'tenant-1', employee_id: 'employee-1', absence_type: 'other' as const,
      starts_at: '2026-08-10T00:00:00.000Z', ends_at: '2026-08-10T00:00:00.000Z',
      all_day: true, requested_days: 1, employee_note: '', internal_note: '',
      created_at: '2026-07-01T00:00:00.000Z', updated_at: '2026-07-01T00:00:00.000Z',
    };
    const events = buildAbsenceEvents([
      { ...base, id: 'requested', status: 'requested' },
      { ...base, id: 'rejected', status: 'rejected' },
      { ...base, id: 'cancelled', status: 'cancelled' },
    ], new Map([['employee-1', 'Kevin Reinhardt']]));
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toContain('beantragt');
  });

  it('erzeugt Mitarbeitenden- und Klientengeburtstage im sichtbaren Jahr', () => {
    const people = [{ id: 'p1', first_name: 'Iris', last_name: 'Jäger', date_of_birth: '1955-08-18' }];
    const events = buildBirthdayEvents(
      people,
      'client',
      '2026-08-01T00:00:00.000Z',
      '2026-08-31T23:59:59.999Z',
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'geburtstag',
      title: 'Iris Jäger · 71. Geburtstag · Klient:in',
      start: '2026-08-18T00:00:00.000Z',
    });
  });

  it('enthält bundesweite und nordrhein-westfälische Feiertage', () => {
    const events = buildPublicHolidayEvents(
      '2026-10-01T00:00:00.000Z',
      '2026-12-31T23:59:59.999Z',
    );
    expect(events.map((event) => event.title)).toEqual(expect.arrayContaining([
      'Tag der Deutschen Einheit', 'Allerheiligen', '1. Weihnachtstag', '2. Weihnachtstag',
    ]));
    expect(events.every((event) => event.type === 'feiertag' && event.allDay)).toBe(true);
  });

  it('dupliziert bereits synchronisierte Abwesenheiten nicht', () => {
    const base = [{
      id: 'central-1', title: 'Urlaub', start: '2026-08-03T00:00:00.000Z',
      end: '2026-08-03T23:59:59.999Z', type: 'urlaub' as const, color: '#22C55E',
      sourceId: 'absence-1', sourceType: 'absence',
    }];
    const operational = [{
      ...base[0]!, id: 'operational-1', sourceType: 'workforce_absence',
    }];
    expect(mergeOperationalCalendarEvents(base, operational)).toHaveLength(1);
  });
});
