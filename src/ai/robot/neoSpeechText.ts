/** Speech-only text. Written answers, names and navigation targets stay intact. */
export function normalizeNeoSpeechText(input: string): string {
  return input.normalize('NFC')
    .replace(/\u00a0|\u202f/g, ' ')
    .replace(/\[([^\]]+)\]\([^\n)]+\)/g, '$1')
    .replace(/^\s*(?:#{1,6}\s+|[-*•]\s+)/gm, '')
    .replace(/[*_`]|[„“”«»]/g, '')
    .replace(/\bz\s*\.\s*B\./gi, 'zum Beispiel')
    .replace(/\bd\s*\.\s*h\./gi, 'das heißt')
    .replace(/\bu\s*\.\s*a\./gi, 'unter anderem')
    .replace(/\bggf\./gi, 'gegebenenfalls')
    .replace(/\bbzw\./gi, 'beziehungsweise')
    .replace(/\binkl\./gi, 'inklusive')
    .replace(/\bzzgl\./gi, 'zuzüglich')
    .replace(/\bca\./gi, 'circa')
    .replace(/\bAbs\./g, 'Absatz')
    .replace(/\bNr\./g, 'Nummer')
    .replace(/§§\s*/g, 'Paragrafen ')
    .replace(/§\s*/g, 'Paragraf ')
    .replace(/\b(\d+)([a-z])\b/gi, '$1 $2')
    .replace(/\bSGB\s+(XII|XI|IX|VIII|VII|VI|IV|V|III|II|X|I)\b/g, (_match, roman: string) => {
      const books: Record<string, string> = { I: 'eins', II: 'zwei', III: 'drei', IV: 'vier', V: 'fünf', VI: 'sechs', VII: 'sieben', VIII: 'acht', IX: 'neun', X: 'zehn', XI: 'elf', XII: 'zwölf' };
      return `Sozialgesetzbuch ${books[roman]}`;
    })
    .replace(/\bLG\s*([12])\b/g, 'Leistungsgruppe $1')
    .replace(/\b(\d{1,2}):(\d{2})(?:\s*Uhr)?\b/g, (match, hours: string, minutes: string) => {
      if (Number(hours) > 23 || Number(minutes) > 59) return match;
      return `${Number(hours)} Uhr${Number(minutes) ? ` ${Number(minutes)}` : ''}`;
    })
    .replace(/\b(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*€/g, (_match, euros: string, cents?: string) => {
      const amount = euros.replace(/\./g, '');
      const fraction = Number((cents ?? '').padEnd(2, '0'));
      return `${amount} Euro${fraction ? ` und ${fraction} Cent` : ''}`;
    })
    .replace(/\b(\d+),(\d+)\b/g, (_match, whole: string, fraction: string) => `${whole} Komma ${fraction.split('').join(' ')}`)
    .replace(/°\s*C\b/g, ' Grad Celsius')
    .replace(/\bmmHg\b/g, 'Millimeter Quecksilbersäule')
    .replace(/\bmg\s*\/\s*dl\b/gi, 'Milligramm pro Deziliter')
    .replace(/\bmmol\s*\/\s*l\b/gi, 'Millimol pro Liter')
    .replace(/\bkm\s*\/\s*h\b/gi, 'Kilometer pro Stunde')
    .replace(/%/g, ' Prozent')
    .replace(/\bPDF\b/g, 'Pe De Eff')
    .replace(/\bQR(?:[- ]Code)?\b/gi, 'Ku Er Code')
    .replace(/\s*[/]\s*/g, ' und ')
    .replace(/([^.!?:;\s])\s*\n+/g, '$1. ')
    .replace(/\s+/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim();
}

/** Start with a short sentence; later chunks can render during playback. */
export function splitNeoSpeech(input: string): string[] {
  let remaining = normalizeNeoSpeechText(input);
  const parts: string[] = [];
  while (remaining) {
    const limit = parts.length ? 280 : 160;
    if (remaining.length <= limit) { parts.push(remaining); break; }
    const prefix = remaining.slice(0, limit + 1);
    const ends = [...prefix.matchAll(/[.!?](?=\s)/g)].filter(match => match.index! >= 24 && !/\d/.test(prefix[match.index! - 1]));
    const sentenceEnd = ends[0]?.index;
    const clauseEnd = Math.max(prefix.lastIndexOf(', '), prefix.lastIndexOf('; '), prefix.lastIndexOf(': '));
    const cut = sentenceEnd !== undefined ? sentenceEnd + 1 : clauseEnd >= 60 ? clauseEnd + 1 : Math.max(1, prefix.lastIndexOf(' ') > 0 ? prefix.lastIndexOf(' ') : limit);
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  return parts;
}

/** Native German voices do not support the worker's English phoneme segments. */
export function nativeNeoSpeechText(input: string): string {
  return normalizeNeoSpeechText(input)
    .replace(/\bCare\s*Suite\b/gi, 'Care Suite')
    .replace(/\+/g, ' Plus ')
    .replace(/\bHealth\s*OS\b/gi, 'Health O S')
    .replace(/\s+/g, ' ').trim();
}
