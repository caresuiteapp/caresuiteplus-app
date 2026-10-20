import { describe, expect, it } from 'vitest';
import { createNeoReplies, neoDate, neoProfileName, neoTime, NEO_INTRODUCTION, parseNeoCommand } from '../../ai/robot/neoCommands';
import { describeNeoWeather } from '../../ai/robot/neoWeather.web';
import { parseVoiceCommand } from '../../ai/robot/voiceCommands';

describe('Neo conversation', () => {
  it.each([
    ['Hallo', 'greeting'], ['Hallo Neo', 'greeting'], ['Guten Abend', 'greeting'],
    ['Wer bist du?', 'identity'], ['Wie heißt du?', 'identity'], ['Neo, wer bist du?', 'identity'],
    ['Wie spät ist es?', 'time'], ['Wie viel Uhr ist es?', 'time'],
    ['Welcher Tag ist heute?', 'date'], ['Welches Datum haben wir heute?', 'date'],
    ['Wie ist das Wetter?', 'weather'], ['Wie warm ist es draußen?', 'weather'],
    ['Wie wird das Wetter morgen?', 'weatherUnsupported'], ['Wetter in Berlin', 'weatherUnsupported'],
    ['Danke', 'thanks'], ['Wie geht es dir?', 'wellbeing'], ['Tschüss', 'goodbye'],
    ['Wiederhole das', 'repeat'], ['Was kannst du alles?', 'help'],
  ])('understands %s', (text, intent) => expect(parseNeoCommand(text)).toBe(intent));
  it('introduces Neo using the exact requested sentence', () => {
    expect(createNeoReplies()('identity', 'Kevin')).toBe('Ich bin Neo, dein kleiner Assistent in deinem CareSuite Health OS.');
    expect(NEO_INTRODUCTION).toBe(createNeoReplies()('identity', 'Anna'));
  });
  it('uses the current profile and never falls back to an email', () => {
    expect(neoProfileName({ displayName: 'Kevin Reinhardt' })).toBe('Kevin Reinhardt');
    expect(neoProfileName({ firstName: 'Anna', lastName: 'Müller' })).toBe('Anna Müller');
    expect(neoProfileName({ displayName: 'person@example.com' })).toBe('');
    expect(neoProfileName(null, { displayName: 'Mia' })).toBe('Mia');
    expect(createNeoReplies(() => 0)('greeting', 'Mia')).toContain('Hallo Mia');
    expect(createNeoReplies(() => 0)('greeting', '')).toBe('Hallo. Schön, dass du da bist.');
  });
  it('uses device-local date and time at request time', () => {
    expect(neoTime(new Date(2026, 8, 29, 17, 5))).toBe('Es ist siebzehn Uhr fünf.');
    expect(neoTime(new Date(2026, 8, 29, 1, 0))).toBe('Es ist ein Uhr.');
    expect(neoTime(new Date(2026, 8, 29, 0, 0))).toBe('Es ist null Uhr.');
    expect(neoDate(new Date(2026, 8, 29, 12))).toBe('Heute ist Dienstag, der 29. September 2026.');
  });
  it('varies short replies and retains the navigation command rules', () => {
    const reply = createNeoReplies(() => 0);
    expect(reply('thanks', '')).not.toBe(reply('thanks', ''));
    expect(parseVoiceCommand('Neo, öffne bitte den Kalender').kind).toBe('navigate');
    expect(parseVoiceCommand('Hallo Neo, öffne die Akte von Anna Müller')).toEqual({ kind: 'client', name: 'Anna Müller' });
    expect(parseNeoCommand('Lösche die Akte')).toBeNull();
    expect(parseNeoCommand('Hallo und lösche alle Rechnungen')).toBeNull();
  });
});

describe('Neo weather accuracy', () => {
  const now = Date.parse('2026-09-29T15:00:00Z');
  const data = { weather: { source_id: 1, timestamp: '2026-09-29T14:50:00Z', temperature: 18.4, icon: 'cloudy' }, sources: [{ id: 1, distance: 11000 }] };
  it('reads real current values with approximate location and attribution', () => {
    const text = describeNeoWeather(data, now);
    expect(text).toContain('18 Grad, bewölkt'); expect(text).toContain('In deiner Nähe'); expect(text).toContain('Deutschen Wetterdienst');
  });
  it('rejects missing, stale, future, far-away and malformed observations', () => {
    expect(() => describeNeoWeather({}, now)).toThrow();
    expect(() => describeNeoWeather(data, now + 91 * 60_000)).toThrow();
    expect(() => describeNeoWeather({ ...data, weather: { ...data.weather, timestamp: '2026-09-29T16:00:00Z' } }, now)).toThrow();
    expect(() => describeNeoWeather({ ...data, sources: [{ id: 1, distance: 60_000 }] }, now)).toThrow();
    expect(() => describeNeoWeather({ ...data, weather: { ...data.weather, temperature: NaN } }, now)).toThrow();
    expect(() => describeNeoWeather({ ...data, weather: { ...data.weather, temperature: null } }, now)).toThrow();
  });
});
