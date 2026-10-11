import { beforeEach, expect, it, vi } from 'vitest';
import type { AssistExecutionContext } from '@/features/assistWorkflow/types';
const h = vi.hoisted(() => ({ proof: vi.fn(), signature: vi.fn() }));
vi.mock('@/lib/assist/assistVisitProofPersistenceService', () => ({ fetchLatestVisitProof: h.proof }));
vi.mock('@/lib/assist/assistVisitSignaturePersistenceService', () => ({ fetchValidVisitSignature: h.signature }));
import { readFinalWorkflowProofConfirmation } from '@/features/assistWorkflow/readFinalWorkflowProofConfirmation';
import { buildServiceRecordSnapshot } from '@/features/assistWorkflow/buildServiceRecordHtml';
import { buildVisitSignaturePayload } from '@/features/assistWorkflow/workflowWriteExpectation';
import { canonicalJsonStringify, computeSha256Hex } from '@/lib/assist/assistExecutionHashService';
const ctx = { tenantId: 'tenant', employeeId: 'employee', assignmentId: 'visit', assistVisitId: 'visit',
  detail: { assignmentId: 'visit', title: 'Begleitung', clientId: 'client', clientName: 'Erika', locationAddress: 'Berlin',
    plannedStartAt: '2026-10-11T08:00:00Z', plannedEndAt: '2026-10-11T09:00:00Z', documentationNotes: 'Leistung',
    tasks: [{ id: 'task', title: 'Begleitung', status: 'done', completionNote: null }] },
  visitTimes: { serviceStartedAt: '2026-10-11T08:00:00Z', serviceEndedAt: '2026-10-11T09:00:00Z', serviceSeconds: 3600, activeTimer: null },
} as unknown as AssistExecutionContext;
const summary = { signerName: 'Erika', signerRole: 'client', signedAt: '2026-10-11T09:00:00Z' };
const hash = (value: unknown) => computeSha256Hex(canonicalJsonStringify(value));
const snapshot = (signature = true) => buildServiceRecordSnapshot({ detail: ctx.detail, visitTimes: ctx.visitTimes,
  documentationText: 'Leistung', visitId: 'visit', employeeId: 'employee', serviceName: 'Begleitung', signatureSummary: signature ? summary : null });
async function setProof(payloadSnapshot: Record<string, unknown>, overrides: Record<string,unknown> = {}) {
  h.proof.mockResolvedValue({ ok: true, data: { id: 'proof', tenantId: 'tenant', visitId: 'visit', signatureId: 'signature',
    payloadHash: await hash(payloadSnapshot), payloadSnapshot, ...overrides } });
}
beforeEach(async () => {
  vi.clearAllMocks();
  h.signature.mockResolvedValue({ ok: true, data: { id: 'signature', tenantId: 'tenant', visitId: 'visit', isValid: true,
    storagePath: 'signature.png', signatureHash: 'image', payloadHash: await hash(buildVisitSignaturePayload(ctx)), ...summary } });
  await setProof(snapshot());
});
it('confirms the exact signed content and stored proof hash after a lost completion reply', async () => {
  expect(await readFinalWorkflowProofConfirmation(ctx, ctx, false)).toBe('confirmed');
});
it.each(['missing', 'tenant', 'visit', 'signature', 'hash', 'snapshot'])('does not confirm a completed status with a %s proof receipt', async kind => {
  const proof = (await h.proof()).data;
  if (kind === 'missing') h.proof.mockResolvedValue({ ok: true, data: null });
  else if (kind === 'snapshot') await setProof({ ...proof.payloadSnapshot, documentationNote: 'old' });
  else h.proof.mockResolvedValue({ ok: true, data: { ...proof, [kind === 'tenant' ? 'tenantId' : kind === 'visit' ? 'visitId' : kind === 'signature' ? 'signatureId' : 'payloadHash']: 'wrong' } });
  expect(await readFinalWorkflowProofConfirmation(ctx, ctx, false)).toBe('pending');
});
it('does not confirm another document version even when that newer version has a complete proof', async () => {
  const current = { ...ctx, detail: { ...ctx.detail, documentationNotes: 'Neue Leistung' } };
  expect(await readFinalWorkflowProofConfirmation(ctx, current, false)).toBe('pending');
});
it('keeps proof/signature read failures visibly unavailable', async () => {
  h.proof.mockResolvedValueOnce({ ok: false, error: 'offline' });
  expect(await readFinalWorkflowProofConfirmation(ctx, ctx, false)).toBe('unavailable');
  h.signature.mockResolvedValue({ ok: false, error: 'offline' });
  expect(await readFinalWorkflowProofConfirmation(ctx, ctx, false)).toBe('unavailable');
});
it('confirms only an actually released deferred proof with the current document and tasks', async () => {
  await setProof({ ...snapshot(false), signatureDeferredToClientPortal: true, signatureDeferredAt: 'date', signatureDeferredBy: 'profile', signatureDeferredReason: 'Nicht vor Ort' },
    { signatureId: null, portalVisible: true, portalReleaseStatus: 'released' });
  expect(await readFinalWorkflowProofConfirmation(ctx, ctx, true)).toBe('confirmed');
  const proof = (await h.proof()).data; h.proof.mockResolvedValue({ ok: true, data: { ...proof, portalVisible: false } });
  expect(await readFinalWorkflowProofConfirmation(ctx, ctx, true)).toBe('pending');
});
it('also confirms a deferred request that the client completed before reconciliation', async () => {
  const completed = { ...ctx, detail: { ...ctx.detail, clientPortalSignatureCompleted: true } };
  await setProof({ ...snapshot(), signatureDeferredToClientPortal: false, signatureDeferredAt: 'date', signatureDeferredBy: 'profile',
    signatureDeferredReason: 'Nicht vor Ort', clientPortalSignedAt: summary.signedAt, signedViaClientPortal: true, clientPortalPdfSignatureId: 'signature' },
    { portalVisible: true, portalReleaseStatus: 'released' });
  expect(await readFinalWorkflowProofConfirmation(ctx, completed, true)).toBe('confirmed');
});
