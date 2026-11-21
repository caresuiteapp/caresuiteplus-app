import { describe, expect, it } from 'vitest';
import { nativeNeoSpeechText, normalizeNeoSpeechText, splitNeoSpeech } from '../../ai/robot/neoSpeechText';

describe('Neo pronunciation on Web and native', () => {
  it('reads care abbreviations and paragraph suffixes without changing the written input', () => {
    const text = '§ 45a SGB XI, Abs. 2, z. B. LG1/LG2 und ggf. eine PDF.';
    expect(normalizeNeoSpeechText(text)).toBe('Paragraf 45 a Sozialgesetzbuch elf, Absatz 2, zum Beispiel Leistungsgruppe 1 und Leistungsgruppe 2 und gegebenenfalls eine Pe De Eff.');
    expect(text).toContain('§ 45a SGB XI');
  });
  it.each([
    ['Um 08:00 Uhr, danach 17:05.', 'Um 8 Uhr, danach 17 Uhr 5.'],
    ['32,75 € und 1.234,50 € sowie 0,05 €.', '32 Euro und 75 Cent und 1234 Euro und 50 Cent sowie 0 Euro und 5 Cent.'],
    ['37,05 °C, 98 % und 120 mmHg.', '37 Komma 0 5 Grad Celsius, 98 Prozent und 120 Millimeter Quecksilbersäule.'],
    ['**Hinweis**\nDas gilt z.B. ab heute.\nBitte prüfen!', 'Hinweis. Das gilt zum Beispiel ab heute. Bitte prüfen!'],
  ])('pronounces %s', (text, expected) => {
    expect(normalizeNeoSpeechText(text)).toBe(expected);
    expect(normalizeNeoSpeechText(expected)).toBe(expected);
  });
  it('separates brand words and OS letters for the German device voice', () => {
    expect(nativeNeoSpeechText('CareSuite+ HealthOS und § 45b SGB XI.')).toBe('Care Suite Plus Health O S und Paragraf 45 b Sozialgesetzbuch elf.');
  });
  it('starts a long answer with its first complete sentence', () => {
    const text = 'Ich erkläre dir die Einsatzplanung. ' + 'Du kannst dazu den Kalender öffnen und dort die Verfügbarkeit prüfen. '.repeat(8);
    const parts = splitNeoSpeech(text);
    expect(parts[0]).toBe('Ich erkläre dir die Einsatzplanung.');
    expect(parts.join(' ')).toBe(text.trim());
    expect(parts.every(part => part.length <= 280)).toBe(true);
  });
  it('bounds even very long words and keeps the bundled introduction intact', () => {
    expect(splitNeoSpeech('A'.repeat(1000)).every(part => part.length <= 280)).toBe(true);
    const intro = 'Ich bin Neo, dein kleiner Assistent in deinem CareSuite Health OS.';
    expect(splitNeoSpeech(intro)).toEqual([intro]);
  });
});
