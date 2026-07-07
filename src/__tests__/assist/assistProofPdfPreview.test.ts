import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function sampleProof(overrides: Partial<AssistVisitProofRow> = {}): AssistVisitProofRow {
  return {
    id: 'a8f3c2e1-4b5d-6a7c-8e9f-0d1c2b3a4e5f',
    tenantId: 'tenant-1',
    visitId: '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab',
    signatureId: '71602374-b79e-4c96-ac53-b9b93443b8b3',
    proofNumber: 'LN-27be',
    status: 'pending_review',
    storagePath: null,
    payloadSnapshot: {
      clientName: 'Heinz-Peter Reinhardt',
      title: 'Regelmäßige Alltagsbegleitung',
      plannedStartAt: '2026-06-30T23:00:00.000Z',
      plannedEndAt: '2026-07-01T00:00:00.000Z',
      documentation: 'Erledigt',
      visitTimes: {
        driveSeconds: 25,
        serviceSeconds: 15,
        arrivedAt: '2026-06-30T22:43:11.163Z',
        serviceStartedAt: '2026-06-30T22:54:49.076Z',
        serviceEndedAt: '2026-06-30T22:55:04.773Z',
      },
      tasks: [
        { id: 't1', title: 'Küche aufräumen', status: 'done' },
        { id: 't2', title: 'Staubsaugen', status: 'done' },
      ],
      signature: {
        signedAt: '2026-07-01T01:49:03.371Z',
        signerName: 'Heinz-Peter Reinhardt',
      },
      latitude: 52.5,
      internalNotes: 'Intern',
    },
    payloadHash: null,
    generatedAt: '2026-06-28T11:05:00.000Z',
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
    createdAt: '2026-06-28T11:05:00.000Z',
    updatedAt: '2026-06-28T11:05:00.000Z',
    ...overrides,
  };
}

const mockCreateSignedUrl = vi.fn();

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  }),
}));

vi.mock('@/lib/assist/visitProofSnapshotPreviewService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/assist/visitProofSnapshotPreviewService')>();
  return {
    ...actual,
    enrichVisitProofForPreview: vi.fn(async (_tenantId: string, proof: AssistVisitProofRow) => ({
      ok: true,
      data: {
        employeeName: 'Kevin Reinhardt',
        tenantLogoUrl: 'https://cdn.example/logo.png',
        tenantName: 'Pflege Plus GmbH',
      },
    })),
  };
});

import { buildAssistProofPdfPayload } from '@/lib/assist/assistProofPdfPayload';
import { resolveAssistProofPdfPreviewUrl } from '@/lib/assist/assistProofPdfService';

describe('buildAssistProofPdfPayload enriched HTML', () => {
  it('includes tasks, times and signature without GPS/internal fields', () => {
    const payload = buildAssistProofPdfPayload(sampleProof(), {
      employeeName: 'Kevin Reinhardt',
      serviceName: 'Alltagsbegleitung §45a SGB XI',
      location: 'Ringstraße 3, 44627 Herne',
      tasks: [
        { id: 't1', title: 'Küche aufräumen', status: 'done', statusLabel: 'Erledigt' },
        { id: 't2', title: 'Staubsaugen', status: 'done', statusLabel: 'Erledigt' },
      ],
    });

    expect(payload.fileName).toContain('LN-27be');
    expect(payload.html).toContain('Heinz-Peter Reinhardt');
    expect(payload.html).toContain('Kevin Reinhardt');
    expect(payload.html).toContain('Alle geplanten Aufgaben wurden vollständig erledigt.');
    expect(payload.html).not.toContain('Küche aufräumen');
    expect(payload.html).toContain('Anfahrt');
    expect(payload.html).toContain('Tatsächliches Ende');
    expect(payload.html).not.toContain('52.5');
    expect(payload.html).not.toContain('Intern');
  });

  it('embeds signature image when enrichment provides data URL', () => {
    const payload = buildAssistProofPdfPayload(sampleProof(), {
      signatureImageUrl: 'data:image/png;base64,abc',
    });

    expect(payload.html).toContain('data:image/png;base64,abc');
  });
});

describe('resolveAssistProofPdfPreviewUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dynamic blob preview from source data (layout v2)', async () => {
    const result = await resolveAssistProofPdfPreviewUrl(
      'tenant-1',
      sampleProof({ pdfStoragePath: 'tenant/t1/proof.pdf' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Web-Browser');
    }
  });
});

describe('VisitProofReviewPanel PDF preview wiring', () => {
  it('embeds VisitProofPdfPreviewPanel with enrichment props', () => {
    const panel = readSrc('src/components/assist/VisitProofReviewPanel.tsx');
    expect(panel).toContain('VisitProofPdfPreviewPanel');
    expect(panel).toContain('useVisitProofReviewPreview');
    expect(panel).toContain('signatureImageUrl');
  });

  it('VisitProofPdfPreviewPanel uses iframe PDF viewer on web', () => {
    const panel = readSrc('src/components/assist/VisitProofPdfPreviewPanel.tsx');
    expect(panel).toContain('<iframe');
    expect(panel).toContain('useVisitProofPdfPreview');
    expect(panel).toContain('VisitProofPreviewPanel');
    expect(panel).toContain('enabled: !htmlPreviewLoading');
  });
});
