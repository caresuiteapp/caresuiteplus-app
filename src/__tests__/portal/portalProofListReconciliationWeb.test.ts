import { beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ assist: vi.fn(), rows: [] as Record<string, unknown>[], fail: false }));
vi.mock('@/lib/portal/assist/portalAssistVisitProofService', () => ({ listReleasedProofsForClientPortal: f.assist }));
vi.mock('@/lib/client/clientPortalSettingsService', () => ({ fetchClientPortalSettingsResolved: async () => ({ ok: true, data: {} }), canClientPortalSeeFeature: () => true }));
vi.mock('@/lib/services/serviceRunner', () => ({ runService: (fn: () => unknown) => fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: (_client: unknown, table: string) => {
  const query = { select: () => query, eq: () => query, in: () => query, order: () => query,
    range: async (from: number, to: number) => ({ data: table === 'service_records' ? [] : f.rows.slice(from, to + 1), error: f.fail ? { message: 'offline' } : null, count: table === 'service_records' ? 0 : f.rows.length }) };
  return query;
} }));
import { listPortalServiceProofs } from '@/lib/portal/assist/portalServiceProofService.web';
beforeEach(() => {
  f.fail = false;
  f.rows = [{ id: 'p', title: 'Stale mirror', signature_required: true, signed_at: null }];
  f.assist.mockResolvedValue({ ok: true, data: [{ id: 'p', title: 'Signed proof', signatureRequired: false, signedAt: '2026-09-11T10:00:00Z', pdfStoragePath: 'signed.pdf' }] });
});
it('shows one current proof when its portal mirror is stale', async () => {
  const result = await listPortalServiceProofs('t', 'c');
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.data).toEqual([expect.objectContaining({ id: 'p', title: 'Signed proof', signatureRequired: false, status: 'unterschrieben' })]);
});
it('never lets a stale signed mirror hide a pending canonical proof', async () => {
  f.rows = [{ id: 'p', signed_at: '2026-09-10', signature_required: false }];
  f.assist.mockResolvedValue({ ok: true, data: [{ id: 'p', title: 'Pending', signatureRequired: true, signedAt: null }] });
  const result = await listPortalServiceProofs('t', 'c');
  if (!result.ok) throw new Error(result.error);
  expect(result.data).toHaveLength(1); expect(result.data[0].status).toBe('offen');
});
it.each(['mirror', 'proofs'])('reports an incomplete %s source instead of a complete list', async (source) => {
  if (source === 'mirror') f.fail = true;
  else f.assist.mockResolvedValue({ ok: false, error: 'unavailable' });
  expect((await listPortalServiceProofs('t', 'c')).ok).toBe(false);
});
it('does not label a document signed without signature evidence', async () => {
  f.rows = [{ id: 'unknown', title: 'Unknown state' }];
  f.assist.mockResolvedValue({ ok: true, data: [] });
  const result = await listPortalServiceProofs('t', 'c');
  if (!result.ok) throw new Error(result.error);
  expect(result.data[0].status).toBe('offen');
});

it('does not revive a withdrawn or cancelled proof from a stale portal mirror', async () => {
  f.rows = [{ id: 'withdrawn', source: 'assist_visit_proof', signature_required: true }];
  f.assist.mockResolvedValue({ ok: true, data: [] });
  expect(await listPortalServiceProofs('t', 'c')).toEqual({ ok: true, data: [] });
});
