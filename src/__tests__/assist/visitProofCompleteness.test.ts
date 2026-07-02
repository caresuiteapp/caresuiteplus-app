import { describe, expect, it } from 'vitest';
import {
  isStoredVisitProofComplete,
  visitProofNeedsRefresh,
} from '@/lib/assist/visitProofCompleteness';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';

function baseProof(overrides: Partial<AssistVisitProofRow> = {}): AssistVisitProofRow {
  return {
    id: 'proof-1',
    tenantId: 'tenant-1',
    visitId: 'visit-1',
    signatureId: 'sig-1',
    proofNumber: null,
    status: 'draft',
    storagePath: '/proofs/snapshot.json',
    payloadSnapshot: { tasks: [] },
    payloadHash: 'abc123',
    generatedAt: null,
    generatedBy: null,
    approvedAt: null,
    approvedBy: null,
    billingReleased: false,
    portalVisible: false,
    releasedToPortalAt: null,
    portalReleaseStatus: 'none',
    approvalNote: null,
    rejectionReason: null,
    pdfStoragePath: null,
    pdfHash: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('visitProofCompleteness', () => {
  it('accepts complete draft proof with snapshot and hash', () => {
    expect(isStoredVisitProofComplete(baseProof())).toBe(true);
    expect(visitProofNeedsRefresh(baseProof())).toBe(false);
  });

  it('rejects proof without payload hash', () => {
    const incomplete = baseProof({ payloadHash: null });
    expect(isStoredVisitProofComplete(incomplete)).toBe(false);
    expect(visitProofNeedsRefresh(incomplete)).toBe(true);
  });

  it('requires signature when configured', () => {
    const withoutSig = baseProof({ signatureId: null });
    expect(isStoredVisitProofComplete(withoutSig, { requireSignature: true })).toBe(false);
    expect(isStoredVisitProofComplete(withoutSig, { requireSignature: false })).toBe(true);
  });
});
