import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, unknown>[]>, failTable: '', failAfter: 0, cap: 500, queries: [] as { table: string; tenant: string; from: number }[] }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/errors', () => ({ toGermanSupabaseError: (e: { message: string }) => e.message }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  let from = 0, to = 499, tenant = ''; let ids: string[] | undefined;
  const q = {
    select: () => q, eq: (key: string, value: string) => { if (key === 'tenant_id') tenant = value; return q; },
    in: (_key: string, value: string[]) => { ids = value; return q; },
    order: () => q, range: (start: number, end: number) => { from = start; to = end; return q; },
    then: (resolve: (value: unknown) => void) => {
      state.queries.push({ table, tenant, from });
      const rows = (state.rows[table] ?? []).filter(r => !ids || ids.includes(String(r.id)));
      const error = table === state.failTable && from >= state.failAfter ? { message: 'Netzwerkfehler' } : null;
      return Promise.resolve({ data: error ? null : rows.slice(from, Math.min(to + 1, from + state.cap)), error, count: rows.length }).then(resolve);
    },
  }; return q;
} }));
import { loadProofReviewDataset } from '@/lib/assist/proofReviewService.web';
beforeEach(() => { state.rows = {}; state.queries = []; state.failTable = ''; state.failAfter = 0; state.cap = 500; });
describe('complete tenant-scoped proof review loading', () => {
  it('loads more than 200 proofs and follows a lower server page limit', async () => {
    state.rows.assist_visit_proofs = Array.from({ length: 620 }, (_, i) => ({ id: `proof${i}`, tenant_id: 'tenantA', visit_id: `visit${i}`, payload_snapshot: {} }));
    state.rows.client_documents = state.rows.assist_visit_proofs.map(p => ({ id: p.id }));
    state.cap = 75;
    const result = await loadProofReviewDataset('tenantA');
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.data.proofs).toHaveLength(620); expect(result.data.documents).toHaveLength(620); }
    expect(state.queries.every(q => q.tenant === 'tenantA')).toBe(true);
    expect(state.queries.some(q => q.table === 'assist_visit_proofs' && q.from === 600)).toBe(true);
  });
  it('fails the entire reconciliation when a proof page or signature source fails', async () => {
    state.rows.assist_visit_proofs = Array.from({ length: 600 }, (_, i) => ({ id: `proof${i}` }));
    state.failTable = 'assist_visit_proofs'; state.failAfter = 500;
    expect((await loadProofReviewDataset('tenantA')).ok).toBe(false);
    state.failTable = 'assist_visit_signatures'; state.failAfter = 0;
    expect((await loadProofReviewDataset('tenantA')).ok).toBe(false);
  });
  it('never starts a query without a tenant', async () => {
    expect((await loadProofReviewDataset('')).ok).toBe(false); expect(state.queries).toHaveLength(0);
  });
});
