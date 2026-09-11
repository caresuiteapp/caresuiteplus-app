import { beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ released: vi.fn(), load: vi.fn(), prior: vi.fn(), save: vi.fn(), render: vi.fn(), upload: vi.fn(), rpc: vi.fn(), invalidate: vi.fn(), image: vi.fn() }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/portal/assist/portalAssistVisitProofService', () => ({ getReleasedProofForClientPortal: f.released }));
vi.mock('@/lib/assist/assistVisitProofPersistenceService', () => ({ fetchVisitProofById: f.load, computeVisitProofPayloadHash: async () => 'signed-hash' }));
vi.mock('@/lib/assist/assistVisitSignaturePersistenceService', () => ({ computeSignatureDataHash: async () => 'image-hash', computeVisitSignaturePayloadHash: async () => 'signature-payload', saveVisitSignaturePersistent: f.save, fetchValidVisitSignature: f.prior }));
vi.mock('@/lib/assist/assistProofPdfService', () => ({ renderAssistProofPdfBytes: f.render }));
vi.mock('@/lib/assist/assistExecutionHashService', () => ({ computeSha256Hex: async () => 'pdf-hash' }));
vi.mock('@/lib/assist/visitSignatureImageService', () => ({ resolveVisitSignatureImageUrl: f.image }));
vi.mock('@/lib/portal/portalProofCacheSignal', () => ({ invalidatePortalProofCache: f.invalidate }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: f.rpc, storage: { from: () => ({ upload: f.upload }) } }) }));
import { saveClientPortalAssistProofSignature, retryClientPortalAssistProofDelivery } from '@/lib/portal/clientPortalAssistProofSignatureService.web';
const input = { tenantId: 'tenant', clientId: 'client', proofId: 'proof', signerName: 'Testperson', signatureDataUrl: 'data:image/png;base64,AAAA' };
const signature = { id: 'sig', signedAt: '2026-09-11T10:00:00+00:00', signerName: 'Testperson', payloadHash: 'signature-payload', storagePath: 'signatures/sig.png', metadata: { proofId: 'proof', signedVia: 'client_portal' } };
beforeEach(() => {
  vi.clearAllMocks();
  f.released.mockResolvedValue({ ok: true, data: { signatureRequired: true, portalReleaseStatus: 'pending_client_signature' } });
  f.load.mockResolvedValue({ ok: true, data: { id: 'proof', tenantId: 'tenant', visitId: 'visit', payloadHash: 'original-hash', createdAt: '2026-09-11T09:00:00Z', payloadSnapshot: { title: 'Haushalt', tasks: [] } } });
  f.prior.mockResolvedValue({ ok: true, data: null }); f.save.mockResolvedValue({ ok: true, data: signature });
  f.image.mockResolvedValue('https://example.test/signed-image'); f.render.mockResolvedValue(new Uint8Array([1, 2, 3])); f.upload.mockResolvedValue({ error: null });
  f.rpc.mockResolvedValue({ error: null, data: { proofId: 'proof', signatureId: 'sig', signedAt: '2026-09-11T10:00:00.000Z', proofPersisted: true } });
});
it('renders and uploads the signed PDF before the atomic completion and checks its receipt', async () => {
  expect((await saveClientPortalAssistProofSignature(input)).ok).toBe(true);
  expect(f.render.mock.invocationCallOrder[0]).toBeLessThan(f.upload.mock.invocationCallOrder[0]);
  expect(f.upload.mock.invocationCallOrder[0]).toBeLessThan(f.rpc.mock.invocationCallOrder[0]);
  expect(f.rpc).toHaveBeenCalledWith('client_portal_finalize_assist_proof', expect.objectContaining({ p_expected_payload_hash: 'original-hash', p_signature_id: 'sig' }));
  expect(f.render.mock.calls[0][0].payloadSnapshot.signedAt).toBe('2026-09-11T10:00:00.000Z');
});
it('resumes a captured signature without capturing a second one', async () => {
  f.prior.mockResolvedValue({ ok: true, data: signature });
  expect((await retryClientPortalAssistProofDelivery(input)).ok).toBe(true);
  expect(f.save).not.toHaveBeenCalled(); expect(f.image).toHaveBeenCalledWith(signature.storagePath);
});
it.each(['render', 'upload', 'rpc', 'receipt'])('does not report success on %s failure and refreshes the inbox', async (failure) => {
  if (failure === 'render') f.render.mockRejectedValue(new Error('render failed'));
  if (failure === 'upload') f.upload.mockResolvedValue({ error: { message: 'upload failed' } });
  if (failure === 'rpc') f.rpc.mockResolvedValue({ error: { message: 'conflict' } });
  if (failure === 'receipt') f.rpc.mockResolvedValue({ error: null, data: { proofId: 'other' } });
  expect((await saveClientPortalAssistProofSignature(input)).ok).toBe(false);
  expect(f.invalidate).toHaveBeenCalledOnce();
  if (failure === 'render' || failure === 'upload') expect(f.rpc).not.toHaveBeenCalled();
});
it('deduplicates simultaneous clicks', async () => {
  const first = saveClientPortalAssistProofSignature(input); const second = saveClientPortalAssistProofSignature(input);
  expect(first).toBe(second); await first; expect(f.save).toHaveBeenCalledOnce(); expect(f.rpc).toHaveBeenCalledOnce();
});
it('refuses a document outside the visible client scope before persisting anything', async () => {
  f.released.mockResolvedValue({ ok: true, data: null });
  expect((await saveClientPortalAssistProofSignature(input)).ok).toBe(false);
  expect(f.load).not.toHaveBeenCalled(); expect(f.save).not.toHaveBeenCalled();
});
