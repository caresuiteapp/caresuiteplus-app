import type { ServiceResult } from '@/types';
export type CarePlanRow = Record<string, unknown>;
const incomplete = 'Pflegeplandaten konnten nicht vollständig und eindeutig gelesen werden. Bitte erneut laden.';
/** Bounded counted pages, not an atomic database snapshot. Never return a partial list as complete. */
export async function readCompleteCarePlanRows(
  readPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown; count: number | null }>,
  accept: (row: CarePlanRow) => boolean,
): Promise<ServiceResult<CarePlanRow[]>> {
  const rows: CarePlanRow[] = [], seen = new Set<string>();
  let expected: number | null = null;
  try {
    for (let offset = 0; offset < 100_000; offset += 500) {
      const page = await readPage(offset, offset + 499);
      if (page.error !== null || !Array.isArray(page.data) || !Number.isSafeInteger(page.count) || page.count === null || page.count < 0 || page.count > 100_000) throw Error(incomplete);
      if (expected !== null && expected !== page.count) throw Error(incomplete);
      expected = page.count;
      if (page.data.length !== Math.min(500, Math.max(0, expected - offset))) throw Error(incomplete);
      for (const value of page.data) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(incomplete);
        const row = value as CarePlanRow;
        if (typeof row.id !== 'string' || !row.id || row.id.trim() !== row.id || seen.has(row.id) || !accept(row)) throw Error(incomplete);
        seen.add(row.id); rows.push(row);
      }
      if (rows.length === expected) return { ok: true, data: rows };
    }
  } catch { /* Reject missing counts, truncation, drift and failed pages together. */ }
  return { ok: false, error: incomplete };
}
