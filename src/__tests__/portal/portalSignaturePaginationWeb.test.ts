import { expect, it, vi } from 'vitest';
import { fetchAllPortalRows } from '@/lib/portal/fetchAllPortalRows.web';
it('loads all 620 rows even when the server caps pages at 75', async () => {
  const rows = Array.from({ length: 620 }, (_, id) => ({ id: String(id) }));
  const page = vi.fn(async (from: number) => ({ data: rows.slice(from, from + 75), count: 620, error: null }));
  const result = await fetchAllPortalRows(page);
  expect(result).toEqual({ ok: true, data: rows }); expect(page).toHaveBeenCalledTimes(9);
});
it.each(['error', 'empty', 'duplicate', 'missing_count', 'changed_count'])('never reports a complete inbox for %s', async (failure) => {
  let calls = 0;
  const result = await fetchAllPortalRows(async () => {
    if (!calls++) return { data: [{ id: '1' }], count: 2, error: null };
    return { data: failure === 'empty' ? [] : [{ id: failure === 'duplicate' ? '1' : '2' }], count: failure === 'missing_count' ? null : failure === 'changed_count' ? 3 : 2, error: failure === 'error' ? { message: 'offline' } : null };
  });
  expect(result.ok).toBe(false);
});
