import type { ServiceResult } from '@/types';

type Page<T> = { data: T[] | null; error: { message?: string } | null; count: number | null };
/** Exact totals prevent a server row cap or a failed page from hiding pending work. */
export async function fetchAllPortalRows<T extends { id: unknown }>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
): Promise<ServiceResult<T[]>> {
  const rows: T[] = [];
  const seen = new Set<unknown>();
  let expected: number | null = null;
  try {
    for (;;) {
      const page = await fetchPage(rows.length, rows.length + 199);
      if (page.error) throw new Error(page.error.message);
      if (page.count == null || (expected !== null && expected !== page.count)) {
        throw new Error('Die Liste hat sich geändert. Bitte erneut laden.');
      }
      expected = page.count;
      for (const row of page.data ?? []) {
        if (!row.id || seen.has(row.id)) throw new Error('Die Liste konnte nicht vollständig geladen werden.');
        seen.add(row.id);
        rows.push(row);
      }
      if (rows.length === expected) return { ok: true, data: rows };
      if (!page.data?.length || rows.length > expected) throw new Error('Die Liste konnte nicht vollständig geladen werden.');
    }
  } catch {
    return { ok: false, error: 'Ihre Dokumente konnten nicht vollständig geprüft werden. Bitte erneut laden.' };
  }
}
