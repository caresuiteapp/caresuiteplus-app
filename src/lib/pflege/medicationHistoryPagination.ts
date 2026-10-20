/** Defensive pagination for append-only medication history. No network or clinical decisions. */
export type MedicationHistoryCursor = { id: string; createdAt: string; microseconds: bigint };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function medicationHistoryCursor(row: Record<string, unknown>): MedicationHistoryCursor {
  const id = row.id, createdAt = row.created_at;
  if (typeof id !== 'string' || !uuid.test(id) || typeof createdAt !== 'string') throw Error('Ungültiger Medikationsverlauf. Daten erneut laden.');
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.(\d{1,6}))?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(createdAt);
  const milliseconds = Date.parse(createdAt);
  if (!match || match[1].startsWith('0000') || !Number.isFinite(milliseconds) || new Date(`${match[1]}T12:00:00Z`).toISOString().slice(0, 10) !== match[1]) throw Error('Ungültiger Zeitstempel im Medikationsverlauf.');
  const remainder = (match[3] ?? '').padEnd(6, '0').slice(3);
  return { id: id.toLowerCase(), createdAt, microseconds: BigInt(milliseconds) * 1000n + BigInt(remainder) };
}

/** PostgreSQL timestamp/UUID ordering, including precision below one millisecond. */
export function compareMedicationHistory(a: MedicationHistoryCursor, b: MedicationHistoryCursor) {
  if (a.microseconds !== b.microseconds) return a.microseconds < b.microseconds ? -1 : 1;
  return a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
}

export function medicationHistoryFilter(cursor: MedicationHistoryCursor) {
  const safe = medicationHistoryCursor({ id: cursor.id, created_at: cursor.createdAt });
  // PostgREST reserves ':' and '.'; supabase-js encodes these literal quotes.
  const time = `"${safe.createdAt}"`;
  return `created_at.lt.${time},and(created_at.eq.${time},id.lt.${safe.id})`;
}

export async function loadCompleteMedicationHistory<T extends Record<string, unknown>>(
  loadPage: (cursor: MedicationHistoryCursor | null) => Promise<unknown>,
  tenantId: string,
  belongsToScope: (row: T) => boolean,
): Promise<T[]> {
  const rows: T[] = [], seen = new Set<string>();
  let previous: MedicationHistoryCursor | null = null;
  for (;;) {
    const page = await loadPage(previous);
    if (!Array.isArray(page)) throw Error('Der Medikationsverlauf konnte nicht vollständig geladen werden.');
    if (!page.length) return rows;
    for (const value of page) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Ungültiger Eintrag im Medikationsverlauf.');
      const row = value as T;
      if (row.tenant_id !== tenantId || !belongsToScope(row)) throw Error('Der Medikationsverlauf ist dieser Akte nicht eindeutig zugeordnet.');
      const cursor = medicationHistoryCursor(row);
      if (seen.has(cursor.id) || (previous && compareMedicationHistory(cursor, previous) >= 0)) throw Error('Der Medikationsverlauf enthält doppelte oder falsch sortierte Einträge. Bitte neu laden.');
      seen.add(cursor.id); rows.push(row); previous = cursor;
    }
    // A short page is not the end: server limits can be lower than the requested size.
  }
}
