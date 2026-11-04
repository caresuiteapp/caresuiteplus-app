import { createHash } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ released: vi.fn(), load: vi.fn(), prior: vi.fn(), save: vi.fn(), render: vi.fn(), upload: vi.fn(), download: vi.fn(), rpc: vi.fn(), invalidate: vi.fn(), image: vi.fn() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'native-upload-uuid' }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/portal/assist/portalAssistVisitProofService', () => ({ getReleasedProofForClientPortal: f.released }));
vi.mock('@/lib/assist/assistVisitProofPersistenceService', () => ({ fetchVisitProofById: f.load, computeVisitProofPayloadHash: async (snap: Record<string, unknown>) => 'sha256:' + (snap.signedViaClientPortal ? 'b' : 'a').repeat(64) }));
vi.mock('@/lib/assist/assistVisitSignaturePersistenceService', () => ({ computeSignatureDataHash: async () => 'image-hash', computeVisitSignaturePayloadHash: async () => 'signature-payload', saveVisitSignaturePersistent: f.save, fetchValidVisitSignature: f.prior }));
vi.mock('@/lib/assist/assistProofPdfService', () => ({ renderAssistProofPdfBytes: f.render }));
vi.mock('@/lib/assist/visitSignatureImageService', () => ({ resolveVisitSignatureImageUrl: f.image }));
vi.mock('@/lib/portal/portalProofCacheSignal', () => ({ invalidatePortalProofCache: f.invalidate }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: f.rpc, storage: { from: () => ({ upload: f.upload, download: f.download }) } }) }));
import { saveClientPortalAssistProofSignature, retryClientPortalAssistProofDelivery } from '@/lib/portal/clientPortalAssistProofSignatureService.web';
const input = { tenantId: 'tenant', clientId: 'client', proofId: 'proof', signerName: 'Testperson', signatureDataUrl: 'data:image/png;base64,AAAA' };
const signature = { id: 'sig', signedAt: '2026-09-11T10:00:00+00:00', signerName: 'Testperson', payloadHash: 'signature-payload', storagePath: 'signatures/sig.png', metadata: { proofId: 'proof', signedVia: 'client_portal', proofPayloadHash: 'sha256:' + 'a'.repeat(64) } };
beforeEach(() => {
  vi.clearAllMocks();
  f.released.mockResolvedValue({ ok: true, data: { signatureRequired: true, portalReleaseStatus: 'pending_client_signature' } });
  f.load.mockResolvedValue({ ok: true, data: { id: 'proof', tenantId: 'tenant', visitId: 'visit', payloadHash: 'sha256:' + 'a'.repeat(64), createdAt: '2026-09-11T09:00:00Z', payloadSnapshot: { title: 'Haushalt', visitId: 'visit', clientId: 'client', tasks: [] } } });
  f.prior.mockResolvedValue({ ok: true, data: null }); f.save.mockResolvedValue({ ok: true, data: signature });
  f.image.mockResolvedValue('https://example.test/signed-image'); f.render.mockResolvedValue(new Uint8Array([0, 37, 80, 68, 70, 45, 128, 254, 255, 10, 33]).subarray(1,10)); f.upload.mockResolvedValue({ error: null });
  f.download.mockResolvedValue({error:null,data:new Blob([new Uint8Array([37,80,68,70,45,128,254,255,10])])});
  f.rpc.mockResolvedValue({ error: null, data: { proofId: 'proof', signatureId: 'sig', signedAt: '2026-09-11T10:00:00.000Z', proofPersisted: true } });
});
it('renders and uploads the signed PDF before the atomic completion and checks its receipt', async () => {
  expect((await saveClientPortalAssistProofSignature(input)).ok).toBe(true);
  expect(f.render.mock.invocationCallOrder[0]).toBeLessThan(f.upload.mock.invocationCallOrder[0]);
  expect(f.upload.mock.invocationCallOrder[0]).toBeLessThan(f.rpc.mock.invocationCallOrder[0]);
  expect(f.rpc).toHaveBeenCalledWith('client_portal_finalize_assist_proof', expect.objectContaining({ p_expected_payload_hash: 'sha256:' + 'a'.repeat(64), p_signature_id: 'sig' }));
  const uploaded = new Uint8Array(f.upload.mock.calls[0][1] as ArrayBuffer);
  expect([...uploaded]).toEqual([37, 80, 68, 70, 45, 128, 254, 255, 10]);
  expect(f.rpc.mock.calls[0][1].p_pdf_hash).toBe('sha256:' + createHash('sha256').update(uploaded).digest('hex'));
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
it('refuses a proof changed since the client opened the signature dialog', async () => {
  expect((await saveClientPortalAssistProofSignature({ ...input, expectedPayloadHash: 'previous-visible-hash' })).ok).toBe(false);
  expect(f.save).not.toHaveBeenCalled();
  expect(f.upload).not.toHaveBeenCalled();
  expect(f.rpc).not.toHaveBeenCalled();
});

it('refuses altered preview content before capturing a signature', async () => {
  const proof = (await f.load()).data;
  f.load.mockResolvedValue({ok:true,data:{...proof,payloadHash:'sha256:'+'c'.repeat(64)}});
  expect((await saveClientPortalAssistProofSignature(input)).ok).toBe(false);
  expect(f.save).not.toHaveBeenCalled();expect(f.upload).not.toHaveBeenCalled();
});
it.each(['confirmed','denied','other-signature'])('checks an existing completion with the server: %s', async state=>{
  const proof=(await f.load()).data;
  f.released.mockResolvedValue({ok:true,data:{signatureRequired:false,portalReleaseStatus:'released'}});
  f.load.mockResolvedValue({ok:true,data:{...proof,signatureId:'sig',pdfStoragePath:'tenant/tenant/assist/visits/visit/proofs/proof-sig-stored.pdf',pdfHash:'sha256:'+createHash('sha256').update(new Uint8Array([37,80,68,70,45,128,254,255,10])).digest('hex'),
    payloadHash:'sha256:'+'b'.repeat(64),payloadSnapshot:{...proof.payloadSnapshot,signedViaClientPortal:true,
    clientPortalPdfSignatureId:'sig',clientPortalSignedAt:'2026-09-11T10:00:00.000Z'}}});
  if(state==='denied')f.rpc.mockResolvedValue({error:'denied',data:null});
  if(state==='other-signature')f.rpc.mockResolvedValue({error:null,data:{proofId:'proof',signatureId:'other',signedAt:'2026-09-11T10:00:00.000Z',proofPersisted:true}});
  expect((await retryClientPortalAssistProofDelivery(input)).ok).toBe(state==='confirmed');
  expect(f.rpc).toHaveBeenCalledOnce();expect(f.save).not.toHaveBeenCalled();expect(f.upload).not.toHaveBeenCalled();
});

it.each(['different-bytes','absent'])('keeps the captured signature pending when PDF read-back fails: %s', async cause=>{
  f.download.mockResolvedValue(cause==='absent'?{data:null,error:'missing'}:{data:new Blob(['%PDF-wrong bytes']),error:null});
  const result=await saveClientPortalAssistProofSignature(input);
  expect(result.ok).toBe(false);expect(f.upload).toHaveBeenCalledOnce();expect(f.download).toHaveBeenCalledOnce();expect(f.rpc).not.toHaveBeenCalled();
});
