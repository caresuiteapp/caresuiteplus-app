import type { PlanningDraft } from './employeeMonthPlanning';

export type PlanInterpretation = 'availability' | 'external' | 'mixed';
export type PlanTextOptions = { month: string; employer: string; interpretation: PlanInterpretation; employeeName?: string };
export type PlanTextResult = {
  personName: string | null; documentMonth: string | null; warnings: string[];
  rows: PlanningDraft[]; unrecognized: string[];
};
const MONTHS = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
const WEEKDAYS = '(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|mo|di|mi|do|fr|sa|so)';
const DATE = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\s*\.\s*\d{1,2}\s*\.(?:\s*\d{4}|\s*\d{2}(?!\d|:))?)/g;
const CLOCK = '(?:[01]?\\d|2[0-4])(?::[0-5]\\d|\\.[0-5]\\d)?';
const RANGE = new RegExp(`(?<![\\d:.,])(${CLOCK})\\s*(?:Uhr\\s*)?(?:-|–|—|bis)\\s*(${CLOCK})(?:\\s*Uhr)?(?![\\d:.,])`, 'gi');
const PART = new RegExp(`\\b(ab|von|bis)\\s+(${CLOCK})(?:\\s*Uhr)?(?![\\d:.,])`, 'gi');
const TIMED = /\b(?:[01]?\d|2[0-4])[:.][0-5]\d\b/g;
const pad = (n: number | string) => String(n).padStart(2, '0');
const norm = (s: string) => s.toLocaleLowerCase('de-DE').normalize('NFKC').replace(/\s+/g, ' ').trim();
const clock = (s: string) => { const [h, m = '00'] = s.replace('.', ':').split(':'); return `${pad(h)}:${m}`; };
function dateValue(raw: string, month: string): string {
  if (/^\d{4}-/.test(raw)) return raw;
  const [day, mon, year] = raw.replace(/\s/g, '').split('.');
  return `${year ? (year.length === 2 ? `20${year}` : year) : month.slice(0, 4)}-${pad(mon)}-${pad(day)}`;
}
function validDate(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
function nextDate(date: string) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
function kindFor(text: string, options: PlanTextOptions): { kind: 'available' | 'blocked'; requiresClassification: boolean } {
  const t = norm(text);
  if (/\b(urlaub|krank|abwesend|gesperrt|wunsch[ -]?frei|nicht verfügbar|nicht verfuegbar|nicht planbar|keine zeit|fremdjob|fremddienst|anderer arbeitgeber)\b/.test(t)) return { kind: 'blocked', requiresClassification: false };
  // "Frei" at another employer is not a promise to work for CareSuite.
  if (/\b(frei|dienstfrei|arbeitsfrei)\b/.test(t) && !/\b(verfügbar|verfuegbar|einsatzbereit)\b/.test(t)) return { kind: 'blocked', requiresClassification: true };
  if (options.interpretation === 'external') return { kind: 'blocked', requiresClassification: false };
  if (options.interpretation === 'availability') return { kind: 'available', requiresClassification: false };
  const own = norm(options.employer);
  const words = ` ${t.split(/[^\p{L}\p{N}]+/u).join(' ')} `;
  if (own && words.includes(` ${own.split(/[^\p{L}\p{N}]+/u).join(' ')} `)) return { kind: 'available', requiresClassification: false };
  if (/\b(fremdjob|fremddienst|anderer arbeitgeber|träger|traeger)\b/.test(t)) return { kind: 'blocked', requiresClassification: false };
  return { kind: 'blocked', requiresClassification: true };
}

/** Deterministic extraction, never infers availability outside an explicitly stated interval. */
export function parseEmployeePlanText(raw: string, options: PlanTextOptions): PlanTextResult {
  if (raw.length > 100_000) throw new Error('Zu viel Text. Bitte einen einzelnen Monatsplan verwenden (höchstens 100.000 Zeichen).');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(options.month)) throw new Error('Bitte einen gültigen Zielmonat wählen.');
  const text = raw.normalize('NFKC').replace(/\u00ad/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\r/g, '');
  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
  const warnings = new Set<string>();
  const unrecognized: string[] = [];
  const rows: PlanningDraft[] = [];
  const monthMatch = norm(text).match(new RegExp(`\\b(${MONTHS.join('|')}|maerz)\\s+(20\\d{2})\\b`));
  const explicitDates = [...text.matchAll(DATE)].map((m) => m[0]).filter((s) => /^\d{4}-/.test(s) || /\.\s*\d{4}$/.test(s));
  const explicitMonths = [...new Set(explicitDates.map((s) => dateValue(s, options.month).slice(0, 7)))];
  const documentMonth = monthMatch ? `${monthMatch[2]}-${pad(MONTHS.indexOf(monthMatch[1] === 'maerz' ? 'märz' : monthMatch[1]) + 1)}` : explicitMonths.length === 1 ? explicitMonths[0] : null;
  const month = documentMonth ?? options.month;
  if (!documentMonth) warnings.add(`Kein eindeutiger Dokumentmonat erkannt. Datumsangaben ohne Monat/Jahr beziehen sich auf ${options.month}; bitte prüfen.`);
  if (documentMonth && documentMonth !== options.month) warnings.add(`Die Vorlage gehört zu ${documentMonth}, ausgewählt ist ${options.month}. Daten wurden nicht verschoben.`);
  if (explicitMonths.length > 1) warnings.add('Die Vorlage enthält mehrere Monate. Angaben außerhalb des Zielmonats müssen gesondert bearbeitet werden.');
  const names = [...new Set(lines.flatMap((line) => {
    const m = line.match(/^(?:name|mitarbeiter(?:in)?|mitarbeitende(?:r)?|personal)\s*:\s*(.+)$/i);
    return m ? [m[1].trim()] : [];
  }))];
  const personName = names.length === 1 ? names[0] : names.length ? names.join(' / ') : null;
  if (!personName) warnings.add('Keine eindeutige Person erkannt. Bitte sicherstellen, dass der Text nur zur ausgewählten Person gehört.');
  else if (options.employeeName && norm(personName) !== norm(options.employeeName)) warnings.add(`Person in der Vorlage (${personName}) mit ${options.employeeName} abgleichen.`);
  // Team matrices are deliberately not flattened into a single employee's slots.
  const matrix = lines.some((l) => /\b(name|mitarbeiter|mitarbeitende|personal)\b/i.test(l) && [...l.matchAll(/\b\d{1,2}\b/g)].length >= 3);
  if (names.length > 1 || matrix) {
    warnings.add('Mehrpersonenplan erkannt. Bitte im Textfeld ausschließlich die datierten Zeilen der Zielperson belassen und erneut auswerten. Teamtabellen werden nicht automatisch einer Person zugeordnet.');
    return { personName, documentMonth, rows, warnings: [...warnings], unrecognized: lines.slice(0, 40) };
  }
  const beginsOnly = /dienstbeginn|alle dienste ab|beginn ohne ende/i.test(text);
  const separateColumns = /(?:beginn|von|start).*?(?:ende|bis)/i.test(lines.find((l) => /datum|tag/i.test(l) && /beginn|von|start/i.test(l)) ?? '');
  let dayColumn = false;
  let countDates = 0;
  for (const line of lines) {
    if (/^(datum|tag|datum & wochentag)\b/i.test(line)) dayColumn = true;
    const found = [...line.matchAll(DATE)];
    let dates = found.map((m) => dateValue(m[0], month));
    let body = line;
    if (found.length === 1) body = line.slice((found[0].index ?? 0) + found[0][0].length).trim();
    else if (found.length === 2 && /^\s*(?:-|–|—|bis)\s*$/i.test(line.slice((found[0].index ?? 0) + found[0][0].length, found[1].index))) {
      const [first, last] = dates;
      if (!validDate(first) || !validDate(last) || first > last || (Date.parse(last) - Date.parse(first)) / 86400000 > 31) { unrecognized.push(line); continue; }
      dates = []; for (let d = first; d <= last; d = nextDate(d)) dates.push(d);
      body = line.slice((found[1].index ?? 0) + found[1][0].length).trim();
    } else if (found.length > 1) { unrecognized.push(line); continue; }
    else {
      const day = line.match(new RegExp(`^(?:${WEEKDAYS}[,.]?\\s+)?(\\d{1,2})(?:\\.|\\s)\\s*(.+)$`, 'i'));
      if (day && !/^(tage|stunden|dienste)\b/i.test(day[2]) && (dayColumn || new RegExp(`^${WEEKDAYS}\\b`, 'i').test(line))) { dates = [`${month}-${pad(day[1])}`]; body = day[2]; }
    }
    if (!dates.length) {
      if (!/^(?:datum|tag|dienstplan|übersicht|insgesamt|summe|alle dienste|name|mitarbeiter)/i.test(line) && /\d\s*(?:[:.]\d{2}|[-–]\s*\d)|\b(urlaub|krank|wunsch.?frei)\b/i.test(line)) unrecognized.push(line);
      continue;
    }
    countDates += dates.length;
    // Retain invalid dates for the form's date validation; do not coerce them to another day.
    if (dates.some((d) => !validDate(d))) warnings.add('Mindestens ein erkanntes Datum ist ungültig und muss korrigiert werden.');
    if (!body || /^(?:[-–—]|\|)+$/.test(body)) { unrecognized.push(line); continue; }
    const parts: { start: string; end: string; source: string; uncertain?: boolean }[] = [];
    const ranges = [...body.matchAll(RANGE)];
    if (ranges.length) {
      ranges.forEach((m, i) => parts.push({ start: clock(m[1]), end: clock(m[2]), source: body.slice(i ? m.index : 0, ranges[i + 1]?.index).trim() }));
    } else {
      const partials = [...body.matchAll(PART)];
      if (partials.length) partials.forEach((m, i) => parts.push({ start: /ab|von/i.test(m[1]) ? clock(m[2]) : '', end: /bis/i.test(m[1]) ? clock(m[2]) : '', source: body.slice(i ? m.index : 0, partials[i + 1]?.index).trim() }));
      else {
        const times = body.match(TIMED) ?? [];
        if (separateColumns && times.length === 2) parts.push({ start: clock(times[0]), end: clock(times[1]), source: body, uncertain: true });
        else if (times.length === 1 && beginsOnly) parts.push({ start: clock(times[0]), end: '', source: body });
        else parts.push({ start: '', end: '', source: body, uncertain: true });
      }
    }
    for (const date of dates) for (const part of parts) {
      const classification = kindFor(part.source, options);
      if (options.interpretation === 'mixed' && ranges.length > 1) classification.requiresClassification = true;
      const allDay = !part.start && !part.end && /\b(ganztägig|ganztaegig|urlaub|krank|wunsch[ -]?frei)\b/i.test(part.source);
      const startTime = allDay ? '00:00' : part.start;
      const endTime = allDay ? '24:00' : part.end;
      const base = { ...classification, label: part.source.slice(0, 160), sourceText: line.slice(0, 600), uncertain: !!part.uncertain || classification.requiresClassification || !startTime || !endTime };
      const push = (d: string, s: string, e: string) => rows.push({ ...base, id: `local-${rows.length}`, date: d, startTime: s, endTime: e });
      if (startTime && endTime && endTime < startTime && validDate(date)) {
        push(date, startTime, '24:00');
        if (endTime !== '00:00') push(nextDate(date), '00:00', endTime);
        warnings.add('Nachtdienste wurden auf die betroffenen Kalendertage aufgeteilt. Monatsgrenzen bitte prüfen.');
      } else push(date, startTime, endTime);
      if (rows.length > 300) throw new Error('Mehr als 300 Zeitfenster erkannt. Bitte den Text auf eine Person und einen Monat begrenzen.');
    }
  }
  const unique = rows.filter((r, i) => rows.findIndex((p) => p.date === r.date && p.startTime === r.startTime && p.endTime === r.endTime && p.kind === r.kind && p.requiresClassification === r.requiresClassification && p.label === r.label) === i);
  if (unique.length < rows.length) warnings.add('Identische Zeilen innerhalb dieser Vorlage wurden nur einmal übernommen.');
  const missing = unique.filter((r) => !r.startTime || !r.endTime).length;
  if (missing) warnings.add(`${missing} Zeitfenster ohne vollständige Uhrzeiten. Fehlende Angaben vor dem Speichern ergänzen.`);
  if (unrecognized.length) warnings.add(`${unrecognized.length} Textzeilen konnten nicht sicher zugeordnet werden. Bitte unter „Nicht zugeordnete Zeilen“ prüfen.`);
  if (!unique.length) warnings.add('Keine sicher zuordenbaren datierten Angaben gefunden. Text korrigieren oder Tage manuell erfassen.');
  const total = text.match(/insgesamt\s*:?\s*(\d+)\s*(?:dienste|tage)/i);
  if (total && Number(total[1]) !== countDates) warnings.add(`Die Zusammenfassung nennt ${total[1]} Dienste/Tage, erkannt wurden ${countDates} datierte Angaben.`);
  return { personName, documentMonth, rows: unique, warnings: [...warnings], unrecognized: unrecognized.slice(0, 40) };
}
