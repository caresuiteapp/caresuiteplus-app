import { CENTRAL_CATEGORY_ACTIONS, CENTRAL_FIELD_TEXT_CHOICES, CENTRAL_SOFTWARE_FIELD_CHOICES, type CentralChoiceText } from '@/data/seeds/documentCatalog/centralQuickChoiceProfiles';
import { centralStoredFieldValue } from './centralCatalogModel';
import type { CentralDocumentField, CentralDocumentSection, CentralDocumentSnapshot } from '@/types/documents/centralCatalog';

export type CentralQuickContext = Pick<CentralDocumentSnapshot, 'definition' | 'context' | 'documentId' | 'tableOrigin'>;
export type CentralQuickChoice = { key: string; label: string; value: string; mode: 'append' | 'replace' | 'restore' | 'unit'; unavailable?: string; resolveValue?: () => string };
const clean = (value?: string) => value?.trim() || '';
const choice = (key: string, label: string, value: string | undefined, mode: CentralQuickChoice['mode'] = 'append'): CentralQuickChoice => ({ key, label, value: clean(value), mode, ...(!clean(value) ? { unavailable: 'In dieser Akte nicht hinterlegt' } : {}) });
const texts = (prefix: string, items: readonly CentralChoiceText[] | undefined, mode: CentralQuickChoice['mode'] = 'append') => (items ?? []).map(([label, value], index) => choice(`${prefix}-${index}`, label, value, mode));
const unique = (items: CentralQuickChoice[]) => {
  const seen = new Set<string>();
  return items.filter((item) => { const key = item.value ? `${item.mode}:${item.value}` : `unavailable:${item.key}`; if (seen.has(key)) return false; seen.add(key); return true; });
};
const isoDay = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const shiftDay = (day: string, offset: number) => { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); };
const germanDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) ? day.split('-').reverse().join('.') : day;
const todayChoices = (now: Date, iso = false, live = false) => {
  const day = isoDay(now);
  return [['Heute', day], ['Gestern', shiftDay(day, -1)], ['Morgen', shiftDay(day, 1)]].map(([label, value], index) => ({
    ...choice(`date-${index}`, label, iso ? value : germanDay(value), 'replace'),
    ...(live ? { resolveValue: () => { const actual = shiftDay(isoDay(new Date()), [0, -1, 1][index]); return iso ? actual : germanDay(actual); } } : {}),
  }));
};
const time = (now: Date) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
const monthRange = (now: Date, offset: number) => {
  const [year, month] = isoDay(now).split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1 + offset, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  return `${germanDay(first.toISOString().slice(0, 10))} – ${germanDay(last.toISOString().slice(0, 10))}`;
};
const periodChoices = (now: Date, live = false) => [
  { ...choice('month-current', 'Aktueller Monat', monthRange(now, 0), 'replace'), ...(live ? { resolveValue: () => monthRange(new Date(), 0) } : {}) },
  { ...choice('month-previous', 'Voriger Monat', monthRange(now, -1), 'replace'), ...(live ? { resolveValue: () => monthRange(new Date(), -1) } : {}) }, ...todayChoices(now, false, live),
];
const peopleChoices = (snapshot: CentralQuickContext, author: string, initials = false) => unique([
  choice('person-author', 'Aktuell angemeldete Person', author, 'replace'),
  ...(!initials ? [choice('person-employee', 'Zugeordnete Mitarbeiter:in', snapshot.context.employee.name || (snapshot.context.target === 'employee' ? snapshot.context.subject.name : ''), 'replace'), choice('person-representative', 'Betriebliche Vertretung', snapshot.context.company.representativeName, 'replace')] : []),
]).map((item) => initials && item.value ? { ...item, value: item.value.split(/\s+/).map((part) => part[0]).join('').toLocaleUpperCase('de-DE') } : item);

export function centralFieldQuickChoices(snapshot: CentralQuickContext, field: CentralDocumentField, author: string, now?: Date): CentralQuickChoice[] {
  const at = now ?? new Date();
  const source = centralStoredFieldValue(field, snapshot.context, snapshot.definition.key);
  const items: CentralQuickChoice[] = [];
  if (field.sourcePath || source) items.push(choice('stored-field', 'Gespeicherte Angabe', source, 'replace'));
  if (field.defaultValue) items.push(choice('template-field', 'Vorlagenangabe', field.defaultValue, 'replace'));
  if (field.key === 'date') items.push(...todayChoices(at, true, !now));
  if (field.key === 'author') items.push(...peopleChoices(snapshot, author));
  if (field.key === 'careLevel') items.push(...[1, 2, 3, 4, 5].map((level) => choice(`care-level-${level}`, `Pflegegrad ${level}`, String(level), 'replace')));
  if (field.key === 'jobTitle') items.push(...texts('job', [['Pflegefachkraft', 'Pflegefachkraft'], ['Alltagsbegleitung', 'Alltagsbegleiter:in'], ['Hauswirtschaft', 'Hauswirtschaftskraft'], ['Verwaltung', 'Verwaltungsmitarbeiter:in']], 'replace'));
  if (snapshot.definition.layout === 'letter' && ['subjectName', 'subjectAddress'].includes(field.key)) {
    const property = field.key === 'subjectName' ? 'name' : 'address';
    for (const [key, label] of [['subject', 'Zugeordnete Person'], ['representative', 'Gesetzliche Vertretung'], ['payor', 'Kostenträger'], ['company', 'Eigenes Unternehmen']] as const) items.push(choice(`recipient-${key}`, label, snapshot.context[key][property], 'replace'));
  }
  if (field.key === 'letterSubject') items.push(choice('document-title', 'Titel dieser Vorlage', snapshot.definition.title, 'replace'));
  if (field.key === 'reference') items.push(choice('document-reference', 'Eigene Dokument-ID', snapshot.documentId, 'replace'), choice('invoice-reference', 'Zugeordnete Rechnungsnummer', snapshot.context.procedure?.invoiceNumber, 'replace'));
  if (field.key === 'enclosures') items.push(...texts('enclosure', [['Leistungsnachweis', 'Leistungsnachweis'], ['Rechnung', 'Rechnung'], ['Leistungsvereinbarung', 'Leistungsvereinbarung'], ['Vertretungsnachweis', 'Vertretungsnachweis'], ['Originalunterlage', 'Zugeordnete Originalunterlage']]));
  if (field.key === 'f0_leistungszeitraum') items.push(...periodChoices(at, !now));
  items.push(...texts('field-text', CENTRAL_FIELD_TEXT_CHOICES[field.label]), ...texts('software-field', CENTRAL_SOFTWARE_FIELD_CHOICES[field.key]));
  return unique(items);
}

function annexes(snapshot: CentralQuickContext): readonly CentralChoiceText[] {
  if (snapshot.definition.categoryKey === 'personal' || snapshot.definition.target === 'employee') return [
    ['Aufgabenbeschreibung', 'Die individuell vereinbarte Aufgabenbeschreibung wird als Anlage zugeordnet.'],
    ['Arbeitszeitvereinbarung', 'Die individuell vereinbarte Arbeitszeitregelung wird als Anlage zugeordnet.'],
    ['Vergütungsregelung', 'Die individuell vereinbarte Vergütungsregelung wird als Anlage zugeordnet.'],
    ['Datenschutzinformation', 'Die zugehörige Datenschutzinformation für Beschäftigte wird bereitgestellt.'],
  ];
  if (snapshot.definition.categoryKey === 'software') return [
    ['Nutzungsbeschreibung', 'Die zugehörige CareSuite-Nutzungsbeschreibung wird mit Versionsstand zugeordnet.'],
    ['Auftragsverarbeitung', 'Die zugehörige Auftragsverarbeitungsvereinbarung wird mit ihren freigegebenen Anlagen zugeordnet.'],
    ['TOM-Anlage', 'Die freigegebene TOM-Anlage wird mit Versionsstand zugeordnet.'],
    ['Datenschutzinformation', 'Die zugehörige Datenschutzinformation wird bereitgestellt.'],
  ];
  return CENTRAL_FIELD_TEXT_CHOICES['Anlagen und besondere Vereinbarungen'];
}

export function centralSectionQuickChoices(snapshot: CentralQuickContext, section: CentralDocumentSection): CentralQuickChoice[] {
  const items = [choice('section-original', 'Vorlagentext wiederherstellen', section.text, 'restore')];
  const heading = section.heading.toLocaleLowerCase('de-DE');
  if (snapshot.definition.layout === 'letter') {
    items.push(...texts('letter-purpose', [
      ['Unterlagen anfordern', 'Bitte übersenden Sie uns die für den im Betreff bezeichneten Vorgang erforderlichen Unterlagen.'],
      ['Sachstand erfragen', 'Bitte teilen Sie uns den aktuellen Bearbeitungsstand zu dem im Betreff bezeichneten Vorgang mit.'],
      ['Rückfrage klären', 'Bitte nehmen Sie zur Klärung der offenen Angaben zum bezeichneten Vorgang Kontakt mit uns auf.'],
      ['Anlagen übermitteln', 'Die in diesem Schreiben aufgeführten Anlagen übermitteln wir Ihnen zur weiteren Bearbeitung.'],
    ]));
  } else if (/vergütung|kosten|abrechnung/.test(heading)) {
    const costTexts: readonly CentralChoiceText[] = snapshot.definition.categoryKey === 'software'
      ? [['Kostenlose Nutzung', 'Die kostenlos bereitgestellte Nutzung begründet keine automatische Zahlungspflicht.'], ['Gesonderte Vereinbarung', 'Gesonderte kostenpflichtige Leistungen bedürfen einer ausdrücklichen eigenen Vereinbarung.']]
      : snapshot.definition.categoryKey === 'personal' || snapshot.definition.target === 'employee'
        ? [['Individuelle Vergütung', 'Vergütung und ihre einzelnen Bestandteile werden in der zugehörigen individuellen Vereinbarung beziffert.'], ['Arbeitszeitnachweis', 'Tatsächlich dokumentierte Arbeitszeiten werden anhand der maßgeblichen betrieblichen Vereinbarung abgerechnet.']]
        : CENTRAL_FIELD_TEXT_CHOICES['Vergütung, Eigenanteile und Abrechnungsverfahren'];
    items.push(...texts('section-costs', costTexts));
  }
  else if (/anlagen|ausfertigung|übergabe/.test(heading)) items.push(...texts('section-annexes', annexes(snapshot)));
  else if (/widerruf/.test(heading)) items.push(...texts('section-withdrawal', CENTRAL_FIELD_TEXT_CHOICES['Freiwilligkeit, Gültigkeit und Widerrufsweg']));
  else if (/laufzeit|beendigung|änderung/.test(heading) && !['personal', 'software'].includes(snapshot.definition.categoryKey) && snapshot.definition.target !== 'employee') items.push(...texts('section-duration', CENTRAL_FIELD_TEXT_CHOICES['Laufzeit, Absagen und Kündigungsbedingungen']));
  else if (/rechte|zugang|rollen|berechtigung/.test(heading) && ['software', 'datenschutz'].includes(snapshot.definition.categoryKey)) items.push(...texts('section-access', CENTRAL_SOFTWARE_FIELD_CHOICES.cs_matrix));
  return unique(items);
}

export function centralAdditionalQuickChoices(snapshot: CentralQuickContext): CentralQuickChoice[] {
  if (snapshot.definition.sourceMode === 'original') return texts('additional-original', CENTRAL_FIELD_TEXT_CHOICES['Erforderliche Folgemaßnahmen']);
  if (snapshot.definition.layout === 'contract') return texts('additional-contract', annexes(snapshot));
  if (['datenschutz', 'software'].includes(snapshot.definition.categoryKey)) return texts('additional-software', CENTRAL_SOFTWARE_FIELD_CHOICES.cs_review);
  return texts('additional-action', [['Weitere Abstimmung', 'Weiteres Vorgehen mit den konkret zuständigen Personen abstimmen.'], ['Nachweise ausstehend', 'Erforderliche weitere Unterlagen beziehungsweise Nachweise stehen noch aus.'], ['Wiedervorlage', 'Wiedervorlagetermin und Verantwortlichkeit für die offenen Punkte festlegen.']]);
}

const UNITS: Readonly<Record<string, readonly string[]>> = {
  'Gewicht (kg)': ['kg', 'g'], 'Angeboten (ml)': ['ml'], 'Getrunken (ml)': ['ml'], 'Temperatur (°C)': ['°C'],
  'Einnahme (€)': ['€', 'EUR'], 'Ausgabe (€)': ['€', 'EUR'], 'Bestand (€)': ['€', 'EUR'],
  'Km Beginn': ['km'], 'Km Ende': ['km'], 'Strecke (km)': ['km'],
  'Dosis / Einheit': ['mg', 'µg', 'g', 'ml', 'I.E.', 'Tablette(n)', 'Tropfen', 'Hub/ Hübe'],
  'Menge / Einheit': ['Stunden', 'Minuten', 'Besuche', 'Stück'], 'Ergebnis / Menge': ['Stück', 'Minuten', 'Stunden'],
};
const TABLE_TEXTS: Readonly<Record<string, readonly CentralChoiceText[]>> = {
  'Messbedingungen': [['In Ruhe', 'In Ruhe'], ['Vor einer Mahlzeit', 'Vor einer Mahlzeit'], ['Nach einer Mahlzeit', 'Nach einer Mahlzeit'], ['Bedingungen abweichend', 'Abweichende Messbedingungen']],
  'Beobachtung': [['Rücksprache erforderlich', 'Fachliche Rücksprache erforderlich'], ['Verlaufskontrolle offen', 'Verlaufskontrolle ausstehend'], ['Angaben unvollständig', 'Beobachtungsangaben unvollständig']],
  'Abweichung / Hinweis': [['Terminänderung', 'Terminänderung'], ['Nachweis ausstehend', 'Nachweis ausstehend'], ['Rückfrage', 'Rückfrage erforderlich'], ['Keine Abweichung', 'Keine Abweichung festgestellt']],
  'Abweichung': [['Planabweichung', 'Abweichung von der vorgesehenen Durchführung'], ['Nicht durchgeführt', 'Nicht durchgeführt'], ['Klärung offen', 'Klärung ausstehend']],
  'Gabe / Abweichung': [['Gabe offen', 'Dokumentation der tatsächlichen Gabe ausstehend'], ['Abgelehnt', 'Einnahme abgelehnt'], ['Nicht durchgeführt', 'Nicht durchgeführt'], ['Rücksprache', 'Rücksprache erforderlich']],
  'Rücksprache': [['Hausarztpraxis', 'Hausarztpraxis'], ['Facharztpraxis', 'Zuständige Facharztpraxis'], ['Fachperson', 'Zuständige Fachperson'], ['Rückmeldung offen', 'Rückmeldung ausstehend']],
  'Getränk': [['Wasser', 'Wasser'], ['Tee', 'Tee'], ['Kaffee', 'Kaffee'], ['Saft', 'Saft'], ['Individuelles Getränk', 'Individuell vereinbartes Getränk']],
  'Messgröße': [['Blutdruck', 'Blutdruck'], ['Puls', 'Puls'], ['Temperatur', 'Körpertemperatur'], ['Sauerstoffsättigung', 'Sauerstoffsättigung'], ['Blutzucker', 'Blutzucker']],
  'Applikationsweg': [['Oral', 'Oral – nur entsprechend gültiger Anordnung'], ['Subkutan', 'Subkutan – nur entsprechend gültiger Anordnung'], ['Inhalativ', 'Inhalativ – nur entsprechend gültiger Anordnung'], ['Kutan', 'Kutan – nur entsprechend gültiger Anordnung']],
  'Arzneimittel / Stärke': [['Gültiger Plan', 'Gemäß gültiger ärztlicher Anordnung'], ['Planabgleich offen', 'Planabgleich ausstehend']],
  'Ort / Gerät': [['Gerät dokumentieren', 'Gerätebezeichnung gemäß vorhandener Kennzeichnung'], ['Messort dokumentieren', 'Tatsächlicher Messort ist noch zu ergänzen']],
  'Leistung': [['Hauswirtschaft', 'Hauswirtschaftliche Unterstützung'], ['Alltagsbegleitung', 'Alltagsbegleitung'], ['Begleitung außer Haus', 'Begleitung außer Haus'], ['Pflegerische Unterstützung', 'Pflegerische Unterstützung gemäß zugeordnetem Auftrag']],
  'Bestätigung': [['Bestätigung offen', 'Bestätigung ausstehend'], ['Rückfrage', 'Rückfrage erforderlich'], ['Klärung offen', 'Zuordnung beziehungsweise Vertretung noch zu klären']],
  'Zweck / Beleg': [['Einkauf', 'Vereinbarter Einkauf'], ['Auslagen', 'Belegte Auslagen'], ['Quittung', 'Zugeordnete Quittung'], ['Beleg offen', 'Beleg ausstehend']],
  'Fahrtzweck': [['Anfahrt', 'Anfahrt zum zugeordneten Einsatz'], ['Zwischenfahrt', 'Fahrt zwischen zugeordneten Einsätzen'], ['Heimfahrt', 'Heimfahrt nach dem Einsatztag'], ['Begleitfahrt', 'Vereinbarte Begleitfahrt']],
};

export function centralTableAllowsMultiple(column: string): boolean {
  return !UNITS[column] && !['Wert / Einheit', 'Datum', 'Datum / Zeitraum', 'Datum / Uhrzeit', 'Beginn', 'Ende', 'Zuständigkeit', 'Mitarbeitende', 'Fahrer:in', 'Handzeichen', 'Start / Ziel', 'Arzneimittel / Stärke', 'Applikationsweg', 'Ort / Gerät', 'Getränk', 'Messgröße', 'Bestätigung'].includes(column);
}

export function centralTableQuickChoices(snapshot: CentralQuickContext, column: string, row: number, author: string, now?: Date): CentralQuickChoice[] {
  const at = now ?? new Date();
  const index = snapshot.definition.columns.indexOf(column);
  const stored = choice('stored-cell', 'Gespeicherter Tabellenwert', snapshot.tableOrigin === 'stored' ? snapshot.context.sourceRows?.[row]?.[index] : undefined, 'replace');
  if (snapshot.tableOrigin === 'manual' && snapshot.context.sourceRows?.length) stored.unavailable = 'Für diese Zeile keine eindeutige gespeicherte Zuordnung';
  const items = [stored];
  if (column === 'Datum') items.push(...todayChoices(at, false, !now));
  if (column === 'Datum / Zeitraum') items.push(...periodChoices(at, !now));
  if (column === 'Datum / Uhrzeit') items.push({ ...choice('timestamp-now', 'Aktueller Zeitpunkt', `${germanDay(isoDay(at))} ${time(at)}`, 'replace'), ...(!now ? { resolveValue: () => { const actual = new Date(); return `${germanDay(isoDay(actual))} ${time(actual)}`; } } : {}) });
  if (['Beginn', 'Ende'].includes(column)) items.push({ ...choice('time-now', 'Aktuelle Uhrzeit', time(at), 'replace'), ...(!now ? { resolveValue: () => time(new Date()) } : {}) });
  if (['Zuständigkeit', 'Mitarbeitende', 'Fahrer:in', 'Handzeichen'].includes(column)) items.push(...peopleChoices(snapshot, author, column === 'Handzeichen'));
  if (['Gegenstand / Maßnahme', 'Maßnahme', 'Anordnung / Maßnahme'].includes(column)) items.push(...texts('table-action', CENTRAL_CATEGORY_ACTIONS[snapshot.definition.categoryKey]));
  if (column === 'Start / Ziel') items.push(choice('location-company', 'Unternehmensanschrift', snapshot.context.company.address, 'replace'), choice('location-subject', 'Anschrift der zugeordneten Person', snapshot.context.subject.address, 'replace'));
  if (column === 'Wert / Einheit') items.push(...texts('measure-unit', (/Blutzucker/.test(snapshot.definition.title) ? ['mg/dl', 'mmol/l'] : ['mmHg', '/min', '°C', '%', 'mg/dl', 'mmol/l']).map((unit) => [unit, unit] as const), 'unit'));
  if (UNITS[column]) items.push(...texts('unit', UNITS[column].map((unit) => [unit, unit] as const), 'unit'));
  items.push(...texts('table-text', TABLE_TEXTS[column], 'replace'));
  return unique(items);
}

/** Manual text is retained when combining blocks; quantities are never generated. */
export function applyCentralQuickChoice(current: string, selection: CentralQuickChoice, append = selection.mode === 'append'): string {
  if (selection.unavailable || !selection.value) return current;
  if (selection.mode === 'unit') {
    const numeric = current.trim().match(/^([+-]?\d+(?:[.,]\d+)?)(?:\s*(.+))?$/);
    const units = new Set([...Object.values(UNITS).flat(), 'mmHg', '/min', '%', 'mg/dl', 'mmol/l']);
    if (numeric && (!numeric[2] || units.has(numeric[2].trim()))) return `${numeric[1]} ${selection.value}`;
    if (!current.trim()) return selection.value;
    return current.split(/\n/).some((line) => line.trim() === selection.value) ? current : `${current.trimEnd()}\n${selection.value}`;
  }
  if (!append || selection.mode === 'restore' || !current.trim()) return selection.value;
  if (current.trim() === selection.value || current.split(/\n\s*\n/).some((paragraph) => paragraph.trim() === selection.value)) return current;
  return `${current.trimEnd()}\n\n${selection.value}`;
}
