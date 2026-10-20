import {validEventInstant} from './medicationAdministrationDomain.ts';

/** Structural reading of an original timestamp, never confirmation of clinical performance. */
export function validMedicationActualTime(value: unknown): value is string {
  return typeof value === 'string' && validEventInstant(value);
}
export type MedicationTimeDisplay = {state:'valid'|'missing'|'invalid';raw:string|null;display:string};
let berlinMedicationTimeFormatter: Intl.DateTimeFormat | null = null;
export function medicationTimeDisplay(value: string | null): MedicationTimeDisplay {
  const raw = typeof value === 'string' ? value : null;
  if (value === null || value === undefined || value === '') return {state:'missing',raw,display:'Nicht bestätigt – Originalzeit fehlt'};
  // A native historical read may use the PostgreSQL space separator. Validate
  // its calendar through the same explicit-zone grammar; preserve the raw text.
  if (typeof value !== 'string' || !validEventInstant(value.replace(' ', 'T'))) return {state:'invalid',raw,display:raw === null ? 'Ungültige Originalzeit – nicht bestätigt' : `Ungültige Originalzeit – nicht bestätigt · Original: ${JSON.stringify(raw)}`};
  const formatter = berlinMedicationTimeFormatter ??= new Intl.DateTimeFormat('de-DE', {timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZoneName:'shortOffset'});
  const parts = formatter.formatToParts(new Date(value.replace(' ', 'T')));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? '';
  const fraction = /[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?/.exec(value)?.[1]?.replace('.', ',') ?? '';
  const readable = `${part('day')}.${part('month')}.${part('year')}, ${part('hour')}:${part('minute')}:${part('second')}${fraction} ${part('timeZoneName')} (Berlin)`;
  return {state:'valid',raw,display:`${readable} · Original: ${raw}`};
}
