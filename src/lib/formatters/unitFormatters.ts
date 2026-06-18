/** PG 1–5, kein Pflegegrad, beantragt, … */
export function formatCareLevel(grade: string | null | undefined): string {
  if (!grade) return '';
  const map: Record<string, string> = {
    kein: 'kein Pflegegrad',
    none: 'kein Pflegegrad',
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
  const key = grade.toLowerCase().replace(/\s+/g, '');
  if (map[grade]) return map[grade];
  if (map[key]) return map[key];
  if (/^pg\s*(\d)$/i.test(grade)) {
    return `PG ${grade.match(/\d/)?.[0] ?? ''}`.trim();
  }
  return grade;
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
