import { describe, expect, it } from 'vitest';
import { neoBerlinTimestamp, parseNeoAdministrativeCommand } from '@/ai/neo/neoActions';
const now = new Date('2026-11-20T22:30:00Z');
describe('NEO explicit administrative commands', () => {
  it('parses a complete appointment and preserves the explicit duration and title', () => {
    expect(parseNeoAdministrativeCommand('Erstelle einen Termin morgen um 14 Uhr für 30 Minuten: Beratung', now)).toEqual({ kind: 'appointment.create', date: '2026-11-21', time: '14:00', durationMinutes: 30, title: 'Beratung', questions: [] });
  });
  it('resolves übermorgen, German dates, decimal hours and Berlin date boundaries', () => {
    expect(parseNeoAdministrativeCommand('Plane Termin übermorgen um 9:15 für 1,5 Stunden: Gespräch', now)).toMatchObject({ date: '2026-11-22', time: '09:15', durationMinutes: 90 });
    expect(parseNeoAdministrativeCommand('Termin anlegen am 24.11.2026 um 14 Uhr 30 für 30 Minuten: Gespräch', now)).toMatchObject({ date: '2026-11-24', time: '14:30' });
    expect(parseNeoAdministrativeCommand('Plane Termin heute um 14 für 30 Minuten: Besuch', new Date('2026-11-20T23:30:00Z')).date).toBe('2026-11-21');
  });
  it('does not guess a title, duration, date or time', () => {
    expect(parseNeoAdministrativeCommand('Erstelle einen Termin', now).questions).toHaveLength(4);
    expect(parseNeoAdministrativeCommand('Verschiebe den Einsatz morgen um 15 Uhr', now)).toMatchObject({ kind: 'visit.move', date: '2026-11-21', time: '15:00', durationMinutes: null, questions: [] });
  });
  it.each(['Erstelle keinen Termin morgen um 14 Uhr', 'Verschiebe alle Einsätze morgen um 14 Uhr', 'Falls Zeit ist, erstelle einen Termin', 'Erstelle einen Termin morgen um 14 oder um 15 Uhr', 'Erstelle Termin und verschiebe Einsatz morgen um 14 Uhr', 'Verschiebe Einsatz morgen um 14 Uhr um 15 Uhr'])('refuses ambiguous or conditional action: %s', command => { expect(() => parseNeoAdministrativeCommand(command, now)).toThrow(); });
  it.each([['2026-03-29', '02:30'], ['2026-10-25', '02:30'], ['2026-02-30', '14:00'], ['2026-11-21', '25:00']])('rejects invalid or ambiguous Berlin wall time %s %s', (date, time) => { expect(() => neoBerlinTimestamp(date, time)).toThrow(); });
  it('handles summer and winter offsets independently of the machine timezone', () => {
    expect(neoBerlinTimestamp('2026-07-21', '14:00')).toBe('2026-07-21T12:00:00.000Z');
    expect(neoBerlinTimestamp('2026-11-21', '14:00')).toBe('2026-11-21T13:00:00.000Z');
  });
});
