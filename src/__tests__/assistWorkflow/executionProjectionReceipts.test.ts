import { beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ resolve: vi.fn(), result: vi.fn(), payload: null as Record<string, unknown> | null }));
vi.mock('@/lib/assist/assistExecutionVisitResolver', () => ({ resolveAssistVisitIdForPersistence: h.resolve }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => {
  const q = { upsert: (payload: Record<string, unknown>) => { h.payload = payload; return q; }, select: () => q, maybeSingle: () => h.result() }; return q;
} }));
import { upsertAssistVisitExecutionState } from '@/features/assistWorkflow/assistVisitExecutionStatePersistence';
beforeEach(() => { vi.clearAllMocks(); h.payload = null; h.resolve.mockResolvedValue('visit');
  h.result.mockImplementation(async () => ({ data: { ...h.payload, updated_at: '2026-10-11T13:00:00.123456+00:00' }, error: null })); });
it('returns the actual server version only for a matching stored projection receipt', async () => {
  expect(await upsertAssistVisitExecutionState('tenant', 'assignment', 'unterschrift_offen', { signatureComplete: true, proofGenerated: true }))
    .toEqual({ ok: true, data: { visitId: 'visit', currentStep: 'signature', updatedAt: '2026-10-11T13:00:00.123456+00:00' } });
});
it.each(['tenant_id', 'visit_id', 'assignment_status', 'current_step', 'signature_complete', 'proof_generated', 'updated_at'])('rejects an absent/foreign/newer %s receipt', async field => {
  h.result.mockImplementation(async () => ({ data: { ...h.payload, [field]: field === 'signature_complete' || field === 'proof_generated' ? false : 'foreign' }, error: null }));
  expect((await upsertAssistVisitExecutionState('tenant', 'assignment', 'unterschrift_offen', { signatureComplete: true, proofGenerated: true })).ok).toBe(false);
});
it('never treats an unresolved visit, zero-row result or missing schema as stored success', async () => {
  h.resolve.mockResolvedValue(null); expect((await upsertAssistVisitExecutionState('tenant', 'assignment', 'angekommen')).ok).toBe(false); expect(h.payload).toBeNull();
  h.resolve.mockResolvedValue('visit'); h.result.mockResolvedValue({ data: null, error: null });
  expect((await upsertAssistVisitExecutionState('tenant', 'assignment', 'angekommen')).ok).toBe(false);
  h.result.mockResolvedValue({ data: null, error: { code: '42P01', message: 'missing table' } });
  expect((await upsertAssistVisitExecutionState('tenant', 'assignment', 'angekommen')).ok).toBe(false);
});
