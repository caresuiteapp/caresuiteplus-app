const BERLIN_TIME_ZONE = 'Europe/Berlin';

export function berlinDateKey(value: string | Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: BERLIN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function berlinToday(): string {
  return berlinDateKey(new Date());
}

export function berlinDateTimeInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: BERLIN_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export function isLogbookTripInBerlinRange(startedAt: string, from: string, to: string): boolean {
  const date = berlinDateKey(startedAt);
  return Boolean(date) && (!from || date >= from) && (!to || date <= to);
}
