import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';
const h = vi.hoisted(() => ({ context: vi.fn(), actor: vi.fn(), signature: vi.fn(), row: null as Record<string, unknown> | null, error: null as unknown, filters: vi.fn() }));
vi.mock('@/features/assistWorkflow/resolveAssistExecutionContext', () => ({ resolveAssistExecutionContext: h.context }));
vi.mock('@/lib/auth/resolveAuthenticatedProfile', () => ({ resolveAuthenticatedProfileId: h.actor }));
vi.mock('@/lib/assist/assistVisitSignaturePersistenceService', () => ({ fetchValidVisitSignature: h.signature }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({}) }));
vi.mock('@/lib/supabase/untypedTable', () => ({ fromUnknownTable: () => {
  const q = { select: () => q, eq: (...args: unknown[]) => { h.filters(...args); return q; }, maybeSingle: async () => ({ data: h.row, error: h.error }) }; return q;
} }));
import { readWorkflowActionConfirmation } from '@/features/assistWorkflow/readWorkflowActionConfirmation';
import { buildVisitDocumentationContent } from '@/features/assistWorkflow/visitDocumentationContent';

const before = { tenantId: 'tenant', employeeId: 'employee', assignmentId: 'assignment', assistVisitId: 'visit', profileId: 'profile', roleKey: 'employee_portal',
  assignmentStatus: 'unterschrift_offen', derivedStatus: 'unterschrift_offen', detail: { status: 'unterschrift_offen', documentationStatus: 'submitted', signatureStatus: 'captured', documentationNotes: 'Leistung' },
  visitTimes: {}, timeEvents: [] } as unknown as AssistExecutionContext;
const content = buildVisitDocumentationContent({ shortDescription: ' Leistung ', specialNotes: 'Neue interne Meldung', referralRequired: true, emergencyOrProblem: false, photoReferences: ['neues-bild'] });
const doc = { kind: 'documentation' as const, content };
const sig = { kind: 'signature' as const, signature: { signatureHash: 'new-image', payloadHash: 'new-payload', signerName: 'Name', signerRole: 'client' } };
beforeEach(() => {
  vi.clearAllMocks(); h.error = null;
  h.context.mockResolvedValue({ ok: true, data: before }); h.actor.mockResolvedValue({ ok: true, data: 'profile' });
  h.row = { tenant_id: 'tenant', visit_id: 'visit', submitted_by: 'profile', submitted_at: '2026-10-11T09:00:00Z', ...content };
  h.signature.mockResolvedValue({ ok: true, data: { tenantId: 'tenant', visitId: 'visit', signedByProfileId: 'profile', isValid: true, storagePath: 'path', ...sig.signature } });
});
describe('submitted version confirmation after a correction or replacement', () => {
  it('does not confirm old submitted/captured flags without the attempted version', async () => {
    expect((await readWorkflowActionConfirmation(before, 'save_documentation')).state).toBe('pending');
    expect((await readWorkflowActionConfirmation(before, 'save_signature')).state).toBe('pending');
  });
  it('confirms all documentation fields through a fresh scoped record, including internal messages and photos', async () => {
    expect((await readWorkflowActionConfirmation(before, 'save_documentation', doc)).state).toBe('confirmed');
    expect(h.filters).toHaveBeenCalledWith('tenant_id', 'tenant'); expect(h.filters).toHaveBeenCalledWith('visit_id', 'visit');
  });
  it.each(['short_description', 'special_notes', 'photo_references', 'submitted_by', 'tenant_id', 'visit_id'] as const)('rejects an older or foreign documentation %s', async (field) => {
    h.row = { ...h.row, [field]: field === 'photo_references' ? ['old-image'] : 'older-or-foreign' };
    expect((await readWorkflowActionConfirmation(before, 'save_documentation', doc)).state).toBe('pending');
  });
  it('confirms the exact replacement image, signed content, signer and authenticated actor', async () => {
    expect((await readWorkflowActionConfirmation(before, 'save_signature', sig)).state).toBe('confirmed');
  });
  it.each(['signatureHash', 'payloadHash', 'signerName', 'signerRole', 'signedByProfileId', 'visitId', 'tenantId'] as const)('rejects a former or foreign signature %s', async (field) => {
    const result = await h.signature(); h.signature.mockResolvedValue({ ...result, data: { ...result.data, [field]: 'old-or-foreign' } });
    expect((await readWorkflowActionConfirmation(before, 'save_signature', sig)).state).toBe('pending');
  });
  it('preserves the unknown outcome after denied identity or failed documentation read', async () => {
    h.actor.mockResolvedValue({ ok: false, error: 'signed out' });
    expect((await readWorkflowActionConfirmation(before, 'save_documentation', doc)).state).toBe('unavailable');
    h.actor.mockResolvedValue({ ok: true, data: 'profile' }); h.error = { message: 'offline' };
    expect((await readWorkflowActionConfirmation(before, 'save_documentation', doc)).state).toBe('unavailable');
  });
});
