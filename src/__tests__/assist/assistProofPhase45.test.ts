import { describe, expect, it } from 'vitest';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import { buildAssistProofPdfPayload } from '@/lib/assist/assistProofPdfPayload';
import {
  ASSIST_PROOF_PORTAL_RELEASE_LABELS,
  ASSIST_PROOF_STATUS_LABELS,
} from '@/lib/assist/assistProofLabels';

function sampleProof(
  overrides: Partial<AssistVisitProofRow> = {},
): AssistVisitProofRow {
  return {
    id: 'proof-1',
    tenantId: 'tenant-1',
    visitId: 'visit-1',
    signatureId: null,
    proofNumber: 'LN-001',
    status: 'approved',
    storagePath: 'tenant/t1/assist/visits/v1/proofs/proof-1.json',
    payloadSnapshot: {
      clientName: 'Max Mustermann',
      employeeName: 'Anna Pflege',
      serviceName: 'Grundpflege',
      location: 'Musterstraße 1',
      documentationNote: 'Alles in Ordnung',
      tasksSummary: 'Waschen: erledigt',
      signerName: 'Max Mustermann',
      signedAt: '2026-06-20T10:00:00.000Z',
      latitude: 52.5,
      longitude: 13.4,
      locationPoints: [{ lat: 1, lng: 2 }],
    },
    payloadHash: 'sha256:abc',
    generatedAt: '2026-06-20T11:00:00.000Z',
    generatedBy: 'user-1',
    approvedAt: '2026-06-20T12:00:00.000Z',
    approvedBy: 'user-2',
    billingReleased: false,
    portalVisible: false,
    releasedToPortalAt: null,
    portalReleaseStatus: 'none',
    approvalNote: null,
    rejectionReason: null,
    pdfStoragePath: null,
    pdfHash: null,
    createdAt: '2026-06-20T11:00:00.000Z',
    updatedAt: '2026-06-20T12:00:00.000Z',
    ...overrides,
  };
}

describe('buildAssistProofPdfPayload', () => {
  it('builds HTML without GPS snapshot keys', () => {
    const payload = buildAssistProofPdfPayload(sampleProof());

    expect(payload.fileName).toContain('LN-001');
    expect(payload.html).toContain('Max Mustermann');
    expect(payload.html).toContain('Grundpflege');
    expect(payload.html).not.toContain('52.5');
    expect(payload.html).not.toContain('locationPoints');
    expect(payload.html).toContain('data-layout-version="v2"');
  });

  it('uses proof id prefix when proof number missing', () => {
    const payload = buildAssistProofPdfPayload(sampleProof({ proofNumber: null }));
    expect(payload.fileName).toContain('PROOF-1');
  });
});

describe('assist proof labels', () => {
  it('maps workflow statuses for UI', () => {
    expect(ASSIST_PROOF_STATUS_LABELS.pending_review).toBe('Zur Prüfung');
    expect(ASSIST_PROOF_STATUS_LABELS.rejected).toBe('Abgelehnt');
    expect(ASSIST_PROOF_PORTAL_RELEASE_LABELS.released).toBe('Im Klientenportal');
  });
});

describe('portal snapshot privacy', () => {
  it('strips GPS keys from exported payload fields', () => {
    const payload = buildAssistProofPdfPayload(sampleProof());
    expect(payload.html).not.toContain('52.5');
    expect(payload.html).not.toContain('13.4');
    expect(payload.html).not.toContain('locationPoints');
  });
});
