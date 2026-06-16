import { getCatalogLabel } from '@/lib/catalogs/systemCatalogs';

/** PG 1–5, kein Pflegegrad, beantragt, … — never lowercase "pg". */
export function formatCareLevel(grade: string | number | null | undefined): string {
  if (grade === null || grade === undefined || grade === '') return '';
  const raw = String(grade).trim();
  const map: Record<string, string> = {
    kein: 'kein Pflegegrad',
    none: 'kein Pflegegrad',
    unknown: 'unbekannt',
    beantragt: 'beantragt',
    pg1: 'PG 1',
    pg2: 'PG 2',
    pg3: 'PG 3',
    pg4: 'PG 4',
    pg5: 'PG 5',
    'PG 1': 'PG 1',
    'PG 2': 'PG 2',
    'PG 3': 'PG 3',
    'PG 4': 'PG 4',
    'PG 5': 'PG 5',
    abgelehnt: 'abgelehnt',
    unbekannt: 'unbekannt',
    hospiz: 'Hospiz',
  };
  const key = raw.toLowerCase().replace(/\s+/g, '');
  if (map[raw]) return map[raw];
  if (map[key]) return map[key];
  const pgMatch = raw.match(/^pg\s*(\d)$/i);
  if (pgMatch) return `PG ${pgMatch[1]}`;
  const pflegegradMatch = raw.match(/^pflegegrad\s*(\d)$/i);
  if (pflegegradMatch) return `PG ${pflegegradMatch[1]}`;
  if (/^[1-5]$/.test(raw)) return `PG ${raw}`;
  return raw;
}

/** Anrede aus Katalogschlüssel (z. B. herr → Herr). */
export function formatSalutation(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  const trimmed = value.trim();
  const label = getCatalogLabel('salutation', trimmed);
  if (label !== trimmed) return label;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
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
