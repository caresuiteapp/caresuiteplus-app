import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({
  upload: vi.fn(), insert: vi.fn(), remove: vi.fn(), existing: vi.fn(), user: vi.fn(), rpc: vi.fn(),
  profileId: '00000000-0000-4000-8000-000000000002',
  saved: null as Record<string, unknown> | null,
  insertError: null as { message: string; code?: string } | null,
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000001' }));
vi.mock('@/lib/assist/assistExecutionPersistenceService', () => ({ fetchValidVisitSignature: f.existing, isAssistExecutionPersistenceReady: () => true }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({
  auth: { getUser: f.user }, rpc: f.rpc,
  from: () => {
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: f.profileId, tenant_id: 'tenant', auth_user_id: 'auth-user' }, error: null }) };
    return q;
  },
  storage: { from: () => ({ upload: f.upload, remove: f.remove }) },
}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => ({ insert: (row: Record<string, unknown>) => { f.saved = row; f.insert(row); return { select: () => ({ single: async () => ({ data: f.insertError ? null : row, error: f.insertError }) }) }; } }) }));
import { saveVisitSignaturePersistent } from '@/lib/assist/assistVisitSignaturePersistenceService';
const input = { visitId: 'visit', signerName: 'Testperson', signerRole: 'client', storagePath: '', payloadHash: 'hash', signatureHash: 'image-hash', signedAt: '2026-10-11T09:00:00Z', signatureDataUrl: 'data:image/png;base64,iVBORw0KGgo=' };
beforeEach(() => {
  vi.clearAllMocks(); f.saved = null; f.insertError = null; vi.stubGlobal('crypto', undefined);
  f.user.mockResolvedValue({ data: { user: { id: 'auth-user' } }, error: null });
  f.rpc.mockImplementation(async (name: string) => ({ data: name === 'current_tenant_id' ? 'tenant' : name === 'resolve_current_profile_id' ? f.profileId : null, error: null }));
  f.existing.mockResolvedValue({ ok: true, data: null });
  f.upload.mockResolvedValue({ error: null }); f.remove.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllGlobals());
it('persists a native capture with a verified profile FK, real UUID and binary PNG without browser crypto', async () => {
  expect((await saveVisitSignaturePersistent('tenant', { ...input, signedByProfileId: 'portal-account-is-not-a-profile' })).ok).toBe(true);
  expect(f.insert.mock.calls[0][0].id).toBe('00000000-0000-4000-8000-000000000001');
  expect(f.insert.mock.calls[0][0].signed_by_profile_id).toBe(f.profileId);
  expect(f.rpc).toHaveBeenCalledWith('resolve_current_profile_id'); expect(f.rpc).toHaveBeenCalledWith('current_tenant_id');
  expect(f.upload.mock.calls[0][1]).toBeInstanceOf(ArrayBuffer);
  expect([...new Uint8Array(f.upload.mock.calls[0][1])]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
});
it('cleans up its new image only after a definitively rejected database insert', async () => {
  f.insertError = { code: '42501', message: 'insert denied' };
  expect((await saveVisitSignaturePersistent('tenant', input)).ok).toBe(false);
  expect(f.remove).toHaveBeenCalledWith(['tenant/tenant/assist/visits/visit/signatures/00000000-0000-4000-8000-000000000001.png']);
  expect(f.existing).toHaveBeenCalledTimes(1);
});
it('keeps an image when the insert outcome and its readback remain unconfirmed', async () => {
  f.insertError = { message: 'Failed to fetch' };
  f.existing.mockResolvedValueOnce({ ok: true, data: null }).mockResolvedValueOnce({ ok: false, error: 'readback unavailable' });
  expect((await saveVisitSignaturePersistent('tenant', input)).ok).toBe(false);
  expect(f.existing).toHaveBeenCalledTimes(2); expect(f.remove).not.toHaveBeenCalled();
});
it('recovers the committed signature through readback after losing the insert reply', async () => {
  f.insertError = { message: 'Failed to fetch' };
  f.existing.mockResolvedValueOnce({ ok: true, data: null }).mockImplementationOnce(async () => ({ ok: true, data: {
    id: f.saved!.id, tenantId: f.saved!.tenant_id, visitId: f.saved!.visit_id, storagePath: f.saved!.storage_path,
    payloadHash: f.saved!.payload_hash, signatureHash: f.saved!.signature_hash, signerName: f.saved!.signer_name,
    signerRole: f.saved!.signer_role, signedByProfileId: f.saved!.signed_by_profile_id, isValid: true,
  } }));
  expect((await saveVisitSignaturePersistent('tenant', input)).ok).toBe(true);
  expect(f.existing).toHaveBeenCalledTimes(2); expect(f.upload).toHaveBeenCalledOnce(); expect(f.remove).not.toHaveBeenCalled();
});
