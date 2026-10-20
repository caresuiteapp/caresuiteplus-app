import { describe, expect, it } from 'vitest';
import {
  parseGermanDate,
  parseGermanOrIsoDateInput,
  parseGermanOrIsoDateInputToIso,
  parseWfmAbsenceDateRange,
} from '@/lib/formatters/dateTimeFormatters';

describe('parseGermanOrIsoDateInput', () => {
  it('parst YYYY-MM-DD als lokaler Tagesanfang', () => {
    const date = parseGermanOrIsoDateInput('2026-07-01', { timeOfDay: 'start' });
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2026);
    expect(date!.getMonth()).toBe(6);
    expect(date!.getDate()).toBe(1);
    expect(date!.getHours()).toBe(0);
  });

  it('parst DD.MM.YYYY (15.08.2026 — zuvor Invalid Date in new Date)', () => {
    const date = parseGermanOrIsoDateInput('15.08.2026', { timeOfDay: 'start' });
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2026);
    expect(date!.getMonth()).toBe(7);
    expect(date!.getDate()).toBe(15);
  });

  it('parst DD.MM.YYYY HH:mm', () => {
    const date = parseGermanOrIsoDateInput('15.08.2026 09:30');
    expect(date).not.toBeNull();
    expect(date!.getHours()).toBe(9);
    expect(date!.getMinutes()).toBe(30);
  });

  it('parst DD.MM.YYYY, HH:mm', () => {
    const date = parseGermanOrIsoDateInput('15.08.2026, 14:00');
    expect(date).not.toBeNull();
    expect(date!.getHours()).toBe(14);
    expect(date!.getMinutes()).toBe(0);
  });

  it('parst YYYY-MM-DDTHH:mm', () => {
    const date = parseGermanOrIsoDateInput('2026-07-01T08:15');
    expect(date).not.toBeNull();
    expect(date!.getHours()).toBe(8);
    expect(date!.getMinutes()).toBe(15);
  });

  it('akzeptiert Date-Objekte und setzt Tagesende', () => {
    const input = new Date(2026, 6, 5, 12, 0, 0);
    const date = parseGermanOrIsoDateInput(input, { timeOfDay: 'end' });
    expect(date).not.toBeNull();
    expect(date!.getHours()).toBe(23);
    expect(date!.getMinutes()).toBe(59);
    expect(date!.getSeconds()).toBe(59);
  });

  it('gibt null für ungültige Eingaben zurück', () => {
    expect(parseGermanOrIsoDateInput('')).toBeNull();
    expect(parseGermanOrIsoDateInput('kein-datum')).toBeNull();
    expect(parseGermanOrIsoDateInput(new Date('invalid'))).toBeNull();
  });

  it('parseGermanOrIsoDateInputToIso wirft nicht bei ungültiger Eingabe', () => {
    const iso = parseGermanOrIsoDateInputToIso('15.08.2026');
    expect(iso).not.toBeNull();
    const date = new Date(iso!);
    expect(date.getDate()).toBe(15);
    expect(date.getMonth()).toBe(7);
    expect(parseGermanOrIsoDateInputToIso('32.13.2026')).toBeNull();
  });

  it('parseGermanDate bleibt kompatibel', () => {
    expect(parseGermanDate('01.07.2026')).toBe('2026-07-01');
    expect(parseGermanDate('2026-07-01')).toBe('2026-07-01');
  });
});

describe('parseWfmAbsenceDateRange', () => {
  it('liefert host-zeitzonenunabhängige Tagesgrenzen', () => {
    const result = parseWfmAbsenceDateRange('15.08.2026', '16.08.2026');
    expect(result).toEqual({
      ok: true,
      startsAt: '2026-08-15T00:00:00.000Z',
      endsAt: '2026-08-16T23:59:59.999Z',
    });
  });

  it('parst deutschen Zeitraum korrekt (15.08.2026)', () => {
    const result = parseWfmAbsenceDateRange('15.08.2026', '15.08.2026');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const start = new Date(result.startsAt);
    const end = new Date(result.endsAt);
    expect(start.getUTCFullYear()).toBe(2026);
    expect(start.getUTCMonth()).toBe(7);
    expect(start.getUTCDate()).toBe(15);
    expect(start.getUTCHours()).toBe(0);
    expect(end.getUTCFullYear()).toBe(2026);
    expect(end.getUTCMonth()).toBe(7);
    expect(end.getUTCDate()).toBe(15);
    expect(end.getUTCHours()).toBe(23);
  });

  it('lehnt Enddatum vor Startdatum ab', () => {
    const result = parseWfmAbsenceDateRange('20.08.2026', '15.08.2026');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('Bitte prüfen Sie das Datum.');
  });

  it('lehnt ungültige Eingaben mit Nutzerhinweis ab', () => {
    const result = parseWfmAbsenceDateRange('abc', '15.08.2026');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('Bitte prüfen Sie das Datum.');
  });
});
