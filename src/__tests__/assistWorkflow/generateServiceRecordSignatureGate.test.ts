import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';
const h = vi.hoisted(() => ({ signature: vi.fn(), persist: vi.fn(), prepare: vi.fn() }));
vi.mock('@/lib/assist/assistVisitSignaturePersistenceService', () => ({ fetchValidVisitSignature: h.signature }));
vi.mock('@/lib/portal/employeePortalVisitTrackingPersistence', () => ({ persistEmployeePortalVisitProof: h.persist }));
vi.mock('@/lib/assist/repositories/assignmentRepository.supabase', () => ({ assignmentSupabaseRepository: { prepareServiceRecord: h.prepare } }));
vi.mock('@/lib/assist/visitSignatureImageService', () => ({ resolveVisitSignatureImageUrl: async () => null }));
vi.mock('@/lib/signatures/signatureOrientation', () => ({ probeSignatureImageDimensions: vi.fn() }));
vi.mock('@/features/assistWorkflow/buildServiceRecordHtml', () => ({
  buildServiceRecordHtml: () => '<p>Nachweis</p>', buildServiceRecordSnapshot: () => ({ documentation: 'Erledigt' }),
}));
import { generateServiceRecord } from '@/features/assistWorkflow/generateServiceRecord';
import { canonicalJsonStringify, computeSha256Hex } from '@/lib/assist/assistExecutionHashService';
import { buildVisitSignaturePayload } from '@/features/assistWorkflow/workflowWriteExpectation';
const ctx = { tenantId: 'tenant', assistVisitId: 'visit', assignmentId: 'visit', employeeId: 'employee',
  detail: { title: 'Begleitung', clientId: 'client', plannedStartAt: '2026-10-11T08:00:00Z', plannedEndAt: '2026-10-11T09:00:00Z',
    tasks: [{ id: 'task', status: 'done' }], documentationNotes: 'Erledigt' } } as AssistExecutionContext;
async function currentSignature() {
  return { id: 'signature', tenantId: ctx.tenantId, visitId: ctx.assistVisitId, isValid: true,
    payloadHash: await computeSha256Hex(canonicalJsonStringify(buildVisitSignaturePayload(ctx))),
    signatureHash: 'image-hash', signerName: 'Name', signerRole: 'client', signedAt: '2026-10-11', storagePath: 'image' };
}
beforeEach(() => {
  vi.clearAllMocks();
  h.persist.mockResolvedValue({ ok: true }); h.prepare.mockResolvedValue({ ok: true, data: { id: 'record' } });
});
describe('final proof signature read contract', () => {
  it('does not produce an unsigned proof when a signature read failed', async () => {
    h.signature.mockResolvedValue({ ok: false, error: 'Server nicht erreichbar' });
    expect((await generateServiceRecord(ctx, 'Erledigt', { requireSignature: true })).ok).toBe(false);
    expect(h.persist).not.toHaveBeenCalled(); expect(h.prepare).not.toHaveBeenCalled();
  });
  it('requires a fresh signature if the former one was invalidated between readiness and proof generation', async () => {
    h.signature.mockResolvedValue({ ok: true, data: null });
    expect((await generateServiceRecord(ctx, 'Erledigt', { requireSignature: true })).ok).toBe(false);
    expect(h.persist).not.toHaveBeenCalled();
  });
  it('still projects documentation before a signature exists', async () => {
    h.signature.mockResolvedValue({ ok: true, data: null });
    expect((await generateServiceRecord(ctx, 'Erledigt')).ok).toBe(true);
    expect(h.persist).toHaveBeenCalledWith(expect.anything(), expect.anything(), null);
  });
  it('links the confirmed current signature to the final proof', async () => {
    h.signature.mockResolvedValue({ ok: true, data: await currentSignature() });
    expect((await generateServiceRecord(ctx, 'Erledigt', { requireSignature: true })).ok).toBe(true);
    expect(h.persist).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'signature');
  });
  it.each(['tenantId', 'visitId', 'payloadHash', 'signatureHash', 'isValid'])('does not attach an unrelated or unverified %s signature', async field => {
    const signature = await currentSignature();
    h.signature.mockResolvedValue({ ok: true, data: { ...signature, [field]: field === 'isValid' ? false : field === 'signatureHash' ? '' : 'wrong' } });
    expect((await generateServiceRecord(ctx, 'Erledigt', { requireSignature: true })).ok).toBe(false);
    expect(h.persist).not.toHaveBeenCalled(); expect(h.prepare).not.toHaveBeenCalled();
  });
  it.each(['documentation', 'tasks', 'client', 'plannedTimes'])('rejects a still-valid former image when current %s changed', async field => {
    h.signature.mockResolvedValue({ ok: true, data: await currentSignature() });
    const detail = { ...ctx.detail };
    let text = 'Erledigt';
    if (field === 'documentation') text = 'Neue Dokumentation';
    if (field === 'tasks') detail.tasks = [{ ...detail.tasks[0], status: 'not_done' }];
    if (field === 'client') detail.clientId = 'other-client';
    if (field === 'plannedTimes') detail.plannedEndAt = '2026-10-11T10:00:00Z';
    const result = await generateServiceRecord({ ...ctx, detail }, text, { requireSignature: true });
    expect(result.ok).toBe(false); expect(h.persist).not.toHaveBeenCalled();
  });
});
