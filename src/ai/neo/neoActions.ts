export type NeoParsedCommand = { kind: 'appointment.create' | 'visit.move'; date: string; time: string; durationMinutes: number | null; title: string; questions: string[] };
const berlin = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });
export function neoBerlinTimestamp(date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw Error('Bitte Datum und Uhrzeit vollständig angeben.');
  const target = `${date}T${time}`, wall = Date.parse(target + ':00Z');
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 10) !== date) throw Error('Das Datum ist ungültig.');
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const candidates = [wall - 3600000, wall - 7200000].filter(value => formatter.format(new Date(value)).replace(' ', 'T') === target);
  if (candidates.length !== 1) throw Error('Diese Berliner Uhrzeit ist wegen der Zeitumstellung nicht eindeutig oder existiert nicht. Bitte eine andere Uhrzeit wählen.');
  return new Date(candidates[0]).toISOString();
}
export function parseNeoAdministrativeCommand(input: string, now = new Date()): NeoParsedCommand {
  const text = input.normalize('NFC').trim();
  if (!text || text.length > 2000) throw Error('Bitte einen kurzen konkreten Arbeitsauftrag eingeben.');
  if (/\b(?:nicht|kein\w*|vielleicht|eventuell|würde|könnte|falls|wenn|oder)\b/i.test(text)) throw Error('Der Auftrag enthält eine Bedingung, Alternative oder Verneinung. Bitte ausdrücklich angeben, was jetzt ausgeführt werden soll.');
  const move = /\b(?:verschiebe|verlege|ändere|umplanen)\b.*\b(?:einsatz|besuch)\b/i.test(text);
  const create = /\b(?:erstelle|lege|plane|trage|termin anlegen)\b.*\btermin\b|\btermin anlegen\b/i.test(text);
  if (!move && !create) throw Error('NEO unterstützt hier „Termin anlegen“ oder „Einsatz verschieben“.');
  if (move && create) throw Error('Bitte pro Auftrag nur einen Termin oder Einsatz bearbeiten.');
  if (/\b(?:serie|alle|folgenden|regelmäßig|wöchentlich)\b/i.test(text)) throw Error('Serienänderungen bitte ausdrücklich in der Einsatzplanung bearbeiten. Dieser Auftrag betrifft einen einzelnen Termin.');
  let date = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1] ?? '';
  const germanDate = text.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/);
  if (!date && germanDate) date = `${germanDate[3]}-${germanDate[2].padStart(2, '0')}-${germanDate[1].padStart(2, '0')}`;
  const today = berlin.format(now), base = new Date(today + 'T12:00:00Z');
  const offset = /(?:^|\s)übermorgen\b/i.test(text) ? 2 : /\bmorgen\b/i.test(text) ? 1 : /\bheute\b/i.test(text) ? 0 : null;
  if (!date && offset !== null) { base.setUTCDate(base.getUTCDate() + offset); date = base.toISOString().slice(0, 10); }
  if (!date) {
    const weekday = text.match(/\b(?:nächsten?|am)\s+(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/i)?.[1]?.toLowerCase();
    if (weekday) { const target = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'].indexOf(weekday); const delta = (target - base.getUTCDay() + 7) % 7 || 7; base.setUTCDate(base.getUTCDate() + delta); date = base.toISOString().slice(0, 10); }
  }
  const clocks = [...text.matchAll(/\bum\s+(\d{1,2})(?::(\d{2}))?(?:\s*Uhr)?(?:\s+(\d{2}))?\b/gi)];
  if (clocks.length > 1) throw Error('Bitte genau eine neue Uhrzeit angeben. Den ursprünglichen Einsatz anschließend auswählen.');
  const clock = clocks[0];
  const time = clock ? `${clock[1].padStart(2, '0')}:${clock[2] ?? clock[3] ?? '00'}` : '';
  const minutes = text.match(/\bfür\s+(\d{1,3})\s*Minuten?\b/i), hours = text.match(/\bfür\s+(\d(?:[,.]\d)?)\s*Stunden?\b/i);
  const durationMinutes = minutes ? Number(minutes[1]) : hours ? Number(hours[1].replace(',', '.')) * 60 : null;
  const title = text.includes(': ') ? text.slice(text.indexOf(': ') + 2).trim() : text.match(/[„"]([^“"]+)[“"]/)?.[1] ?? '';
  const questions = [...(!date ? ['An welchem Datum?'] : []), ...(!time ? ['Um welche Uhrzeit?'] : []), ...(!move && !durationMinutes ? ['Wie lange dauert der Termin?'] : []), ...(!move && !title ? ['Wie soll der Termin heißen?'] : [])];
  if (durationMinutes !== null && (!Number.isSafeInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 720)) throw Error('Bitte eine Dauer zwischen 5 und 720 Minuten wählen.');
  if (date && time) neoBerlinTimestamp(date, time);
  return { kind: move ? 'visit.move' : 'appointment.create', date, time, durationMinutes, title, questions };
}
