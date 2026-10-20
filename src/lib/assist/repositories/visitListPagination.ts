import type { PostgrestError } from '@supabase/supabase-js';
type Page = { data: unknown[] | null; error: Pick<PostgrestError, 'message' | 'code' | 'details' | 'hint'> | null };
/** Read every page; never present a partial list as successful after a page fails. */
export async function readAllVisitPages(fetchPage: (from: number, to: number) => PromiseLike<Page>): Promise<Page> {
  const data: unknown[] = [];
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const result = await fetchPage(offset, offset + pageSize - 1);
    if (result.error) return { data: null, error: result.error };
    const page = result.data ?? [];
    data.push(...page);
    if (page.length < pageSize) return { data, error: null };
  }
}
