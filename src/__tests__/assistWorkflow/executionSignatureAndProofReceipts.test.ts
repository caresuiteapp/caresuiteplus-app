import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  actor: '10000000-0000-4000-8000-000000000011',
  uuid: '10000000-0000-4000-8000-000000000022',
  user: vi.fn(), rpc: vi.fn(), upload: vi.fn(), remove: vi.fn(), existing: vi.fn(),
  row: null as Record<string, any> | null, result: vi.fn(),
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => h.uuid }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({
  auth: { getUser: h.user }, rpc: h.rpc,
  from: () => {
    const profileQuery = { select: () => profileQuery, eq: () => profileQuery,
      maybeSingle: async () => ({ data: { id: h.actor, tenant_id: 'tenant', auth_user_id: 'auth-user' }, error: null }) };
    return profileQuery;
  },
  storage: { from: () => ({ upload: h.upload, remove: h.remove }) },
}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => {
  const q = { insert: (payload: any) => { h.row = payload; return q; }, update: () => q, eq: () => q,
    select: () => q, single: async () => h.result(), maybeSingle: async () => h.result(),
    then: (resolve: any) => Promise.resolve({ error: null }).then(resolve) };
  return q;
} }));
vi.mock('@/lib/assist/assistExecutionPersistenceService', () => ({
  fetchValidVisitSignature: h.existing, isAssistExecutionPersistenceReady: () => true,
}));
vi.mock('@/lib/async/deferredTask', () => ({ scheduleDeferredTask: vi.fn() }));

import { saveVisitSignaturePersistent } from '@/lib/assist/assistVisitSignaturePersistenceService';
import { persistVisitProof } from '@/lib/assist/assistVisitProofPersistenceService';
import { visitProofSnapshotsMatch } from '@/lib/assist/visitProofCompleteness';

const signature = () => ({ visitId: 'visit', signerName: 'Unterschreibende Person', signerRole: 'client',
  payloadHash: 'payload-hash', signatureHash: 'image-hash', signedAt: '2026-10-11T08:30:00Z',
  signedByProfileId: 'auth-user-is-not-a-profile', storagePath: '', signatureDataUrl: 'data:image/png;base64,aGVsbG8=' });
const proof = () => ({ visitId: 'visit', payloadHash: 'proof-hash', payloadSnapshot: { documentation: 'Erledigt' }, signatureId: null });
function readSavedSignature() {
  const row = h.row!;
  return { id: row.id, tenantId: row.tenant_id, visitId: row.visit_id, storagePath: row.storage_path,
    payloadHash: row.payload_hash, signatureHash: row.signature_hash, signedByProfileId: row.signed_by_profile_id,
    isValid: true, signerName: row.signer_name, signerRole: row.signer_role };
}
beforeEach(() => {
  vi.clearAllMocks(); h.row = null;
  vi.stubGlobal('crypto', { randomUUID: () => h.uuid });
  h.user.mockResolvedValue({ data: { user: { id: 'auth-user' } }, error: null });
  h.rpc.mockImplementation(async (name) => ({ data: name === 'current_tenant_id' ? 'tenant' : h.actor, error: null }));
  h.upload.mockResolvedValue({ error: null }); h.remove.mockResolvedValue({ error: null });
  h.existing.mockResolvedValue({ ok: true, data: null });
  h.result.mockImplementation(() => ({ data: { ...h.row, created_at: 'now', updated_at: 'now' }, error: null }));
});
afterEach(() => vi.unstubAllGlobals());

describe('on-device signature write receipt', () => {
  it('resolves the real profile foreign key instead of submitting an auth-user or portal-account id', async () => {
    expect((await saveVisitSignaturePersistent('tenant', signature())).ok).toBe(true);
    expect(h.user).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenCalledWith('resolve_current_profile_id');
    expect(h.row?.signed_by_profile_id).toBe(h.actor);
    expect(h.upload).toHaveBeenCalledTimes(1);
  });
  it.each(['signed out', 'unresolved profile'])('blocks %s before uploading an image', async (failure) => {
    if (failure === 'signed out') h.user.mockResolvedValue({ data: { user: null }, error: null });
    else h.rpc.mockResolvedValue({ data: null, error: null });
    expect((await saveVisitSignaturePersistent('tenant', signature())).ok).toBe(false);
    expect(h.upload).not.toHaveBeenCalled(); expect(h.row).toBeNull();
  });
  it('does not destroy an image when a lost insert reply could hide a committed signature', async () => {
    h.result.mockReturnValue({ data: null, error: { message: 'Failed to fetch' } });
    const result = await saveVisitSignaturePersistent('tenant', signature());
    expect(result.ok).toBe(false); expect(h.remove).not.toHaveBeenCalled();
    expect(h.existing).toHaveBeenCalledTimes(2);
  });
  it('recovers an identical committed row after the transport reply is lost', async () => {
    h.result.mockReturnValue({ data: null, error: { message: 'Failed to fetch' } });
    h.existing.mockResolvedValueOnce({ ok: true, data: null }).mockImplementationOnce(async () => ({ ok: true, data: readSavedSignature() }));
    const result = await saveVisitSignaturePersistent('tenant', signature());
    expect(result.ok).toBe(true); expect(h.remove).not.toHaveBeenCalled();
    expect(h.upload).toHaveBeenCalledTimes(1);
  });
  it('cleans up only a definitively denied new insert', async () => {
    h.result.mockReturnValue({ data: null, error: { code: '42501', message: 'RLS denied' } });
    expect((await saveVisitSignaturePersistent('tenant', signature())).ok).toBe(false);
    expect(h.remove).toHaveBeenCalledWith([h.row?.storage_path]);
  });
  it.each(['tenant_id', 'visit_id', 'signed_by_profile_id', 'signature_hash'])('rejects a mismatched %s receipt', async (field) => {
    h.result.mockImplementation(() => ({ data: { ...h.row, [field]: 'other' }, error: null }));
    expect((await saveVisitSignaturePersistent('tenant', signature())).ok).toBe(false);
  });
});

describe('native proof identity and stored content', () => {
  it('uses an actual UUID when Android has no WebCrypto global', async () => {
    vi.stubGlobal('crypto', undefined);
    const result = await persistVisitProof('tenant', proof());
    expect(result.ok).toBe(true); expect(h.row?.id).toBe(h.uuid);
    expect(h.row?.id).not.toMatch(/^proof-/);
  });
  it.each(['tenant_id', 'visit_id', 'payload_hash', 'signature_id'])('rejects a mismatched %s proof receipt', async (field) => {
    h.result.mockImplementation(() => ({ data: { ...h.row, [field]: 'other' }, error: null }));
    expect((await persistVisitProof('tenant', proof())).ok).toBe(false);
  });
  it('does not reuse a structurally complete proof with stale tasks or documentation', () => {
    const snapshot = { tasks: [{ id: 'task', status: 'open' }], documentation: 'Alt', generatedAt: 'before' };
    expect(visitProofSnapshotsMatch(snapshot, { ...snapshot, generatedAt: 'later' })).toBe(true);
    expect(visitProofSnapshotsMatch(snapshot, { ...snapshot, tasks: [{ id: 'task', status: 'done' }] })).toBe(false);
    expect(visitProofSnapshotsMatch(snapshot, { ...snapshot, documentation: 'Korrigiert' })).toBe(false);
  });
});
