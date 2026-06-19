const CARE_LEVEL_LABELS: Record<string, string> = {
  kein: 'kein Pflegegrad',
  none: 'kein Pflegegrad',
  beantragt: 'beantragt',
  pg1: 'PG1',
  pg2: 'PG2',
  pg3: 'PG3',
  pg4: 'PG4',
  pg5: 'PG5',
  abgelehnt: 'abgelehnt',
  unbekannt: 'unbekannt',
  unknown: 'unbekannt',
  hospiz: 'Hospiz',
};

const SALUTATION_LABELS: Record<string, string> = {
  herr: 'Herr',
  frau: 'Frau',
  divers: 'Divers',
  keine_angabe: 'Keine Angabe',
  familie: 'Familie',
  eheleute: 'Eheleute',
  firma: 'Firma / Einrichtung',
};

/** Normalisiert PG-Werte für Filter/Vergleich (pg3, PG 3, 3 → pg3). */
export function normalizeCareLevelKey(grade: string | number | null | undefined): string {
  if (grade == null || grade === '') return '';
  const raw = String(grade).trim();
  const compact = raw.toLowerCase().replace(/\s+/g, '');
  if (/^pg\d$/.test(compact)) return compact;
  if (/^\d$/.test(compact)) return `pg${compact}`;
  return compact;
}

/** PG1–5, kein Pflegegrad, beantragt, … */
export function formatCareLevel(grade: string | number | null | undefined): string {
  if (grade == null || grade === '') return '';
  const raw = String(grade).trim();
  const key = normalizeCareLevelKey(raw);
  if (CARE_LEVEL_LABELS[key]) return CARE_LEVEL_LABELS[key];
  if (/^pg\d$/.test(key)) return key.toUpperCase();
  return raw;
}

/** Anrede für Anzeige (herr → Herr, frau → Frau, …). */
export function formatSalutation(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  const trimmed = value.trim();
  const key = trimmed.toLowerCase().replace(/\s+/g, '_');
  if (SALUTATION_LABELS[key]) return SALUTATION_LABELS[key];
  if (/^[a-z]/.test(trimmed)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  return trimmed;
}

/** Einnahmeschema: morgens / mittags / abends / nachts */
export function formatIntakeScheduleLabel(
  morning: boolean,
  noon: boolean,
  evening: boolean,
  night: boolean,
): string {
  const parts: string[] = [];
  if (morning) parts.push('morgens');
  if (noon) parts.push('mittags');
  if (evening) parts.push('abends');
  if (night) parts.push('nachts');
  return parts.length > 0 ? parts.join(' / ') : '—';
}

/** Kurzschema 1-0-0-1 */
export function formatIntakeSchemaShort(
  morning: number,
  noon: number,
  evening: number,
  night: number,
): string {
  return `${morning}-${noon}-${evening}-${night}`;
}
