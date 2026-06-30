function formatTimeParts(hours: number, minutes: number): string | null {
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Normalizes free-form time input to HH:MM. Invalid input is returned unchanged. */
export function normalizeTimeInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    return formatTimeParts(Number(colonMatch[1]), Number(colonMatch[2])) ?? trimmed;
  }

  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{2})$/);
  if (dotMatch) {
    return formatTimeParts(Number(dotMatch[1]), Number(dotMatch[2])) ?? trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (/^\d{3}$/.test(digits)) {
    return formatTimeParts(Number(digits[0]), Number(digits.slice(1))) ?? trimmed;
  }
  if (/^\d{4}$/.test(digits)) {
    return formatTimeParts(Number(digits.slice(0, 2)), Number(digits.slice(2))) ?? trimmed;
  }

  return trimmed;
}

/** True when value is a valid HH:MM time in normalized form. */
export function isNormalizedTimeInput(value: string): boolean {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}
