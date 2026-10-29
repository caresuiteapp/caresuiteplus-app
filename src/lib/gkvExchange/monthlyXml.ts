/** PFL_LNW 2.2.0 / logical version 1.2.0. This is a document contract, not an
 * authorization or a conversion of an already confirmed monthly source record.
 * The capture adapter freezes these exact fields before confirmation.
 */
import { isDate, isIk } from './model';

// Do not inherit a future DTA profile's dates while retaining today's XSD.
export const MONTHLY_XML_PROFILE = Object.freeze({ logicalVersion: '1.2.0', schemaVersion: '2.2.0',
  validFrom: '2026-05-01', validUntil: '2027-01-31' } as const);

export type MonthlyXmlLine = {
  code: string; description: string; employeeNumbers: string[];
} & ({ quantity: string; minutes?: never } | { minutes: number; quantity?: never });
export type MonthlyXmlDocument = {
  proofId: string; providerIk: string; month: string; insuranceNumber: string;
  lastName: string; firstName: string; serviceType: '01' | '07' | '10';
  responsibleEmployeeNumber: string;
  days: { date: string; visits: { sequence: number; startTime: string; lines: MonthlyXmlLine[] }[] }[];
  // Type 3 is the WHOLE scanned paper LNW of an absent representative. It is
  // not a cropped image, nor a general permission to export patient paper ink.
  signature: { type: '1'; signedLocalTime: string; fileType: '3'; base64: string }
    | { type: '3'; signedLocalTime?: string; fileType: '2'; base64: string };
};
export type MonthlyXmlContent = Omit<MonthlyXmlDocument, 'proofId' | 'signature'>;
export class MonthlyXmlError extends Error {
  readonly code: string; readonly path: string;
  constructor(code: string, path = '') { super(code); this.name = 'MonthlyXmlError'; this.code = code; this.path = path; }
}
export function monthlyXmlFail(code: string, path = ''): never { throw new MonthlyXmlError(`MONTHLY_XML_${code}`, path); }
type Row = Record<string, unknown>;
function shape(v: unknown, required: string[], optional: string[] = [], path = ''): Row {
  if (!v || typeof v !== 'object' || Array.isArray(v) || required.some(k => !Object.hasOwn(v, k))
    || Object.keys(v).some(k => !required.includes(k) && !optional.includes(k))) monthlyXmlFail('INPUT', path);
  return v as Row;
}
function text(v: unknown, max: number, path: string): asserts v is string {
  if (typeof v !== 'string' || !v.length || v.length > max * 2 || [...v].length > max || v.trim() !== v
    || /[\p{Cc}\p{Cf}\p{Cs}\uFFFE\uFFFF]/u.test(v)) monthlyXmlFail('TEXT', path);
}
function digits(v: unknown, pattern: RegExp, path: string): asserts v is string {
  if (typeof v !== 'string' || !pattern.test(v)) monthlyXmlFail('FIELD', path);
}
const number = (v: unknown, min: number, max: number, path: string) => {
  if (!Number.isSafeInteger(v) || Number(v) < min || Number(v) > max) monthlyXmlFail('FIELD', path);
};
function list(v: unknown, max: number, path: string): unknown[] {
  if (!Array.isArray(v) || !v.length || v.length > max) monthlyXmlFail('LIMIT', path);
  return v;
}
/** Dates are serialized as German local wall time because the GKV field has no
 * offset. The input to this helper remains an explicit UTC instant; never use
 * the browser timezone or append Z to an existing GKV wall time. */
const berlinClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export function monthlyXmlLocalTime(instant: string): string {
  if (typeof instant !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(instant)
    || !Number.isFinite(Date.parse(instant)) || new Date(instant).toISOString() !== instant.replace(/Z$/, instant.includes('.') ? 'Z' : '.000Z')) monthlyXmlFail('TIME');
  const parts = berlinClock.formatToParts(new Date(instant));
  return ['year', 'month', 'day', 'hour', 'minute', 'second'].map(k => parts.find(p => p.type === k)!.value).join('');
}
const localDate = (v: string) => `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`;
function possibleInstants(local: string): number[] {
  const utc = Date.parse(`${localDate(local)}T${local.slice(8,10)}:${local.slice(10,12)}:${local.slice(12,14)}Z`);
  // Berlin has used UTC+1, +2, and historically +3 since 1900. A repeated
  // autumn hour may have two instants; do not invent one for offset-free XML.
  return [1,2,3].map(offset => utc - offset * 3600000)
    .filter(value => Number.isFinite(value) && monthlyXmlLocalTime(new Date(value).toISOString()) === local);
}

function content(value: unknown, checkedAt: string): {value: MonthlyXmlContent; earliestLastStart: number} {
  const now = monthlyXmlLocalTime(checkedAt), day = localDate(now);
  if (day < MONTHLY_XML_PROFILE.validFrom || day > MONTHLY_XML_PROFILE.validUntil) monthlyXmlFail('VERSION');
  const v = shape(value, ['providerIk','month','insuranceNumber','lastName','firstName','serviceType','responsibleEmployeeNumber','days']);
  if (!isIk(v.providerIk)) monthlyXmlFail('FIELD', 'providerIk');
  digits(v.month, /^(?:19|2\d)\d{2}-(?:0[1-9]|1[0-2])$/, 'month');
  if (v.month > day.slice(0,7)) monthlyXmlFail('FUTURE', 'month');
  digits(v.insuranceNumber, /^(?:[A-Z][0-9]{9}|[0-9]{12})$/, 'insuranceNumber');
  text(v.lastName, 45, 'lastName'); text(v.firstName, 45, 'firstName');
  if (!['01','07','10'].includes(String(v.serviceType))) monthlyXmlFail('UNSUPPORTED_PROFILE', 'serviceType');
  digits(v.responsibleEmployeeNumber, /^[0-9]{9}$/, 'responsibleEmployeeNumber');
  let lastDay = '', earliestLastStart = 0, totalLines = 0;
  for (const [di, rawDay] of list(v.days, 31, 'days').entries()) {
    const path = `days.${di}`, d = shape(rawDay, ['date','visits'], [], path);
    if (!isDate(d.date) || d.date.slice(0,7) !== v.month || d.date <= lastDay || d.date > day) monthlyXmlFail('DATE', `${path}.date`);
    lastDay = d.date;
    for (const [vi, rawVisit] of list(d.visits, 99, `${path}.visits`).entries()) {
      const vp = `${path}.visits.${vi}`, visit = shape(rawVisit, ['sequence','startTime','lines'], [], vp);
      if (visit.sequence !== vi + 1) monthlyXmlFail('SEQUENCE', `${vp}.sequence`);
      digits(visit.startTime, /^(?:[01][0-9]|2[0-3])[0-5][0-9]$/, `${vp}.startTime`);
      const starts = possibleInstants(d.date.replaceAll('-', '') + visit.startTime + '00');
      if (!starts.length) monthlyXmlFail('TIME', `${vp}.startTime`);
      const earliest = Math.min(...starts);
      if (earliest > Date.parse(checkedAt)) monthlyXmlFail('FUTURE', vp);
      earliestLastStart = Math.max(earliestLastStart, earliest);
      for (const [li, rawLine] of list(visit.lines, 99, `${vp}.lines`).entries()) {
        if (++totalLines > 10000) monthlyXmlFail('LIMIT', 'days');
        const lp = `${vp}.lines.${li}`, line = shape(rawLine, ['code','description','employeeNumbers'], ['quantity','minutes'], lp);
        // The official XSD uses character classes for these alternatives. That
        // also admits invalid prefixes/commas; enforce the TA3 keys separately.
        digits(line.code, /^(?:01|07|10)(?:01|02|06|07|99)[0-8][0-9a-zA-Z]{1,10}$/, `${lp}.code`);
        if (line.code.slice(0,2) !== v.serviceType) monthlyXmlFail('SERVICE_TYPE', `${lp}.code`);
        text(line.description, 150, `${lp}.description`);
        const remuneration = line.code.slice(2,4), quantity = Object.hasOwn(line, 'quantity'), minutes = Object.hasOwn(line, 'minutes');
        if (quantity === minutes || ['01','06'].includes(remuneration) && !quantity || remuneration === '02' && !minutes) monthlyXmlFail('MEASURE', lp);
        if (quantity) { digits(line.quantity, /^(?:0|[1-9][0-9]{0,3})\.[0-9]{2}$/, `${lp}.quantity`); if (line.quantity === '0.00') monthlyXmlFail('MEASURE', lp); }
        if (minutes) number(line.minutes, 1, 1440, `${lp}.minutes`);
        const employees = list(line.employeeNumbers, 3, `${lp}.employeeNumbers`);
        for (const e of employees) digits(e, /^[0-9]{9}$/, `${lp}.employeeNumbers`);
        if (new Set(employees).size !== employees.length) monthlyXmlFail('DUPLICATE_EMPLOYEE', lp);
      }
    }
  }
  return {value: structuredClone(v) as unknown as MonthlyXmlContent, earliestLastStart};
}
export function readMonthlyXmlContent(value: unknown, checkedAt: string): MonthlyXmlContent { return content(value, checkedAt).value; }
export function readMonthlyXmlDocument(value: unknown, checkedAt: string): MonthlyXmlDocument {
  const v = shape(value, ['proofId','providerIk','month','insuranceNumber','lastName','firstName','serviceType','responsibleEmployeeNumber','days','signature']);
  digits(v.proofId, /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i, 'proofId');
  const {proofId: _id, signature, ...body} = v;
  const {earliestLastStart} = content(body, checkedAt);
  const s = shape(signature, ['type','fileType','base64'], ['signedLocalTime'], 'signature');
  if (s.type !== '1' && s.type !== '3') monthlyXmlFail('UNSUPPORTED_SIGNATURE', 'signature.type');
  if (s.type === '1' && (s.fileType !== '3' || s.signedLocalTime === undefined) || s.type === '3' && s.fileType !== '2') monthlyXmlFail('SIGNATURE', 'signature');
  if (s.signedLocalTime !== undefined) {
    digits(s.signedLocalTime, /^(?:19|2\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12][0-9]|3[01])(?:[01][0-9]|2[0-3])[0-5][0-9][0-5][0-9]$/, 'signature.signedLocalTime');
    if (!isDate(localDate(s.signedLocalTime)) || !possibleInstants(s.signedLocalTime).some(t => t >= earliestLastStart && t <= Date.parse(checkedAt))) monthlyXmlFail('SIGNATURE_TIME', 'signature.signedLocalTime');
  }
  if (typeof s.base64 !== 'string' || !s.base64.length || s.base64.length > 2796204 || s.base64.length % 4 !== 0
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(s.base64)) monthlyXmlFail('BINARY', 'signature.base64');
  return structuredClone(v) as unknown as MonthlyXmlDocument;
}
