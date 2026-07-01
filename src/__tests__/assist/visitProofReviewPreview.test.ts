import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import {
  buildVisitProofPreviewFromProof,
  enrichVisitProofForPreview,
  proofHasClientSignature,
} from '@/lib/assist/visitProofSnapshotPreviewService';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function sampleProof(overrides: Partial<AssistVisitProofRow> = {}): AssistVisitProofRow {
  return {
    id: 'a8f3c2e1-0000-4000-8000-000000000001',
    tenantId: 'tenant-1',
    visitId: '27be8d4e-0000-4000-8000-000000000001',
    signatureId: null,
    proofNumber: 'LN-27be',
    status: 'pending_review',
    storagePath: null,
    payloadSnapshot: {
      clientName: 'Heinz-Peter Reinhardt',
      title: 'Regelmäßige Alltagsbegleitung',
      plannedStartAt: '2026-06-28T09:00:00.000Z',
      plannedEndAt: '2026-06-28T11:00:00.000Z',
      visitTimes: {
        driveSeconds: 900,
        arrivedAt: '2026-06-28T09:12:00.000Z',
        serviceStartedAt: '2026-06-28T09:20:00.000Z',
        serviceEndedAt: '2026-06-28T10:55:00.000Z',
      },
      tasks: [
        { id: 't1', title: 'Begleitung Einkauf', status: 'done' },
        { id: 't2', title: 'Gespräch', status: 'done' },
      ],
      documentation: 'Einsatz ohne Besonderheiten.',
      employeeId: 'emp-1',
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

describe('visitProofSnapshotPreviewService', () => {
  it('builds preview with times, tasks and documentation from snapshot', () => {
    const preview = buildVisitProofPreviewFromProof(sampleProof(), {
      employeeName: 'Maria Muster',
      serviceName: 'Regelmäßige Alltagsbegleitung',
    });

    expect(preview.clientName).toBe('Heinz-Peter Reinhardt');
    expect(preview.employeeName).toBe('Maria Muster');
    expect(preview.tasks).toHaveLength(2);
    expect(preview.documentationNote).toBe('Einsatz ohne Besonderheiten.');
    expect(preview.fields.some((f) => f.label === 'Anfahrt' && f.value.includes('15'))).toBe(true);
    expect(preview.fields.find((f) => f.label === 'Unterschrift')?.missing).toBe(true);
  });

  it('builds preview from live proof a8f3c2e1 snapshot shape', () => {
    const preview = buildVisitProofPreviewFromProof(
      sampleProof({
        id: 'a8f3c2e1-4b5d-6a7c-8e9f-0d1c2b3a4e5f',
        visitId: '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab',
        signatureId: '71602374-b79e-4c96-ac53-b9b93443b8b3',
        status: 'pending_review',
        payloadSnapshot: {
          clientName: 'Heinz-Peter Reinhardt',
          title: 'Regelmäßige Alltagsbegleitung',
          plannedStartAt: '2026-06-30T23:00:00.000Z',
          plannedEndAt: '2026-07-01T00:00:00.000Z',
          documentation: 'Erledigt',
          assignmentId: '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab',
          signature: {
            signedAt: '2026-07-01T01:49:03.371Z',
            signerName: 'Heinz-Peter Reinhardt',
          },
          visitTimes: {
            driveSeconds: 25,
            serviceSeconds: 15,
            totalSeconds: 40,
            driveStartedAt: '2026-06-30T22:42:46.072Z',
            arrivedAt: '2026-06-30T22:43:11.163Z',
            serviceStartedAt: '2026-06-30T22:54:49.076Z',
            serviceEndedAt: '2026-06-30T22:55:04.773Z',
          },
          tasks: [
            { id: 't1', title: 'Einsatzbeginn dokumentieren', status: 'open' },
            { id: 't2', title: 'Küche aufräumen', status: 'open' },
          ],
        },
      }),
      {
        employeeName: 'Kevin Reinhardt',
        serviceName: 'Alltagsbegleitung §45a SGB XI',
        location: 'Ringstraße 3, 44627 Herne',
        tasks: [
          { id: 't1', title: 'Einsatzbeginn dokumentieren', status: 'done', statusLabel: 'Erledigt' },
          { id: 't2', title: 'Küche aufräumen', status: 'done', statusLabel: 'Erledigt' },
        ],
      },
    );

    expect(preview.clientName).toBe('Heinz-Peter Reinhardt');
    expect(preview.employeeName).toBe('Kevin Reinhardt');
    expect(preview.location).toBe('Ringstraße 3, 44627 Herne');
    expect(preview.tasks).toHaveLength(2);
    expect(preview.tasks.every((task) => task.status === 'done')).toBe(true);
    expect(preview.documentationNote).toBe('Erledigt');
    expect(preview.readyForExport).toBe(true);
    expect(preview.fields.find((f) => f.label === 'Unterschrift')?.missing).toBe(false);
    expect(proofHasClientSignature(sampleProof({ signatureId: '71602374-b79e-4c96-ac53-b9b93443b8b3' }))).toBe(
      true,
    );
  });

  it('detects client signature from snapshot or signature id', () => {
    expect(proofHasClientSignature(sampleProof())).toBe(false);
    expect(
      proofHasClientSignature(
        sampleProof({
          signatureId: 'sig-1',
          payloadSnapshot: {
            ...sampleProof().payloadSnapshot,
            signerName: 'Heinz-Peter Reinhardt',
            signedAt: '2026-06-28T10:50:00.000Z',
          },
        }),
      ),
    ).toBe(true);
  });

  it('marks signed proof as export-ready without employee or location in snapshot', () => {
    const preview = buildVisitProofPreviewFromProof(
      sampleProof({
        signatureId: 'sig-1',
        payloadSnapshot: {
          clientName: 'Heinz-Peter Reinhardt',
          title: 'Alltagsbegleitung',
          plannedStartAt: '2026-06-30T23:00:00.000Z',
          plannedEndAt: '2026-07-01T00:00:00.000Z',
          documentation: 'Erledigt',
          signature: {
            signedAt: '2026-07-01T01:49:03.371Z',
            signerName: 'Heinz-Peter Reinhardt',
          },
        },
      }),
    );

    expect(preview.readyForExport).toBe(true);
    expect(preview.fields.find((f) => f.label === 'Mitarbeitende:r')?.required).toBe(false);
    expect(preview.fields.find((f) => f.label === 'Ort')?.required).toBe(false);
  });
});

const mockFromUnknownTable = vi.fn();
const mockFetchValidVisitSignature = vi.fn();

vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (...args: unknown[]) => mockFromUnknownTable(...args),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: vi.fn(async () => ({ data: null })),
      }),
    },
  }),
}));

vi.mock('@/lib/assist/assistVisitSignaturePersistenceService', () => ({
  fetchValidVisitSignature: (...args: unknown[]) => mockFetchValidVisitSignature(...args),
}));

function mockQueryResult(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data, error })),
  };
}

describe('enrichVisitProofForPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchValidVisitSignature.mockResolvedValue({ ok: false });
  });

  it('loads employee, location and assignment task statuses without DB error', async () => {
    mockFromUnknownTable.mockImplementation((_client, table: string) => {
      if (table === 'assist_visits') {
        return mockQueryResult({
          id: '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab',
          service_name: 'Alltagsbegleitung §45a SGB XI',
          planned_start_at: '2026-06-30T23:00:00.000Z',
          planned_end_at: '2026-07-01T00:00:00.000Z',
          address_snapshot: null,
          employee_id: 'e036ecd3-8ff7-4453-af93-ebbcbd0820f2',
          legacy_assignment_id: '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab',
          employees: { first_name: 'Kevin', last_name: 'Reinhardt' },
          clients: {
            street: 'Ringstraße 3',
            house_number: '3',
            postal_code: '44627',
            city: 'Herne',
          },
          assist_visit_tasks: [{ id: 't1', title: 'Küche aufräumen', status: 'open', note: null }],
        });
      }
      if (table === 'assignments') {
        return mockQueryResult({
          id: '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab',
          address_snapshot: null,
          employee_id: 'e036ecd3-8ff7-4453-af93-ebbcbd0820f2',
          employees: { first_name: 'Kevin', last_name: 'Reinhardt' },
          clients: {
            street: 'Ringstraße 3',
            house_number: '3',
            postal_code: '44627',
            city: 'Herne',
          },
          assignment_tasks: [
            { id: 'at1', title: 'Küche aufräumen', status: 'done', sort_order: 1 },
            { id: 'at2', title: 'Staubsaugen', status: 'done', sort_order: 2 },
          ],
        });
      }
      return mockQueryResult(null);
    });

    const proof = sampleProof({
      visitId: '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab',
      payloadSnapshot: {
        clientName: 'Heinz-Peter Reinhardt',
        title: 'Regelmäßige Alltagsbegleitung',
        plannedStartAt: '2026-06-30T23:00:00.000Z',
        plannedEndAt: '2026-07-01T00:00:00.000Z',
        documentation: 'Erledigt',
        assignmentId: '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab',
        tasks: [{ id: 't1', title: 'Küche aufräumen', status: 'open' }],
      },
    });

    const result = await enrichVisitProofForPreview('tenant-1', proof);

    expect(result.ok).toBe(true);
    expect(result.data?.employeeName).toBe('Kevin Reinhardt');
    expect(result.data?.location).toBe('Ringstraße 3, 44627 Herne');
    expect(result.data?.tasks?.every((task) => task.status === 'done')).toBe(true);
    expect(mockFromUnknownTable).toHaveBeenCalledWith(expect.anything(), 'assist_visits');
    expect(mockFromUnknownTable).toHaveBeenCalledWith(expect.anything(), 'assignments');
  });
});

const mockFetchProof = vi.fn();
const mockUpdateProof = vi.fn();
const mockGeneratePdf = vi.fn();

vi.mock('@/lib/assist/assistVisitProofPersistenceService', () => ({
  fetchVisitProofById: (...args: unknown[]) => mockFetchProof(...args),
  updateVisitProofRow: (...args: unknown[]) => mockUpdateProof(...args),
}));

vi.mock('@/lib/assist/assistProofPdfService', () => ({
  generateAssistProofPdf: (...args: unknown[]) => mockGeneratePdf(...args),
}));

vi.mock('@/lib/assist/clientBudgetTransactionService', () => ({
  consumeOnProofApproval: vi.fn(async () => ({ ok: true })),
}));

vi.mock('@/lib/portal/portalProofCacheSignal', () => ({
  invalidatePortalProofCache: vi.fn(),
}));

import {
  approveAndReleaseAssistProof,
  releaseAssistProofToPortal,
} from '@/lib/assist/assistProofApprovalService';

describe('assist proof release modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGeneratePdf.mockResolvedValue({
      ok: true,
      data: { ...sampleProof(), status: 'approved', pdfStoragePath: 'tenant/proof.pdf' },
    });
    mockUpdateProof.mockImplementation(async (_tenantId, proofId, patch) => ({
      ok: true,
      data: {
        ...sampleProof({ id: proofId, status: 'pending_review' }),
        ...Object.fromEntries(
          Object.entries(patch).map(([key, value]) => [
            key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
            value,
          ]),
        ),
        status: (patch.status as AssistVisitProofRow['status']) ?? 'pending_review',
        portalReleaseStatus:
          (patch.portal_release_status as AssistVisitProofRow['portalReleaseStatus']) ?? 'none',
        portalVisible: patch.portal_visible === true,
        pdfStoragePath:
          (patch.pdf_storage_path as string | undefined) ?? 'tenant/proof.pdf',
      },
    }));
    mockFetchProof.mockImplementation(async (_tenantId, proofId) => {
      const lastPatch = mockUpdateProof.mock.calls.at(-1)?.[2] as Record<string, unknown> | undefined;
      const status = (lastPatch?.status as AssistVisitProofRow['status']) ?? 'pending_review';
      return {
        ok: true,
        data: sampleProof({
          id: proofId,
          status,
          pdfStoragePath: status === 'approved' || status === 'exported' ? 'tenant/proof.pdf' : null,
        }),
      };
    });
  });

  it('approveAndReleaseAssistProof uses full release when signature present', async () => {
    mockFetchProof.mockImplementation(async (_tenantId, proofId) => {
      const lastPatch = mockUpdateProof.mock.calls.at(-1)?.[2] as Record<string, unknown> | undefined;
      const status = (lastPatch?.status as AssistVisitProofRow['status']) ?? 'pending_review';
      return {
        ok: true,
        data: sampleProof({
          id: proofId,
          status,
          signatureId: 'sig-1',
          pdfStoragePath: status === 'approved' || status === 'exported' ? 'tenant/proof.pdf' : null,
          payloadSnapshot: {
            ...sampleProof().payloadSnapshot,
            signerName: 'Heinz-Peter Reinhardt',
            signedAt: '2026-06-28T10:50:00.000Z',
          },
        }),
      };
    });

    const result = await approveAndReleaseAssistProof(
      'tenant-1',
      'proof-1',
      'user-1',
      'business_admin',
      { releaseMode: 'full' },
    );

    expect(result.ok).toBe(true);
    expect(mockUpdateProof).toHaveBeenCalled();
    const releasePatch = mockUpdateProof.mock.calls.at(-1)?.[2] as Record<string, unknown>;
    expect(releasePatch.portal_release_status).toBe('released');
    expect(releasePatch.portal_visible).toBe(true);
  });

  it('approveAndReleaseAssistProof uses restricted release without signature', async () => {
    const result = await approveAndReleaseAssistProof(
      'tenant-1',
      'proof-1',
      'user-1',
      'business_admin',
      { releaseMode: 'restricted' },
    );

    expect(result.ok).toBe(true);
    const releasePatch = mockUpdateProof.mock.calls.at(-1)?.[2] as Record<string, unknown>;
    expect(releasePatch.portal_release_status).toBe('pending_client_signature');
  });

  it('releaseAssistProofToPortal accepts restricted mode for approved proofs', async () => {
    mockFetchProof.mockResolvedValueOnce({
      ok: true,
      data: sampleProof({ status: 'approved', pdfStoragePath: 'tenant/proof.pdf' }),
    });

    await releaseAssistProofToPortal('tenant-1', 'proof-1', 'user-1', 'business_admin', 'restricted');

    const releasePatch = mockUpdateProof.mock.calls.at(-1)?.[2] as Record<string, unknown>;
    expect(releasePatch.portal_release_status).toBe('pending_client_signature');
  });
});

describe('VisitProofReviewPanel wiring', () => {
  it('always embeds preview panel with snapshot fallback', () => {
    const panel = readSrc('src/components/assist/VisitProofReviewPanel.tsx');
    expect(panel).toContain('VisitProofPreviewPanel');
    expect(panel).toContain('buildVisitProofPreviewFromProof');
    expect(panel).toContain('snapshotPreview');
    expect(panel).not.toMatch(/\{preview \?\s*\(\s*\n?\s*<VisitProofPreviewPanel/);
    expect(panel).toContain('approveAndReleaseAssistProof');
    expect(panel).toContain('Eingeschränkt freigeben');
    expect(panel).toContain('useVisitProofReviewPreview');
    expect(panel).toContain('previewError');
  });

  it('labels pending_client_signature portal release', () => {
    const labels = readSrc('src/lib/assist/assistProofLabels.ts');
    expect(labels).toContain('pending_client_signature');
  });
});
