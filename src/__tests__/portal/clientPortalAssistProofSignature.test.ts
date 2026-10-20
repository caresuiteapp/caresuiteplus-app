import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ save: vi.fn(), load: vi.fn(), rpc: vi.fn(), upload: vi.fn() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'native-uuid' }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/portal/assist/portalAssistVisitProofService', () => ({ getReleasedProofForClientPortal: async () => ({ ok: true, data: { signatureRequired: true, portalReleaseStatus: 'pending_client_signature' } }) }));
vi.mock('@/lib/assist/assistVisitProofPersistenceService', () => ({ fetchVisitProofById: f.load, computeVisitProofPayloadHash: async () => 'signed-hash' }));
vi.mock('@/lib/assist/assistVisitSignaturePersistenceService', () => ({ computeSignatureDataHash: async () => 'image-hash', computeVisitSignaturePayloadHash: async () => 'payload-hash', fetchValidVisitSignature: async () => ({ ok: true, data: null }), saveVisitSignaturePersistent: f.save }));
vi.mock('@/lib/assist/assistProofPdfService', () => ({ renderAssistProofPdfBytes: async () => new Uint8Array([37, 80, 68, 70]) }));
vi.mock('@/lib/assist/assistExecutionHashService', () => ({ computeSha256Hex: async () => 'pdf-hash' }));
vi.mock('@/lib/assist/visitSignatureImageService', () => ({ resolveVisitSignatureImageUrl: vi.fn() }));
vi.mock('@/lib/portal/portalProofCacheSignal', () => ({ invalidatePortalProofCache: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: f.rpc, storage: { from: () => ({ upload: f.upload }) } }) }));
import { saveClientPortalAssistProofSignature } from '@/lib/portal/clientPortalAssistProofSignatureService';
const input = { tenantId: 'tenant', clientId: 'client', proofId: 'proof', profileId: 'portal-account', signerName: 'Testperson', signatureDataUrl: 'data:image/png;base64,AAAA' };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('crypto', undefined);
  f.load.mockResolvedValue({ ok: true, data: { id: 'proof', tenantId: 'tenant', visitId: 'canonical-visit', payloadHash: 'original-hash', createdAt: '2026-09-11T09:00:00Z', payloadSnapshot: { assignmentId: 'legacy-assignment', tasks: [] } } });
  f.save.mockResolvedValue({ ok: true, data: { id: 'signature', signerName: 'Testperson', signedAt: '2026-09-11T10:00:00Z' } });
  f.upload.mockResolvedValue({ error: null });
  f.rpc.mockResolvedValue({ error: null, data: { proofId: 'proof', signatureId: 'signature', signedAt: '2026-09-11T10:00:00Z', proofPersisted: true } });
});
afterEach(() => vi.unstubAllGlobals());
it('finishes without browser crypto, uploads binary bytes, and uses the canonical visit', async () => {
  expect((await saveClientPortalAssistProofSignature(input)).ok).toBe(true);
  const [storagePath, bytes, options] = f.upload.mock.calls[0];
  expect(storagePath).toBe('tenant/tenant/assist/visits/canonical-visit/proofs/proof-signature-native-uuid.pdf');
  expect(bytes).toBeInstanceOf(ArrayBuffer);
  expect([...new Uint8Array(bytes)]).toEqual([37, 80, 68, 70]);
  expect(options.upsert).toBe(false);
  expect(f.save.mock.calls[0][1].visitId).toBe('canonical-visit');
  expect(f.save.mock.calls[0][1].signedByProfileId).toBeNull();
});
it('does not report completion when the workflow transaction fails', async () => {
  f.rpc.mockResolvedValue({ data: null, error: { message: 'workflow denied' } });
  expect((await saveClientPortalAssistProofSignature(input)).ok).toBe(false);
});
