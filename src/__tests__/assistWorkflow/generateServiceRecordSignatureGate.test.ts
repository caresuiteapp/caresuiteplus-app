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
const ctx = { tenantId: 'tenant', assistVisitId: 'visit', assignmentId: 'visit', employeeId: 'employee',
  detail: { title: 'Begleitung' } } as AssistExecutionContext;
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
    h.signature.mockResolvedValue({ ok: true, data: { id: 'signature', signerName: 'Name', signedAt: '2026-10-11', storagePath: 'image' } });
    expect((await generateServiceRecord(ctx, 'Erledigt', { requireSignature: true })).ok).toBe(true);
    expect(h.persist).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'signature');
  });
});
