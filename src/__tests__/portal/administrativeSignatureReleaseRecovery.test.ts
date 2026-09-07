import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), latest: vi.fn(), persist: vi.fn(), update: vi.fn(), invalidate: vi.fn() }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: mocks.rpc }) }));
vi.mock('@/lib/portal/resolveEmployeePortalSignatureRequirement', () => ({ resolvePortalSignatureVisitId: async () => 'visit' }));
vi.mock('@/features/assistWorkflow/buildServiceRecordHtml', () => ({ buildServiceRecordSnapshot: () => ({ title: 'Einsatz', documentation: 'Erledigt' }) }));
vi.mock('@/lib/assist/assistVisitProofPersistenceService', () => ({
  computeVisitProofPayloadHash: async () => 'hash', fetchLatestVisitProof: mocks.latest,
  persistVisitProof: mocks.persist, updateVisitProofRow: mocks.update,
}));
vi.mock('@/lib/portal/portalProofCacheSignal', () => ({ invalidatePortalProofCache: mocks.invalidate }));
import { releaseDeferredClientSignatureRequest } from '@/lib/portal/deferredVisitClientSignatureService';

const ctx = { tenantId: 'tenant', assignmentId: 'visit', employeeId: 'employee', profileId: 'profile', detail: { clientId: 'client', title: 'Einsatz', documentationNotes: 'Erledigt' } } as AssistExecutionContext;
const proof = { id: 'proof', status: 'draft', signatureId: null };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.latest.mockResolvedValue({ ok: true, data: proof });
  mocks.rpc.mockResolvedValue({ data: 'proof', error: null });
});

describe('administrative signature release', () => {
  it('publishes through one atomic RPC and confirms its actual document ID', async () => {
    const result = await releaseDeferredClientSignatureRequest(ctx, 'Erledigt', { administrative: true });
    expect(result).toEqual({ ok: true, data: { proofId: 'proof', clientDocumentId: 'proof' } });
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith('admin_release_deferred_signature', expect.objectContaining({ p_tenant_id: 'tenant', p_proof_id: 'proof', p_client_id: 'client' }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });
  it('never turns a rejected or empty RPC response into success', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Keine Berechtigung' } });
    expect(await releaseDeferredClientSignatureRequest(ctx, null, { administrative: true })).toMatchObject({ ok: false, error: 'Keine Berechtigung' });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect((await releaseDeferredClientSignatureRequest(ctx, null, { administrative: true })).ok).toBe(false);
    expect(mocks.invalidate).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('preserves an existing signature and approved proof', async () => {
    for (const existing of [{ ...proof, signatureId: 'signature' }, { ...proof, status: 'approved' }]) {
      mocks.latest.mockResolvedValue({ ok: true, data: existing });
      expect((await releaseDeferredClientSignatureRequest(ctx, null, { administrative: true })).ok).toBe(false);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('keeps the employee release on its restricted employee RPC', async () => {
    expect((await releaseDeferredClientSignatureRequest(ctx)).ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('employee_portal_release_deferred_signature', expect.any(Object));
  });
});
