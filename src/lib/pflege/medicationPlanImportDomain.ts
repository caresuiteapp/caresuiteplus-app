import { DOMParser } from '@xmldom/xmldom';

export const MAX_MEDICATION_PLAN_BYTES = 3 * 1024 * 1024;
const MAX_PAGES = 5;
const MAX_POSITIONS = 200;
const BMP_WEEKDAYS: Record<string, string> = {
  '1': 'Montag', '2': 'Dienstag', '3': 'Mittwoch', '4': 'Donnerstag', '5': 'Freitag', '6': 'Samstag', '7': 'Sonntag',
};

type XmlAttributes = Record<string, string>;
type XmlNode = { tag: string; attributes: XmlAttributes; children: XmlNode[] };
export type MedicationPlanVersion = '026' | '027' | '028';
export const isMedicationPlanVersion = (value: unknown): value is MedicationPlanVersion => value === '026' || value === '027' || value === '028';
export type MedicationPlanPatient = { firstName: string; lastName: string; birthDate: string | null; rawBirthDate: string; insuranceId: string | null };
export type MedicationPlanPosition = {
  kind: 'medication' | 'formulation' | 'note';
  page: number;
  section: { code: string | null; label: string | null };
  name: string | null;
  pzn: string | null;
  ingredients: { name: string; strength: string | null }[];
  form: string | null;
  formCode: string | null;
  weekdayCode: string | null;
  morning: string | null;
  noon: string | null;
  evening: string | null;
  night: string | null;
  doseText: string | null;
  unit: string | null;
  unitCode: string | null;
  instructions: string | null;
  indication: string | null;
  additionalText: string | null;
  source: XmlNode;
};
export type MedicationPlanDraft = {
  version: MedicationPlanVersion; planId: string; pageCount: number; patient: MedicationPlanPatient;
  issuer: { name: string; printedAt: string; lanr: string | null };
  rows: MedicationPlanPosition[];
  headers: { page: number; patient: XmlAttributes; issuer: XmlAttributes; additional: XmlAttributes | null; root: XmlAttributes }[];
};

function fail(message = 'Das strukturierte Original ist kein eindeutig lesbarer BMP der Version 2.6, 2.7 oder 2.8.'): never {
  throw new Error(message);
}
function attrs(node: Element, allowed: readonly string[]): XmlAttributes {
  const result: XmlAttributes = {};
  for (let i = 0; i < node.attributes.length; i += 1) {
    const entry = node.attributes.item(i);
    if (!entry || !allowed.includes(entry.name) || entry.value.length > 2000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/u.test(entry.value)) fail();
    result[entry.name] = entry.value;
  }
  return result;
}
function children(node: Element | Document): Element[] {
  const values: Element[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1) {
      const element = child as Element;
      if (element.namespaceURI || element.prefix) fail();
      values.push(element);
    } else if (child.nodeType === 3 && (child.nodeValue ?? '').trim() === '') {
      // Whitespace between tags has no clinical meaning.
    } else if (child.nodeType === 7 && node.nodeType === 9 && child.nodeName === 'xml') {
      // Ordinary XML declaration only. No processing instructions in the payload.
    } else if (child.nodeType !== 8) fail();
  }
  return values;
}
function leaf(node: Element, keys: readonly string[]): XmlNode {
  if (children(node).length) fail();
  return { tag: node.tagName, attributes: attrs(node, keys), children: [] };
}
function requireText(input: string | undefined): string {
  if (!input?.trim()) fail();
  return input;
}
function birthDate(raw: string): string | null {
  if (!/^\d{8}$/.test(raw) || Number(raw.slice(0, 4)) < 1000 || Number(raw.slice(4, 6)) > 12 || Number(raw.slice(6, 8)) > 31) fail();
  // 00 components are documented as unknown; they never participate in auto assignment.
  if (raw.slice(4, 6) === '00' || raw.slice(6, 8) === '00') return null;
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== iso) fail();
  return iso;
}
function nullable(value: string | undefined): string | null { return value === undefined ? null : value; }
function positiveIndex(value: string): number {
  if (!/^\d{1,2}$/.test(value)) fail();
  const count = Number(value);
  if (count < 1 || count > MAX_PAGES) fail();
  return count;
}
function normalizePosition(node: Element, page: number, section: MedicationPlanPosition['section'], version: MedicationPlanVersion): MedicationPlanPosition {
  const medication = node.tagName === 'M';
  if (!medication && node.tagName !== 'X' && node.tagName !== 'R') fail();
  const source = medication ? {
    tag: node.tagName,
    attributes: attrs(node, ['p', 'a', 'f', 'fd', 'wo', 'm', 'd', 'v', 'h', 't', 'du', 'dud', 'i', 'r', 'x']),
    children: children(node).map(child => {
      if (child.tagName !== 'W') fail();
      return leaf(child, ['w', 's']);
    }),
  } : leaf(node, node.tagName === 'R' ? ['t', 'x'] : ['t']);
  const a = source.attributes;
  if (source.children.length > 3 || (a.p !== undefined && !/^\d{1,8}$/.test(a.p)) || (a.wo !== undefined && !/^[1-7]$/.test(a.wo))) fail();
  if (a.wo !== undefined && version !== '028') fail('Der Plan enthält einen Wochentag, der in dieser BMP-Version nicht definiert ist. Bitte das Original manuell prüfen.');
  if (a.wo !== undefined && [a.m, a.d, a.v, a.h].every(value => !value?.trim())) fail('Für eine Wochenposition fehlt die zugehörige Tageszeit-Dosis. Bitte das Original manuell prüfen.');
  if (medication && ((a.t !== undefined && [a.m, a.d, a.v, a.h].some(value => value !== undefined))
    || (a.f !== undefined && a.fd !== undefined) || (a.du !== undefined && a.dud !== undefined))) fail('Der Plan enthält widersprüchliche Darreichungs- oder Dosierungsangaben. Bitte das Original manuell prüfen.');
  const ingredients = source.children.map(child => ({ name: requireText(child.attributes.w), strength: nullable(child.attributes.s) }));
  if (medication && !a.a?.trim() && a.p === undefined && !ingredients.length) fail('Eine Position enthält weder Präparat, PZN noch Wirkstoff.');
  if (!medication) requireText(a.t);
  return {
    kind: medication ? 'medication' : node.tagName === 'R' ? 'formulation' : 'note',
    page, section, name: nullable(a.a), pzn: a.p === undefined ? null : a.p.padStart(8, '0'), ingredients,
    form: nullable(a.fd), formCode: nullable(a.f), weekdayCode: nullable(a.wo),
    morning: nullable(a.m), noon: nullable(a.d), evening: nullable(a.v), night: nullable(a.h),
    doseText: medication ? nullable(a.t) : null, unit: nullable(a.dud), unitCode: nullable(a.du),
    instructions: nullable(a.i), indication: nullable(a.r), additionalText: nullable(medication ? a.x : a.t), source,
  };
}
function sortedAttributes(attributes: XmlAttributes): string {
  return JSON.stringify(Object.entries(attributes).sort(([a], [b]) => a.localeCompare(b)));
}
function parsePage(source: string) {
  // No external entities, DTDs or fetches. A strict error handler rejects repaired markup.
  if (!source || source.length > 300_000 || /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(source) || source.includes('\uFFFD')) fail();
  let bad = false;
  let doc: Document;
  try {
    const invalidate = () => { bad = true; };
    doc = new DOMParser({ errorHandler: { warning: invalidate, error: invalidate, fatalError: invalidate } }).parseFromString(source, 'application/xml');
  } catch { fail(); }
  const roots = children(doc);
  if (bad || roots.length !== 1 || roots[0].tagName !== 'MP') fail();
  const root = roots[0], header = attrs(root, ['v', 'U', 'l', 'a', 'z', 'p']);
  const version = header.v;
  // Older carrier data may omit l and include the legacy patch number. Neither changes the dosing fields.
  if (!isMedicationPlanVersion(version) || !/^[0-9A-Fa-f]{32}$/.test(header.U ?? '')
    || (version === '028' ? header.l !== 'de-DE' || header.p !== undefined : (header.l !== undefined && header.l !== 'de-DE') || (header.p !== undefined && !/^\d{1,2}$/.test(header.p)))) {
    fail('Bitte einen bundeseinheitlichen Medikationsplan (BMP 2.6, 2.7 oder 2.8) mit lesbarem Strukturcode wählen.');
  }
  if ((header.a === undefined) !== (header.z === undefined)) fail();
  const page = header.a === undefined ? 1 : positiveIndex(header.a), total = header.z === undefined ? 1 : positiveIndex(header.z);
  if (page > total || (header.z !== undefined && total < 2)) fail();
  const nodes = children(root);
  if (nodes[0]?.tagName !== 'P' || nodes[1]?.tagName !== 'A') fail();
  const patient = leaf(nodes[0], ['g', 'f', 'b', 'egk', 's', 't', 'v', 'z']).attributes;
  const issuer = leaf(nodes[1], ['lanr', 'idf', 'kik', 'n', 's', 'z', 'c', 'p', 'e', 't']).attributes;
  requireText(patient.g); requireText(patient.f); requireText(issuer.n); requireText(issuer.t);
  if (patient.egk !== undefined && !/^[A-Z]\d{9}$/.test(patient.egk)) fail();
  if (issuer.lanr !== undefined && !/^\d{9}$/.test(issuer.lanr)) fail();
  const rawBirthDate = requireText(patient.b);
  const identity: MedicationPlanPatient = { firstName: patient.g, lastName: patient.f, birthDate: birthDate(rawBirthDate), rawBirthDate, insuranceId: nullable(patient.egk) };
  const additional = nodes[2]?.tagName === 'O' ? leaf(nodes[2], ['ai', 'p', 'b', 'w', 'h', 'c', 'x']).attributes : null;
  const sections = nodes.slice(additional ? 3 : 2);
  if (sections.length > 23) fail();
  const rows = sections.flatMap(section => {
    if (section.tagName !== 'S') fail();
    const attributes = attrs(section, ['c', 't']);
    if (attributes.c !== undefined && attributes.t !== undefined) fail();
    return children(section).map(item => normalizePosition(item, page, { code: nullable(attributes.c), label: nullable(attributes.t) }, version));
  });
  if (rows.length > MAX_POSITIONS) fail('Der Medikationsplan enthält zu viele Positionen.');
  return { version, header, planId: header.U.toUpperCase(), page, total, identity, patient, issuer, additional, rows };
}
export function parseMedicationPlanPages(xmlPages: readonly string[]): MedicationPlanDraft {
  if (!xmlPages.length || xmlPages.length > MAX_PAGES) fail('Es wurde kein vollständiger strukturierter Medikationsplan gefunden.');
  const pages = xmlPages.map(parsePage).sort((a, b) => a.page - b.page);
  const first = pages[0];
  if (pages.length !== first.total || pages.some((page, index) => page.page !== index + 1 || page.total !== first.total
    || page.planId !== first.planId || page.version !== first.version || page.header.p !== first.header.p || page.header.l !== first.header.l
    || sortedAttributes(page.patient) !== sortedAttributes(first.patient)
    || sortedAttributes(page.issuer) !== sortedAttributes(first.issuer))) fail('Die Seiten gehören nicht eindeutig zu einem vollständigen Plan. Bitte alle Seiten derselben Fassung hochladen.');
  const rows = pages.flatMap(page => page.rows);
  if (!rows.length || rows.length > MAX_POSITIONS || !rows.some(row => row.kind !== 'note')) fail('Der Plan enthält keine lesbaren Medikationspositionen oder überschreitet die zulässige Anzahl.');
  const draft: MedicationPlanDraft = {
    version: first.version, planId: first.planId, pageCount: pages.length, patient: first.identity,
    issuer: { name: first.issuer.n, printedAt: first.issuer.t, lanr: nullable(first.issuer.lanr) }, rows,
    headers: pages.map(page => ({ page: page.page, patient: page.patient, issuer: page.issuer, additional: page.additional, root: page.header })),
  };
  if (JSON.stringify(draft).length > 350_000) fail('Der strukturierte Medikationsplan ist zu groß.');
  return draft;
}

/** Supabase JSONB may return fields in a different order from the submitted XML. */
export function sameMedicationPlanDraft(left: MedicationPlanDraft, right: MedicationPlanDraft): boolean {
  function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return Object.fromEntries(Object.keys(record).sort().map(key => [key, canonical(record[key])]));
    }
    return value;
  }
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

export function medicationPlanPositionTitle(row: MedicationPlanPosition): string {
  if (row.kind === 'formulation') return 'Rezeptur';
  if (row.kind === 'note') return 'Planhinweis';
  return row.name || row.ingredients.map(item => item.name).join(' + ') || `PZN ${row.pzn}`;
}

export function medicationPlanOriginalFields(row: MedicationPlanPosition): { label: string; value: string }[] {
  const fields: [string, string | null][] = [
    ['Handelsname', row.name], ['PZN', row.pzn],
    ['Wirkstoff und Stärke', row.ingredients.length ? row.ingredients.map(item => `${item.name}${item.strength ? ` · ${item.strength}` : ''}`).join('\n') : null],
    ['Darreichungsform', row.form], ['Darreichungsform (BMP-Code)', row.formCode],
    ['Morgens', row.morning], ['Mittags', row.noon], ['Abends', row.evening], ['Zur Nacht', row.night],
    ['Dosierung im Freitext', row.doseText], ['Wöchentliche Position', row.weekdayCode ? `${BMP_WEEKDAYS[row.weekdayCode] ?? 'Unbekannter Wochentag'} (BMP-Code ${row.weekdayCode})` : null],
    ['Einheit', row.unit], ['Einheit (BMP-Code)', row.unitCode],
    ['Hinweise zur Einnahme', row.instructions], ['Grund', row.indication], [row.kind === 'formulation' ? 'Rezeptur' : 'Zusatztext', row.additionalText],
    ['Rezepturzusatz', row.kind === 'formulation' ? nullable(row.source.attributes.x) : null],
  ];
  return fields.filter((field): field is [string, string] => field[1] !== null).map(([label, value]) => ({ label, value }));
}
