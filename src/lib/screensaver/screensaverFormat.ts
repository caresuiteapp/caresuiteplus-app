export function formatScreensaverClock(
  date: Date,
  use24h: boolean,
  showSeconds: boolean,
): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !use24h,
  };
  if (showSeconds) options.second = '2-digit';
  return new Intl.DateTimeFormat('de-DE', options).format(date);
}

export function formatGermanWeekday(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(date);
}

export function formatGermanDateLong(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}
