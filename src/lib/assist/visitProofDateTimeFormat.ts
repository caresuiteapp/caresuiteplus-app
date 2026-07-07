const LOCALE = 'de-DE';

const DATE_TIME_OPTS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
};

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(LOCALE, DATE_TIME_OPTS);
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(LOCALE, TIME_OPTS);
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(LOCALE, DATE_OPTS);
  } catch {
    return iso;
  }
}

function parseIso(iso: string): Date | null {
  try {
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Builds a local ISO datetime from YYYY-MM-DD + HH:MM (display-only). */
export function toVisitProofLocalDateTimeIso(
  date: string | null | undefined,
  time: string | null | undefined,
): string | null {
  if (!date?.trim() || !time?.trim()) return null;
  const trimmedDate = date.trim();
  const trimmedTime = time.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmedTime);
  if (!match) return null;
  return `${trimmedDate}T${match[1].padStart(2, '0')}:${match[2]}:00`;
}

/**
 * Formats planned proof time ranges for Leistungsnachweis v2 (display only).
 * Same day: DD.MM.YYYY, HH:mm–HH:mm
 * Cross day: DD.MM.YYYY, HH:mm – DD.MM.YYYY, HH:mm
 */
export function formatVisitProofDateTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const startValue = start?.trim() || null;
  const endValue = end?.trim() || null;

  if (!startValue && !endValue) return 'Nicht dokumentiert';
  if (startValue && !endValue) return formatDateTime(startValue);
  if (!startValue && endValue) return `bis ${formatDateTime(endValue)}`;

  const startDate = parseIso(startValue);
  const endDate = parseIso(endValue!);
  if (!startDate || !endDate) return 'Nicht dokumentiert';

  if (isSameCalendarDay(startDate, endDate)) {
    return `${formatDate(startValue)}, ${formatTime(startValue)}–${formatTime(endValue!)}`;
  }

  return `${formatDateTime(startValue)} – ${formatDateTime(endValue!)}`;
}
